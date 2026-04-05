import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  bedroomMatches,
  MATCHING_PILLARS,
  operationMatches,
  propertyTypeMatches,
  scoreBedroomFit,
  scoreBudgetFit,
} from "../_shared/matching.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DemandContactSummary {
  agent_id: string | null;
  full_name: string | null;
}

interface MatchInsertRow {
  property_id: string;
  demand_id: string;
  agent_id: string | null;
  compatibility: number;
  status: string;
}

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
  const matchesToCreate: MatchInsertRow[] = [];

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
    maxScore += MATCHING_PILLARS.operation;
    if (operationMatches(demand.operation, property.operation)) score += MATCHING_PILLARS.operation;

    // Property type
    maxScore += MATCHING_PILLARS.propertyFamily;
    if (propertyTypeMatches(demand.property_type, demand.property_types, property.property_type)) {
      score += MATCHING_PILLARS.propertyFamily;
    }

    // Price
    maxScore += MATCHING_PILLARS.budget;
    if (property.price !== null) {
      const budget = scoreBudgetFit(demand.min_price, demand.max_price, property.price, 0.1);
      if (!budget.ok) continue;
      score += Math.round(MATCHING_PILLARS.budget * budget.score);
    }

    // Bedrooms
    maxScore += MATCHING_PILLARS.bedrooms;
    if (bedroomMatches(demand.min_bedrooms, property.bedrooms)) {
      score += Math.round(MATCHING_PILLARS.bedrooms * scoreBedroomFit(demand.min_bedrooms, property.bedrooms));
    }

    // Surface
    maxScore += MATCHING_PILLARS.surface;
    if (!demand.min_surface || (property.surface_area ?? 0) >= demand.min_surface) score += MATCHING_PILLARS.surface;

    // City
    maxScore += MATCHING_PILLARS.geography;
    const demandCities = (demand.cities || []).map((c: string) => c.toLowerCase());
    if (demandCities.length === 0 || (property.city && demandCities.includes(property.city.toLowerCase()))) {
      score += MATCHING_PILLARS.geography;
    }

    const compatibility = Math.round((score / maxScore) * 100);
    if (compatibility < 50) continue; // Skip poor matches

    const contact = demand.contacts as DemandContactSummary | null;
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
