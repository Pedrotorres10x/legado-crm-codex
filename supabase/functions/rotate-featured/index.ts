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

  const FEATURED_COUNT = 3;

  // 1. Clear current featured
  await supabase
    .from("properties")
    .update({ is_featured: false })
    .eq("is_featured", true);

  // 2. Get ALL available properties with at least 3 images + full data for cache
  const { data: candidates, error } = await supabase
    .from("properties")
    .select("*")
    .eq("status", "disponible")
    .not("images", "eq", "{}");

  if (error || !candidates?.length) {
    return new Response(JSON.stringify({ error: "No candidates", detail: error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const withPhotos = candidates.filter(
    (p: any) => p.images && Array.isArray(p.images) && p.images.length >= 3
  );

  if (withPhotos.length === 0) {
    return new Response(JSON.stringify({ error: "No properties with enough photos" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use day-of-year as seed for deterministic daily rotation
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
  );

  // Sort by id for stable order, then offset by day
  const sorted = withPhotos.sort((a: any, b: any) => a.id.localeCompare(b.id));
  const offset = (dayOfYear * FEATURED_COUNT) % sorted.length;
  const selected: any[] = [];
  for (let i = 0; i < FEATURED_COUNT; i++) {
    selected.push(sorted[(offset + i) % sorted.length]);
  }

  // 3. Mark as featured
  const ids = selected.map((p: any) => p.id);
  const { error: updateError } = await supabase
    .from("properties")
    .update({ is_featured: true })
    .in("id", ids);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. Sync featured_cache for Legado Colección
  // Clear old cache
  await supabase.from("featured_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Build cache rows with fields Legado expects
  const cacheRows = selected.map((p: any) => ({
    property_id: p.id,
    property_data: {
      id: p.id,
      title: p.title,
      description: p.description,
      property_type: p.property_type,
      status: p.status,
      price: p.price,
      city: p.city,
      zone: p.zone,
      location: p.city || "",
      address: p.address,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      surface_area: p.surface_area,
      built_area: p.built_area,
      area_m2: p.surface_area,
      operation: p.operation,
      images: p.images,
      virtual_tour_url: p.virtual_tour_url,
      is_featured: true,
      created_at: p.created_at,
      energy_cert: p.energy_cert,
      has_garden: p.has_garden,
      has_elevator: p.has_elevator,
      has_garage: p.has_garage,
      has_pool: p.has_pool,
      has_terrace: p.has_terrace,
      features: p.features || [],
      crm_reference: p.crm_reference,
      floor: p.floor_number,
    },
    image_score: p.images?.length || 0,
  }));

  await supabase.from("featured_cache").insert(cacheRows);

  return new Response(
    JSON.stringify({ ok: true, featured: ids.length, day: dayOfYear, total_pool: sorted.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
