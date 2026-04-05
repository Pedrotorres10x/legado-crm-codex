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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const toStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").toLowerCase().trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    return normalized ? [normalized] : [];
  }

  return [];
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

    const DEMAND_LIMIT = 500;
    const PROPERTY_LIMIT = 2000;
    const MATCH_LIMIT = 10000;

    const [{ data: demands, error: demandsError }, { data: properties, error: propertiesError }, { data: matches, error: matchesError }] = await Promise.all([
      supabase
        .from("demands")
        .select("id, contact_id, is_active, auto_match, operation, property_type, property_types, cities, zones, min_price, max_price, min_surface, min_bedrooms, contacts(full_name, email, phone)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(DEMAND_LIMIT),
      supabase
        .from("properties")
        .select("id, title, city, province, price, bedrooms, surface_area, property_type, operation, status, auto_match")
        .eq("status", "disponible")
        .limit(PROPERTY_LIMIT),
      supabase
        .from("matches")
        .select("id, demand_id, property_id, compatibility, status")
        .limit(MATCH_LIMIT),
    ]);

    if (demandsError) throw new Error(`demands: ${demandsError.message}`);
    if (propertiesError) throw new Error(`properties: ${propertiesError.message}`);
    if (matchesError) throw new Error(`matches: ${matchesError.message}`);

    type ExistingMatchRow = { id: string; demand_id: string; property_id: string; compatibility: number | null; status: string | null };
    type AuditDemandRow = typeof demands extends Array<infer T> ? T : never;
    const existingByDemand = new Map<string, ExistingMatchRow[]>();
    for (const match of matches ?? []) {
      const key = String(match.demand_id);
      const current = existingByDemand.get(key) || [];
      current.push(match);
      existingByDemand.set(key, current);
    }

    const activeProperties = (properties ?? []).filter((property) => property.auto_match !== false);

    const report = ((demands ?? []) as AuditDemandRow[]).map((demand) => {
      const demandCities = toStringArray(demand.cities);
      const demandZones = toStringArray(demand.zones);
      let geographyCandidates = 0;
      let afterType = 0;
      let afterOperation = 0;
      let afterBudget = 0;
      let afterBedrooms = 0;
      const finalCandidates: Array<{ id: string; title: string | null; city: string | null; price: number | null; compatibility: number }> = [];

      for (const prop of activeProperties) {
        const propCity = String(prop.city ?? "").toLowerCase().trim();
        const propProvince = String(prop.province ?? "").toLowerCase().trim();
        const cityMatch =
          demandCities.length > 0 &&
          propCity &&
          demandCities.some((city) => propCity.includes(city) || city.includes(propCity));
        const zoneMatch =
          demandZones.length > 0 &&
          (
            (propCity && demandZones.some((zone) => propCity.includes(zone) || zone.includes(propCity))) ||
            (propProvince && demandZones.some((zone) => propProvince.includes(zone) || zone.includes(propProvince)))
          );

        const hasGeoFilter = demandCities.length > 0 || demandZones.length > 0;
        if (hasGeoFilter && !cityMatch && !zoneMatch) continue;
        geographyCandidates++;

        if ((demand.property_type || demand.property_types?.length) && !propertyTypeMatches(demand.property_type, demand.property_types, prop.property_type)) {
          continue;
        }
        afterType++;

        if (demand.operation && !operationMatches(demand.operation, prop.operation)) continue;
        afterOperation++;

        if (demand.max_price && prop.price) {
          const budget = scoreBudgetFit(demand.min_price, demand.max_price, prop.price, 0.25);
          if (!budget.ok) continue;
        }

        const effectiveMinPrice = demand.min_price
          ? Number(demand.min_price)
          : (demand.max_price ? Number(demand.max_price) * 0.75 : null);

        if (effectiveMinPrice && prop.price) {
          const budget = scoreBudgetFit(effectiveMinPrice, demand.max_price, prop.price, 0.25);
          if (!budget.ok) continue;
        }
        afterBudget++;

        if (demand.min_bedrooms && prop.bedrooms && !bedroomMatches(demand.min_bedrooms, prop.bedrooms)) continue;
        afterBedrooms++;

        let score = 0;
        let total = 0;

        if (demand.property_type || demand.property_types?.length) {
          total += MATCHING_PILLARS.propertyFamily;
          if (propertyTypeMatches(demand.property_type, demand.property_types, prop.property_type)) {
            score += MATCHING_PILLARS.propertyFamily;
          }
        }

        if (demand.operation) {
          total += MATCHING_PILLARS.operation;
          if (operationMatches(demand.operation, prop.operation)) {
            score += MATCHING_PILLARS.operation;
          }
        }

        if (demand.max_price && prop.price) {
          const budget = scoreBudgetFit(demand.min_price, demand.max_price, prop.price, 0.25);
          total += MATCHING_PILLARS.budget;
          score += Math.round(MATCHING_PILLARS.budget * budget.score);
        }

        if (effectiveMinPrice && prop.price) {
          total += 5;
          score += Number(prop.price) >= effectiveMinPrice ? 5 : 2;
        }

        if (demand.min_surface && prop.surface_area) {
          total += 10;
          if (Number(prop.surface_area) >= Number(demand.min_surface)) score += 10;
        }

        if (demand.min_bedrooms && prop.bedrooms) {
          total += MATCHING_PILLARS.bedrooms;
          score += Math.round(MATCHING_PILLARS.bedrooms * scoreBedroomFit(demand.min_bedrooms, prop.bedrooms));
        }

        const compatibility = total > 0 ? Math.round((score / total) * 100) : 0;
        if (compatibility < 50) continue;

        finalCandidates.push({
          id: String(prop.id),
          title: prop.title ?? null,
          city: prop.city ?? null,
          price: prop.price ?? null,
          compatibility,
        });
      }

      finalCandidates.sort((a, b) => b.compatibility - a.compatibility);

      return {
        demand_id: demand.id,
        contact: demand.contacts?.full_name ?? "Sin nombre",
        email: demand.contacts?.email ?? null,
        auto_match: demand.auto_match,
        existing_matches: (existingByDemand.get(String(demand.id)) ?? []).length,
        geographyCandidates,
        afterType,
        afterOperation,
        afterBudget,
        afterBedrooms,
        possibleNow: finalCandidates.length,
        top: finalCandidates.slice(0, 3),
      };
    });

    const summary = {
      total_demands: report.length,
      total_properties: activeProperties.length,
      with_existing_matches: report.filter((item) => item.existing_matches > 0).length,
      with_possible_candidates_now: report.filter((item) => item.possibleNow > 0).length,
      without_candidates_now: report.filter((item) => item.possibleNow === 0).length,
      total_existing_matches: (matches ?? []).length,
    };

    const truncated = {
      demands: (demands ?? []).length >= DEMAND_LIMIT,
      properties: (properties ?? []).length >= PROPERTY_LIMIT,
      matches: (matches ?? []).length >= MATCH_LIMIT,
    };

    return new Response(JSON.stringify({ summary, report, truncated }), { headers: jsonHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "matching audit failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
