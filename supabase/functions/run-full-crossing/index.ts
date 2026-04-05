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

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const PROPERTY_BATCH_SIZE = 200;

interface ExistingMatchRow {
  demand_id: string;
  property_id: string;
}

interface MatchInsertRow {
  demand_id: string;
  property_id: string;
  compatibility: number;
  status: string;
  agent_id: string | null;
}

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

    const { data: demands, error: demandsError } = await supabase
      .from("demands")
      .select("id, min_price, max_price, min_surface, min_bedrooms, operation, property_type, property_types, cities, zones, contacts(agent_id)")
      .eq("is_active", true)
      .or("auto_match.is.null,auto_match.eq.true");

    if (demandsError) {
      throw new Error(`No se pudieron cargar las demandas: ${demandsError.message}`);
    }

    const { count: propertiesCount, error: propertiesCountError } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "disponible")
      .or("auto_match.is.null,auto_match.eq.true");

    if (propertiesCountError) {
      throw new Error(`No se pudo contar el stock disponible: ${propertiesCountError.message}`);
    }

    if ((demands ?? []).length === 0 || !propertiesCount) {
      return new Response(JSON.stringify({ matched: 0, skipped: 0 }), {
        headers: jsonHeaders,
      });
    }

    const { data: existingMatches, error: existingMatchesError } = await supabase
      .from("matches")
      .select("demand_id, property_id");

    if (existingMatchesError) {
      throw new Error(`No se pudieron cargar los cruces existentes: ${existingMatchesError.message}`);
    }

    const existingSet = new Set(
      ((existingMatches ?? []) as ExistingMatchRow[]).map((m) => `${m.demand_id}:${m.property_id}`),
    );

    const matchesToUpsert: MatchInsertRow[] = [];
    let skipped = 0;

    for (let from = 0; from < propertiesCount; from += PROPERTY_BATCH_SIZE) {
      const to = Math.min(from + PROPERTY_BATCH_SIZE - 1, propertiesCount - 1);
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("id, price, operation, property_type, city, province, bedrooms, surface_area")
        .eq("status", "disponible")
        .or("auto_match.is.null,auto_match.eq.true")
        .range(from, to);

      if (propertiesError) {
        throw new Error(`No se pudieron cargar los inmuebles: ${propertiesError.message}`);
      }

      for (const demand of demands ?? []) {
        const demandCities = toStringArray(demand.cities);
        const demandZones = toStringArray(demand.zones);

        for (const prop of properties ?? []) {
          const key = `${demand.id}:${prop.id}`;
          if (existingSet.has(key)) {
            skipped++;
            continue;
          }

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

          if (demandCities.length > 0 || demandZones.length > 0) {
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

            if (!cityMatch && !zoneMatch) continue;
          }

          if (demand.max_price && prop.price) {
            const budget = scoreBudgetFit(demand.min_price, demand.max_price, prop.price, 0.25);
            if (!budget.ok) continue;
            total += MATCHING_PILLARS.budget;
            score += Math.round(MATCHING_PILLARS.budget * budget.score);
          }

          const effectiveMinPrice = demand.min_price
            ? Number(demand.min_price)
            : (demand.max_price ? Number(demand.max_price) * 0.75 : null);

          if (effectiveMinPrice && prop.price) {
            const budget = scoreBudgetFit(effectiveMinPrice, demand.max_price, prop.price, 0.25);
            if (!budget.ok) continue;
            total += 5;
            score += Number(prop.price) >= effectiveMinPrice ? 5 : 2;
          }

          if (demand.min_surface && prop.surface_area) {
            total += 10;
            if (Number(prop.surface_area) >= Number(demand.min_surface)) score += 10;
          }

          if (demand.min_bedrooms && prop.bedrooms) {
            total += MATCHING_PILLARS.bedrooms;
            if (bedroomMatches(demand.min_bedrooms, prop.bedrooms)) {
              score += Math.round(
                MATCHING_PILLARS.bedrooms * scoreBedroomFit(demand.min_bedrooms, prop.bedrooms),
              );
            }
          }

          const compatibility = total > 0 ? Math.round((score / total) * 100) : 0;
          if (compatibility < 50) continue;

          matchesToUpsert.push({
            demand_id: demand.id,
            property_id: prop.id,
            compatibility,
            status: "pendiente",
            agent_id: demand.contacts?.agent_id ?? null,
          });
        }
      }
    }

    let inserted = 0;
    if (matchesToUpsert.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < matchesToUpsert.length; i += CHUNK) {
        const chunk = matchesToUpsert.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("matches")
          .upsert(chunk, { onConflict: "demand_id,property_id" });

        if (error) {
          throw new Error(`No se pudieron guardar los cruces: ${error.message}`);
        }

        inserted += chunk.length;
      }
    }

    return new Response(JSON.stringify({ matched: inserted, skipped }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado en el cruce";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
