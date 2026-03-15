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

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch all active demands + available properties in parallel
  const [demandsRes, propsRes] = await Promise.all([
    supabase
      .from("demands")
      .select("*, contacts(agent_id)")
      .eq("is_active", true)
      .eq("auto_match", true),
    supabase
      .from("properties")
      .select("*")
      .eq("status", "disponible")
      .eq("auto_match", true),
  ]);

  const demands = demandsRes.data ?? [];
  const properties = propsRes.data ?? [];

  if (demands.length === 0 || properties.length === 0) {
    return new Response(JSON.stringify({ matched: 0, skipped: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch existing matches once to skip duplicates (batch, not per-pair)
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("demand_id, property_id");

  const existingSet = new Set(
    (existingMatches ?? []).map((m: any) => `${m.demand_id}:${m.property_id}`)
  );

  const matchesToUpsert: any[] = [];
  let skipped = 0;

  for (const demand of demands) {
    const demandCities = (demand.cities ?? []).map((c: string) =>
      c.toLowerCase().trim()
    );
    const demandZones = (demand.zones ?? []).map((z: string) =>
      z.toLowerCase().trim()
    );

    for (const prop of properties) {
      // Skip already-matched pairs
      const key = `${demand.id}:${prop.id}`;
      if (existingSet.has(key)) { skipped++; continue; }

      let score = 0;
      let total = 0;

      // Property type
      if (demand.property_type) {
        total += 20;
        if (demand.property_type === prop.property_type) score += 20;
      }

      // Operation
      if (demand.operation) {
        total += 10;
        if (demand.operation === prop.operation || demand.operation === "ambas") score += 10;
      }

      // Geography — hard filter
      if (demandCities.length > 0 || demandZones.length > 0) {
        const propCity = (prop.city ?? "").toLowerCase().trim();
        const propProvince = (prop.province ?? "").toLowerCase().trim();
        const cityMatch =
          demandCities.length > 0 &&
          propCity &&
          demandCities.some(
            (c: string) => propCity.includes(c) || c.includes(propCity)
          );
        const zoneMatch =
          demandZones.length > 0 &&
          (
            (propCity && demandZones.some((z: string) => propCity.includes(z) || z.includes(propCity))) ||
            (propProvince && demandZones.some((z: string) => propProvince.includes(z) || z.includes(propProvince)))
          );
        if (!cityMatch && !zoneMatch) continue;
      }

      // Max price — hard filter with 25% tolerance
      if (demand.max_price && prop.price) {
        const maxWithMargin = Number(demand.max_price) * 1.25;
        if (Number(prop.price) > maxWithMargin) continue;
        total += 20;
        score += Number(prop.price) <= Number(demand.max_price) ? 20 : 10;
      }

      // Min price — soft filter with 25% margin
      // If demand has explicit min_price, use it; otherwise derive floor from max_price (75%)
      const effectiveMinPrice = demand.min_price
        ? Number(demand.min_price)
        : (demand.max_price ? Number(demand.max_price) * 0.75 : null);

      if (effectiveMinPrice && prop.price) {
        const minWithMargin = effectiveMinPrice * 0.75;
        if (Number(prop.price) < minWithMargin) continue;
        total += 5;
        score += Number(prop.price) >= effectiveMinPrice ? 5 : 2;
      }

      // Surface
      if (demand.min_surface && prop.surface_area) {
        total += 10;
        if (Number(prop.surface_area) >= Number(demand.min_surface)) score += 10;
      }

      // Bedrooms
      if (demand.min_bedrooms && prop.bedrooms) {
        total += 10;
        if (prop.bedrooms >= demand.min_bedrooms) score += 10;
      }

      const compatibility = total > 0 ? Math.round((score / total) * 100) : 0;
      if (compatibility < 50) continue;

      const agentId = demand.contacts?.agent_id || null;
      matchesToUpsert.push({
        demand_id: demand.id,
        property_id: prop.id,
        compatibility,
        status: "pendiente",
        agent_id: agentId,
      });
    }
  }

  let inserted = 0;
  if (matchesToUpsert.length > 0) {
    // Batch upsert in chunks of 500 to avoid payload limits
    const CHUNK = 500;
    for (let i = 0; i < matchesToUpsert.length; i += CHUNK) {
      const chunk = matchesToUpsert.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("matches")
        .upsert(chunk, { onConflict: "demand_id,property_id" });
      if (!error) inserted += chunk.length;
    }
  }

  return new Response(
    JSON.stringify({ matched: inserted, skipped }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
