import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface HealthPropertyRow {
  id: string;
  title: string;
  created_at: string;
  agent_id: string | null;
}

interface MandatePropertyRow {
  id: string;
  title: string;
  agent_id: string | null;
  mandate_type: string | null;
  mandate_end: string;
}

interface HealthContactRow {
  id: string;
  full_name: string;
  created_at: string;
  agent_id: string | null;
  status: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const notifications: { event_type: string; entity_type: string; entity_id: string; title: string; description: string; agent_id: string | null }[] = [];

  // ── Properties health check ──
  const { data: properties } = await supabase
    .from("properties")
    .select("id, title, created_at, agent_id")
    .eq("status", "disponible");

  const propList: HealthPropertyRow[] = properties || [];
  const propIds = propList.map((p) => p.id);

  const latestMatchByProp: Record<string, string> = {};
  const latestVisitByProp: Record<string, string> = {};
  const hasMatch = new Set<string>();

  if (propIds.length > 0) {
    const [matchesRes, visitsRes] = await Promise.all([
      supabase.from("matches").select("property_id, created_at").in("property_id", propIds).order("created_at", { ascending: false }),
      supabase.from("visits").select("property_id, created_at").in("property_id", propIds).order("created_at", { ascending: false }),
    ]);
    ((matchesRes.data || []) as Array<{ property_id: string; created_at: string }>).forEach((m) => {
      hasMatch.add(m.property_id);
      if (!latestMatchByProp[m.property_id]) latestMatchByProp[m.property_id] = m.created_at;
    });
    ((visitsRes.data || []) as Array<{ property_id: string; created_at: string }>).forEach((v) => {
      if (!latestVisitByProp[v.property_id]) latestVisitByProp[v.property_id] = v.created_at;
    });
  }

  for (const p of propList) {
    const daysSinceCreated = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / 86400000);
    const lm = latestMatchByProp[p.id] ? new Date(latestMatchByProp[p.id]) : null;
    const lv = latestVisitByProp[p.id] ? new Date(latestVisitByProp[p.id]) : null;
    const lastActivity = lm && lv ? (lm > lv ? lm : lv) : lm || lv;
    const daysSinceActivity = lastActivity ? Math.floor((now.getTime() - lastActivity.getTime()) / 86400000) : null;

    let color: string | null = null;
    let reason = "";

    if (!hasMatch.has(p.id)) {
      if (daysSinceCreated >= 21) { color = "red"; reason = `Sin leads desde hace ${daysSinceCreated}d`; }
      else if (daysSinceCreated >= 14) { color = "yellow"; reason = `Sin leads · ${daysSinceCreated}d publicado`; }
    } else if (daysSinceActivity !== null) {
      if (daysSinceActivity >= 30) { color = "red"; reason = `Sin actividad ${daysSinceActivity}d`; }
      else if (daysSinceActivity >= 14) { color = "yellow"; reason = `Sin actividad ${daysSinceActivity}d`; }
    }

    if (color) {
      notifications.push({
        event_type: "health_warning",
        entity_type: "property",
        entity_id: p.id,
        title: `${color === "red" ? "🔴" : "🟡"} ${p.title}`,
        description: reason,
        agent_id: p.agent_id,
      });
    }
  }

  // ── Mandate expiry check (30 / 15 / 7 days) ──
  const { data: mandateProps } = await supabase
    .from("properties")
    .select("id, title, agent_id, mandate_type, mandate_end")
    .eq("status", "disponible")
    .not("mandate_type", "is", null)
    .neq("mandate_type", "sin_mandato")
    .not("mandate_end", "is", null);

  for (const mp of (mandateProps || []) as MandatePropertyRow[]) {
    const daysLeft = Math.floor((new Date(mp.mandate_end).getTime() - now.getTime()) / 86400000);
    if (daysLeft < 0 || daysLeft > 30) continue;

    let urgencyEmoji = "🟡";
    let urgencyLabel = "Aviso";
    if (daysLeft <= 7) { urgencyEmoji = "🔴"; urgencyLabel = "URGENTE"; }
    else if (daysLeft <= 15) { urgencyEmoji = "🟠"; urgencyLabel = "Próximo"; }

    notifications.push({
      event_type: "mandate_expiring",
      entity_type: "property",
      entity_id: mp.id,
      title: `${urgencyEmoji} ${urgencyLabel}: Mandato vence en ${daysLeft}d`,
      description: `${mp.title} (${mp.mandate_type}) – vence el ${mp.mandate_end}`,
      agent_id: mp.agent_id,
    });
  }

  // ── Contacts health check ──
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, created_at, agent_id, status")
    .in("status", ["nuevo", "en_seguimiento", "activo"]);

  const contactList: HealthContactRow[] = contacts || [];
  const contactIds = contactList.map((c) => c.id);

  const latestInterByContact: Record<string, string> = {};
  if (contactIds.length > 0) {
    const { data: interactions } = await supabase
      .from("interactions")
      .select("contact_id, interaction_date")
      .in("contact_id", contactIds)
      .order("interaction_date", { ascending: false });
    ((interactions || []) as Array<{ contact_id: string; interaction_date: string }>).forEach((i) => {
      if (!latestInterByContact[i.contact_id]) latestInterByContact[i.contact_id] = i.interaction_date;
    });
  }

  for (const c of contactList) {
    const last = latestInterByContact[c.id] ? new Date(latestInterByContact[c.id]) : new Date(c.created_at);
    const days = Math.floor((now.getTime() - last.getTime()) / 86400000);

    let color: string | null = null;
    let reason = "";

    if (days >= 14) { color = "red"; reason = `Sin contacto ${days}d`; }
    else if (days >= 7) { color = "yellow"; reason = `Sin contacto ${days}d`; }

    if (color) {
      notifications.push({
        event_type: "health_warning",
        entity_type: "contact",
        entity_id: c.id,
        title: `${color === "red" ? "🔴" : "🟡"} ${c.full_name}`,
        description: reason,
        agent_id: c.agent_id,
      });
    }
  }

  // ── Satellite heartbeat check (active ping) ──
  const { data: satellites } = await supabase
    .from('satellite_config')
    .select('satellite_key, base_url, is_active')
    .neq('base_url', '');

  for (const sat of satellites || []) {
    if (!sat.is_active || !sat.base_url) continue;
    try {
      const pingUrl = sat.base_url.startsWith('http')
        ? sat.base_url
        : `https://${sat.base_url}`;
      const res = await fetch(pingUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      await supabase
        .from('satellite_config')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('satellite_key', sat.satellite_key);
      console.log(`[health] ✅ ${sat.satellite_key} responded ${res.status}`);
    } catch (err) {
      console.warn(`[health] ❌ ${sat.satellite_key} unreachable:`, err);
      // Clear heartbeat so dashboard shows red
      await supabase
        .from('satellite_config')
        .update({ last_heartbeat: null })
        .eq('satellite_key', sat.satellite_key);
    }
  }

  // ── Clear old health_warning & mandate_expiring notifications and insert new ones ──
  await supabase.from("notifications").delete().in("event_type", ["health_warning", "mandate_expiring"]);

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications);
  }

  return new Response(
    JSON.stringify({ ok: true, warnings: notifications.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
