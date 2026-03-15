import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { json, handleCors } from '../_shared/cors.ts';

const DETAIL_FIELDS = `
  id, title, description, property_type, operation, price,
  surface_area, built_area, bedrooms, bathrooms,
  city, province, address, zip_code, zone,
  floor, floor_number, staircase, door,
  energy_cert, has_elevator, has_garage, has_pool, has_terrace, has_garden,
  features, images, image_order, videos, virtual_tour_url,
  latitude, longitude,
  reference, crm_reference, status,
  country, is_international,
  created_at, updated_at
`.replace(/\n/g, '');

/** Escape SQL LIKE wildcards and limit length */
function sanitizeLike(input: string, maxLen = 100): string {
  return input.substring(0, maxLen).replace(/[%_\\]/g, '\\$&');
}

const LIST_FIELDS = `
  id, title, description, property_type, operation, price,
  surface_area, built_area, bedrooms, bathrooms,
  city, province, zone, address, zip_code,
  floor, floor_number,
  energy_cert, has_elevator, has_garage, has_pool, has_terrace, has_garden,
  features, images, image_order, videos, virtual_tour_url,
  crm_reference, status,
  country, is_international,
  created_at, updated_at
`;

const ACTIVE_STATUSES = ['disponible', 'reservado'];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const url = new URL(req.url);
    const p = (k: string) => url.searchParams.get(k);
    const id = p('id');
    const idSuffix = p('id_suffix');

    // ── Single property by ID ───────────────────────────────────────────
    if (id) {
      const { data, error } = await supabase
        .from('properties')
        .select(DETAIL_FIELDS)
        .eq('id', id)
        .in('status', ACTIVE_STATUSES)
        .single();

      if (error || !data) return json({ error: 'Property not found' }, 404);
      const enriched = { ...data, is_magnos: (data.price || 0) >= 500000 && (data.images?.length || 0) >= 20 };
      return json({ success: true, property: enriched });
    }

    // ── Lookup by UUID suffix (for slug resolution) ─────────────────────
    if (idSuffix && /^[a-f0-9]{4,12}$/i.test(idSuffix)) {
      // Search for a property whose UUID (without hyphens) ends with the suffix
      const { data, error } = await supabase
        .rpc('find_property_by_id_suffix', { suffix: idSuffix.toLowerCase() });

      if (error) {
        console.error('id_suffix rpc error, falling back to scan:', error.message);
        // Fallback: brute-force scan active properties
        const { data: allData } = await supabase
          .from('properties')
          .select('id')
          .in('status', ACTIVE_STATUSES)
          .limit(500);
        const match = (allData || []).find((row: any) =>
          row.id.replace(/-/g, '').endsWith(idSuffix.toLowerCase())
        );
        if (match) return json({ success: true, property_id: match.id });
        return json({ error: 'Property not found by suffix' }, 404);
      }

      if (data && data.length > 0) {
        return json({ success: true, property_id: data[0].id });
      }
      return json({ error: 'Property not found by suffix' }, 404);
    }

    // ── List ─────────────────────────────────────────────────────────────
    const page = parseInt(p('page') || '1');
    const limit = Math.min(parseInt(p('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('properties')
      .select(LIST_FIELDS, { count: 'exact' })
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false });

    const type = p('type');
    const operation = p('operation');
    const city = p('city');
    const minPrice = p('min_price');
    const maxPrice = p('max_price');
    const minBedrooms = p('min_bedrooms');
    const minSurface = p('min_surface');
    const search = p('search');
    const since = p('since');

    if (type) query = query.eq('property_type', type);
    if (operation) query = query.eq('operation', operation);
    if (city) query = query.ilike('city', `%${sanitizeLike(city, 50)}%`);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    if (minBedrooms) query = query.gte('bedrooms', parseInt(minBedrooms));
    if (minSurface) query = query.gte('surface_area', parseFloat(minSurface));
    if (search) {
      const s = sanitizeLike(search);
      query = query.or(`title.ilike.%${s}%,city.ilike.%${s}%,description.ilike.%${s}%`);
    }
    if (since) query = query.gte('updated_at', since);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const { data: citiesData } = await supabase
      .from('properties')
      .select('city')
      .in('status', ACTIVE_STATUSES)
      .not('city', 'is', null);

    const cities = [...new Set((citiesData || []).map((c: any) => c.city).filter(Boolean))].sort();

    const enriched = (data || []).map((p: any) => ({
      ...p,
      is_magnos: (p.price || 0) >= 500000 && (p.images?.length || 0) >= 20,
    }));

    return json({
      success: true,
      properties: enriched,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
      filters: { cities },
    });
  } catch (err) {
    console.error('Error:', err);
    return json({ error: String(err) }, 500);
  }
});
