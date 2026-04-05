import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { demand_id } = await req.json();
    if (!demand_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing demand_id" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: emailsError } = await supabase.from("match_emails").delete().eq("demand_id", demand_id);
    if (emailsError) throw new Error(`match_emails: ${emailsError.message}`);

    const { error: logsError } = await supabase.from("communication_logs").delete().eq("demand_id", demand_id);
    if (logsError) throw new Error(`communication_logs: ${logsError.message}`);

    const { error: matchesError } = await supabase.from("matches").delete().eq("demand_id", demand_id);
    if (matchesError) throw new Error(`matches: ${matchesError.message}`);

    const { error: demandError } = await supabase.from("demands").delete().eq("id", demand_id);
    if (demandError) throw new Error(`demands: ${demandError.message}`);

    return new Response(JSON.stringify({ ok: true, demand_id }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "delete failed";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
