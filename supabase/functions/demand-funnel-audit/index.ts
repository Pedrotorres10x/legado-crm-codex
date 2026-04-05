import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type AuditContactRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  contact_type: string | null;
  tags: string[] | null;
  buyer_intent: unknown;
  pipeline_stage: string | null;
  intent_stage: string | null;
  created_at: string;
};

type AuditDemandRow = {
  id: string;
  contact_id: string | null;
  is_active: boolean | null;
  auto_match: boolean | null;
  created_at: string;
  contacts: { full_name: string | null; email: string | null; phone: string | null } | null;
};

const hasDemandIntent = (contact: AuditContactRow) => {
  const fields = [
    contact.contact_type,
    contact.status,
    contact.pipeline_stage,
    contact.intent_stage,
    JSON.stringify(contact.buyer_intent ?? {}),
    ...(Array.isArray(contact.tags) ? contact.tags : []),
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .filter(Boolean);

  return fields.some((value) =>
    value.includes("comprador") ||
    value.includes("buyer") ||
    value.includes("demanda") ||
    value.includes("demander")
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: demands, error: demandsError }, { data: contacts, error: contactsError }, { data: matches, error: matchesError }] = await Promise.all([
      supabase
        .from("demands")
        .select("id, contact_id, is_active, auto_match, created_at, contacts(full_name, email, phone)")
        .order("created_at", { ascending: false }),
      supabase
        .from("contacts")
        .select("id, full_name, email, phone, status, contact_type, tags, buyer_intent, pipeline_stage, intent_stage, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("matches")
        .select("id, demand_id"),
    ]);

    if (demandsError) throw new Error(`demands: ${demandsError.message}`);
    if (contactsError) throw new Error(`contacts: ${contactsError.message}`);
    if (matchesError) throw new Error(`matches: ${matchesError.message}`);

    const demandIdsWithMatches = new Set((matches ?? []).map((item) => String(item.demand_id)));
    const demandByContact = new Map<string, AuditDemandRow[]>();

    for (const demand of (demands ?? []) as AuditDemandRow[]) {
      const key = String(demand.contact_id ?? "");
      const current = demandByContact.get(key) || [];
      current.push(demand);
      demandByContact.set(key, current);
    }

    const demandIntentContacts = (contacts ?? []).filter(hasDemandIntent);
    const contactsWithoutDemand = demandIntentContacts.filter((contact) => !demandByContact.has(String(contact.id)));

    const summary = {
      total_demands: (demands ?? []).length,
      active_demands: (demands ?? []).filter((demand) => demand.is_active === true).length,
      inactive_demands: (demands ?? []).filter((demand) => demand.is_active === false).length,
      auto_match_enabled: (demands ?? []).filter((demand) => demand.auto_match !== false).length,
      with_matches: (demands ?? []).filter((demand) => demandIdsWithMatches.has(String(demand.id))).length,
      without_matches: (demands ?? []).filter((demand) => !demandIdsWithMatches.has(String(demand.id))).length,
      buyer_like_contacts: demandIntentContacts.length,
      buyer_like_contacts_without_demand: contactsWithoutDemand.length,
    };

    const demandDetails = (demands ?? []).slice(0, 50).map((demand) => ({
      id: demand.id,
      contact: demand.contacts?.full_name ?? "Sin nombre",
      email: demand.contacts?.email ?? null,
      is_active: demand.is_active,
      auto_match: demand.auto_match,
      has_matches: demandIdsWithMatches.has(String(demand.id)),
      created_at: demand.created_at,
    }));

    const orphanBuyerContacts = contactsWithoutDemand.slice(0, 50).map((contact) => ({
      id: contact.id,
      full_name: contact.full_name,
      email: contact.email,
      phone: contact.phone,
      status: contact.status,
      contact_type: contact.contact_type,
      pipeline_stage: contact.pipeline_stage,
      intent_stage: contact.intent_stage,
      buyer_intent: contact.buyer_intent,
      tags: contact.tags,
      created_at: contact.created_at,
    }));

    return new Response(JSON.stringify({ summary, demandDetails, orphanBuyerContacts }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "demand funnel audit failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
