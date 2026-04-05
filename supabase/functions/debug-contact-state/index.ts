import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const debugSecret = Deno.env.get("GREENAPI_WEBHOOK_SECRET");
    const authHeader = req.headers.get("authorization");
    const normalizedAuth = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const providedSecret =
      req.headers.get("x-debug-secret") ||
      req.headers.get("x-webhook-secret") ||
      normalizedAuth ||
      authHeader;

    if (!serviceKey) return json({ ok: false, error: "missing_service_key" }, 500);
    if (!debugSecret) return json({ ok: false, error: "missing_debug_secret" }, 500);
    if (providedSecret !== debugSecret) return json({ ok: false, error: "unauthorized" }, 401);

    const url = new URL(req.url);
    const contactId = url.searchParams.get("contact_id");
    if (!contactId) return json({ ok: false, error: "contact_id_required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );

    const [{ data: contact }, { data: logs }, { data: interactions }, { data: configRows }] = await Promise.all([
      supabase.from("contacts").select("id, full_name, phone, phone2, preferred_language, tags").eq("id", contactId).maybeSingle(),
      supabase.from("communication_logs").select("id, created_at, channel, direction, source, status, body_preview, property_id, demand_id, metadata").eq("contact_id", contactId).order("created_at", { ascending: true }),
      supabase.from("interactions").select("id, created_at, interaction_type, subject, description, property_id").eq("contact_id", contactId).order("created_at", { ascending: true }),
      supabase.from("app_config").select("key, value").in("key", ["messaging_enabled", "automation_outbound_enabled", "property_interest_automation_enabled"]),
    ]);

    const appConfig = Object.fromEntries((configRows || []).map((row) => [row.key, row.value]));

    return json({ ok: true, contact, logs, interactions, appConfig });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    return json({ ok: false, error: message }, 500);
  }
});
