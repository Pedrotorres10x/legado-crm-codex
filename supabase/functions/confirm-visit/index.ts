import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const normalizeDeclaredValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
};

const isValidDeclaredName = (value: string) => value.length >= 5;
const isValidDeclaredDni = (value: string) => value.replace(/[\s-]/g, "").length >= 5;

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
          headers: jsonHeaders,
        });
      }

      const { data, error } = await supabase
        .from("visits")
        .select("id, visit_date, notes, confirmation_status, confirmed_at, property_id, contact_id, visitor_declared_name, visitor_declared_dni")
        .eq("confirmation_token", token)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "Visita no encontrada" }), {
          status: 404,
          headers: jsonHeaders,
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
        headers: jsonHeaders,
      });
    }

    // POST: confirm, cancel or reschedule
    if (req.method === "POST") {
      const body = await req.json();
      const { token, action, new_date, declared_name, declared_dni, declaration_acknowledged } = body;

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token requerido" }),
          { status: 400, headers: jsonHeaders }
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
          headers: jsonHeaders,
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
            headers: jsonHeaders,
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
            headers: jsonHeaders,
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Visita cancelada" }), {
          headers: jsonHeaders,
        });
      }

      // RESCHEDULE
      if (action === "reschedule") {
        if (!new_date) {
          return new Response(JSON.stringify({ error: "Nueva fecha requerida" }), {
            status: 400,
            headers: jsonHeaders,
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
            headers: jsonHeaders,
          });
        }

        return new Response(JSON.stringify({ success: true, message: "Visita reprogramada" }), {
          headers: jsonHeaders,
        });
      }

      // CONFIRM (default action)
      if (visit.confirmation_status === "confirmado") {
        return new Response(JSON.stringify({ error: "Esta visita ya fue confirmada" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const normalizedDeclaredName = normalizeDeclaredValue(declared_name);
      const normalizedDeclaredDni = normalizeDeclaredValue(declared_dni).toUpperCase();

      if (!isValidDeclaredName(normalizedDeclaredName)) {
        return new Response(JSON.stringify({ error: "Escribe tu nombre completo tal y como figura en tu documento." }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      if (!isValidDeclaredDni(normalizedDeclaredDni)) {
        return new Response(JSON.stringify({ error: "Escribe tu DNI o NIE correctamente para dejar constancia de la visita." }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      if (declaration_acknowledged !== true) {
        return new Response(JSON.stringify({ error: "Debes aceptar que los datos declarados sean correctos." }), {
          status: 400,
          headers: jsonHeaders,
        });
      }

      const { error: updateError } = await supabase
        .from("visits")
        .update({
          confirmation_status: "confirmado",
          confirmed_at: new Date().toISOString(),
          confirmation_ip: ip,
          confirmation_user_agent: userAgent,
          visitor_declared_name: normalizedDeclaredName,
          visitor_declared_dni: normalizedDeclaredDni,
          visitor_declaration_acknowledged_at: new Date().toISOString(),
        })
        .eq("id", visit.id);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Error al confirmar: " + updateError.message }), {
          status: 500,
          headers: jsonHeaders,
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Visita confirmada" }), {
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: jsonHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
