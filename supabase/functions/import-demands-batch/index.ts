import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type CsvDemandRow = {
  id: string;
  contact_id: string;
  property_type?: string | null;
  property_types?: string | null;
  operation?: string | null;
  min_price?: string | null;
  max_price?: string | null;
  min_surface?: string | null;
  min_bedrooms?: string | null;
  min_bathrooms?: string | null;
  cities?: string | null;
  zones?: string | null;
  features?: string | null;
  financing_type?: string | null;
  floor_preference?: string | null;
  preferred_orientation?: string | null;
  urgency_months?: string | null;
  max_mortgage_payment?: string | null;
  notes?: string | null;
  is_active?: string | boolean | null;
  auto_match?: string | boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function parsePgArray(input: string | null | undefined): string[] | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed || trimmed === "{}") return null;

  const inner = trimmed.replace(/^\{/, "").replace(/\}$/, "");
  if (!inner.trim()) return null;

  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    const next = inner[index + 1];

    if (char === '"' && inner[index - 1] !== "\\") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      const value = current.replace(/\\"/g, '"').trim();
      if (value) values.push(value);
      current = "";
      continue;
    }

    if (char === "\\" && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    current += char;
  }

  const finalValue = current.replace(/\\"/g, '"').trim();
  if (finalValue) values.push(finalValue);

  return values.length ? values : null;
}

function parseNumber(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function parseBoolean(input: string | boolean | null | undefined): boolean {
  if (typeof input === "boolean") return input;
  const normalized = String(input ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rows } = await req.json();
    const chunk = Array.isArray(rows) ? (rows as CsvDemandRow[]) : [];

    if (!chunk.length) {
      return new Response(JSON.stringify({ ok: true, received: 0, imported: 0, skipped_missing_contact: 0 }), {
        headers: jsonHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const contactIds = Array.from(new Set(chunk.map((row) => String(row.contact_id || "").trim()).filter(Boolean)));
    const { data: existingContacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id")
      .in("id", contactIds);

    if (contactsError) throw new Error(`contacts lookup: ${contactsError.message}`);

    const validContactIds = new Set((existingContacts ?? []).map((item) => item.id));
    const skippedMissing = chunk.filter((row) => !validContactIds.has(String(row.contact_id || "").trim()));

    const payload = chunk
      .filter((row) => validContactIds.has(String(row.contact_id || "").trim()))
      .map((row) => ({
        id: row.id,
        contact_id: row.contact_id,
        property_type: row.property_type || null,
        property_types: parsePgArray(row.property_types),
        operation: row.operation || null,
        min_price: parseNumber(row.min_price),
        max_price: parseNumber(row.max_price),
        min_surface: parseNumber(row.min_surface),
        min_bedrooms: parseNumber(row.min_bedrooms),
        min_bathrooms: parseNumber(row.min_bathrooms),
        cities: parsePgArray(row.cities),
        zones: parsePgArray(row.zones),
        features: parsePgArray(row.features),
        financing_type: row.financing_type || null,
        floor_preference: row.floor_preference || null,
        preferred_orientation: parsePgArray(row.preferred_orientation),
        urgency_months: parseNumber(row.urgency_months),
        max_mortgage_payment: parseNumber(row.max_mortgage_payment),
        notes: row.notes || null,
        is_active: parseBoolean(row.is_active),
        auto_match: parseBoolean(row.auto_match),
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
      }));

    if (!payload.length) {
      return new Response(JSON.stringify({
        ok: true,
        received: chunk.length,
        imported: 0,
        skipped_missing_contact: skippedMissing.length,
        missing_contact_ids: skippedMissing.slice(0, 20).map((row) => row.contact_id),
      }), {
        headers: jsonHeaders,
      });
    }

    const { error: upsertError } = await supabase
      .from("demands")
      .upsert(payload, { onConflict: "id" });

    if (upsertError) throw new Error(`demands upsert: ${upsertError.message}`);

    return new Response(JSON.stringify({
      ok: true,
      received: chunk.length,
      imported: payload.length,
      skipped_missing_contact: skippedMissing.length,
      missing_contact_ids: skippedMissing.slice(0, 20).map((row) => row.contact_id),
    }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "import failed";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
