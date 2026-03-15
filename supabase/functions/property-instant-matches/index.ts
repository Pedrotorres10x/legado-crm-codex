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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { property_id } = await req.json();
  if (!property_id) {
    return new Response(JSON.stringify({ error: "property_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch the new property
  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id, title, price, operation, property_type, city, zone, bedrooms, bathrooms, surface_area, features, agent_id")
    .eq("id", property_id)
    .single();

  if (propErr || !property) {
    return new Response(JSON.stringify({ error: "Property not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch active demands that could match
  const { data: demands } = await supabase
    .from("demands")
    .select("id, contact_id, operation, property_type, property_types, max_price, min_price, min_bedrooms, min_bathrooms, min_surface, cities, zones, features, auto_match, contacts(agent_id, full_name)")
    .eq("is_active", true)
    .eq("auto_match", true);

  if (!demands || demands.length === 0) {
    return new Response(JSON.stringify({ matched: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Match algorithm
  let matchCount = 0;
  const matchesToCreate: any[] = [];

  for (const demand of demands) {
    // Skip if already matched
    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("property_id", property_id)
      .eq("demand_id", demand.id)
      .maybeSingle();
    if (existing) continue;

    let score = 0;
    let maxScore = 0;

    // Operation
    maxScore += 30;
    if (
      !demand.operation ||
      demand.operation === property.operation ||
      property.operation === "ambas" ||
      demand.operation === "ambas"
    ) score += 30;

    // Property type
    maxScore += 20;
    const allowedTypes = demand.property_types?.length
      ? demand.property_types
      : demand.property_type
      ? [demand.property_type]
      : [];
    if (allowedTypes.length === 0 || allowedTypes.includes(property.property_type)) score += 20;

    // Price
    maxScore += 20;
    if (property.price !== null) {
      const inMin = !demand.min_price || property.price >= demand.min_price;
      const inMax = !demand.max_price || property.price <= demand.max_price * 1.1; // 10% tolerance
      if (inMin && inMax) score += 20;
      else if (inMin || inMax) score += 10;
    }

    // Bedrooms
    maxScore += 10;
    if (!demand.min_bedrooms || (property.bedrooms ?? 0) >= demand.min_bedrooms) score += 10;

    // Surface
    maxScore += 10;
    if (!demand.min_surface || (property.surface_area ?? 0) >= demand.min_surface) score += 10;

    // City
    maxScore += 10;
    const demandCities = (demand.cities || []).map((c: string) => c.toLowerCase());
    if (demandCities.length === 0 || (property.city && demandCities.includes(property.city.toLowerCase()))) score += 10;

    const compatibility = Math.round((score / maxScore) * 100);
    if (compatibility < 50) continue; // Skip poor matches

    const contact = demand.contacts as any;
    matchesToCreate.push({
      property_id: property.id,
      demand_id: demand.id,
      agent_id: contact?.agent_id ?? property.agent_id,
      compatibility,
      status: "pendiente",
    });
    matchCount++;
  }

  // Insert new matches
  if (matchesToCreate.length > 0) {
    await supabase.from("matches").insert(matchesToCreate);
  }

  // Notify the agent if matches found
  if (matchCount > 0 && property.agent_id) {
    await supabase.from("notifications").insert({
      event_type: "instant_matches",
      entity_type: "property",
      entity_id: property.id,
      title: `🎯 ${matchCount} match${matchCount > 1 ? "es" : ""} instantáneo${matchCount > 1 ? "s" : ""}`,
      description: `${property.title} – ${matchCount} demanda${matchCount > 1 ? "s" : ""} compatible${matchCount > 1 ? "s" : ""} encontrada${matchCount > 1 ? "s" : ""}`,
      agent_id: property.agent_id,
    });
  }

  return new Response(
    JSON.stringify({ matched: matchCount }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
