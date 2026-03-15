import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // GET: fetch visit details by token
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token || token.length < 10) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("visits")
        .select("id, visit_date, notes, confirmation_status, confirmed_at, property_id, contact_id")
        .eq("confirmation_token", token)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Visita no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [propRes, contactRes] = await Promise.all([
        supabase.from("properties").select("title, address").eq("id", data.property_id).single(),
        supabase.from("contacts").select("full_name").eq("id", data.contact_id).single(),
      ]);

      return new Response(JSON.stringify({
        ...data,
        property_title: propRes.data?.title || "Propiedad",
        property_address: propRes.data?.address || "",
        contact_name: contactRes.data?.full_name || "",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: confirm, cancel or reschedule
    if (req.method === "POST") {
      const body = await req.json();
      const { token, action, new_date } = body;

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token requerido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: visit, error: findError } = await supabase
        .from("visits")
        .select("id, confirmation_status")
        .eq("confirmation_token", token)
        .single();

      if (findError || !visit) {
        return new Response(JSON.stringify({ error: "Visita no encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      // CANCEL
      if (action === "cancel") {
        if (visit.confirmation_status === "cancelado") {
          return new Response(JSON.stringify({ error: "Esta visita ya fue cancelada" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updateError } = await supabase
          .from("visits")
          .update({
            confirmation_status: "cancelado",
            confirmed_at: new Date().toISOString(),
            confirmation_ip: ip,
            confirmation_user_agent: userAgent,
          })
          .eq("id", visit.id);

        if (updateError) {
          return new Response(JSON.stringify({ error: "Error al cancelar: " + updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Visita cancelada" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // RESCHEDULE
      if (action === "reschedule") {
        if (!new_date) {
          return new Response(JSON.stringify({ error: "Nueva fecha requerida" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updateError } = await supabase
          .from("visits")
          .update({
            visit_date: new_date,
            confirmation_status: "reprogramado",
            confirmed_at: new Date().toISOString(),
            confirmation_ip: ip,
            confirmation_user_agent: userAgent,
          })
          .eq("id", visit.id);

        if (updateError) {
          return new Response(JSON.stringify({ error: "Error al reprogramar: " + updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Visita reprogramada" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CONFIRM (default action)
      if (visit.confirmation_status === "confirmado") {
        return new Response(JSON.stringify({ error: "Esta visita ya fue confirmada" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabase
        .from("visits")
        .update({
          confirmation_status: "confirmado",
          confirmed_at: new Date().toISOString(),
          confirmation_ip: ip,
          confirmation_user_agent: userAgent,
        })
        .eq("id", visit.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Error al confirmar: " + updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Visita confirmada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
