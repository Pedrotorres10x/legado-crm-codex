import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrichDemandsInboxRows } from "../_shared/demands-inbox.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const PAGE_SIZE = 1000;

type InboxDemandRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  contact_id: string | null;
  operation: string | null;
  property_type: string | null;
  property_types: string[] | null;
  cities: string[] | null;
  zones: string[] | null;
  min_price: number | null;
  max_price: number | null;
  min_bedrooms: number | null;
  notes: string | null;
  auto_match: boolean | null;
  is_active: boolean | null;
  contacts: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    agent_id: string | null;
    pipeline_stage: string | null;
    tags: string[] | null;
  };
};

type MatchRow = {
  demand_id: string;
};

type InteractionRow = {
  contact_id: string;
  created_at: string;
};

async function fetchAllRows<T>(
  loader: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await loader(from, to);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify JWT and admin/coordinadora role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: jsonHeaders });
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: jsonHeaders });
    const [{ data: isAdmin }, { data: isCoord }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: user.id, _role: "coordinadora" }),
    ]);
    if (!isAdmin && !isCoord) return new Response(JSON.stringify({ error: "Acceso restringido" }), { status: 403, headers: jsonHeaders });

    const demands = await fetchAllRows<InboxDemandRow>(async (from, to) =>
      supabase
        .from("demands")
        .select(`
          id, created_at, updated_at, contact_id, operation, property_type, property_types, cities, zones,
          min_price, max_price, min_bedrooms, notes, auto_match, is_active,
          contacts!inner(id, full_name, email, phone, agent_id, pipeline_stage, tags)
        `)
        .order("created_at", { ascending: false })
        .range(from, to),
    );

    const demandIds = demands.map((demand) => demand.id);
    const contactIds = Array.from(new Set(demands.map((demand) => demand.contact_id).filter(Boolean))) as string[];

    const [matches, interactions] = await Promise.all([
      demandIds.length
        ? fetchAllRows<MatchRow>(async (from, to) =>
            supabase
              .from("matches")
              .select("demand_id")
              .in("demand_id", demandIds)
              .range(from, to),
          )
        : Promise.resolve([]),
      contactIds.length
        ? fetchAllRows<InteractionRow>(async (from, to) =>
            supabase
              .from("interactions")
              .select("contact_id, created_at")
              .in("contact_id", contactIds)
              .order("created_at", { ascending: false })
              .range(from, to),
          )
        : Promise.resolve([]),
    ]);

    const visibleDemands = enrichDemandsInboxRows(demands, matches, interactions);

    return new Response(JSON.stringify({
      ok: true,
      total: visibleDemands.length,
      rows: visibleDemands,
    }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "demands inbox failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
