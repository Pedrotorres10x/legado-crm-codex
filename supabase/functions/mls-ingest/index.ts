import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();

    // Accept single property or array
    const properties = Array.isArray(body) ? body : [body];

    const results: { id: string; status: string }[] = [];

    for (const prop of properties) {
      if (!prop.mls_property_id || !prop.title) {
        results.push({ id: prop.mls_property_id || 'unknown', status: 'skipped: missing required fields' });
        continue;
      }

      // Upsert into mls_incoming
      const { error } = await client.from('mls_incoming').upsert({
        mls_property_id: prop.mls_property_id,
        mls_agency_name: prop.agency_name || null,
        title: prop.title,
        price: prop.price || null,
        property_type: prop.property_type || null,
        operation_type: prop.operation_type || null,
        city: prop.city || prop.zone || null,
        zone: prop.zone || null,
        address: prop.address || null,
        bedrooms: prop.bedrooms || null,
        bathrooms: prop.bathrooms || null,
        surface_area: prop.surface_area || prop.area_sqm || null,
        description: prop.description || null,
        images: prop.images || null,
        features: prop.features || null,
        reference_code: prop.reference_code || null,
        energy_certificate: prop.energy_certificate || null,
        latitude: prop.latitude || null,
        longitude: prop.longitude || null,
        raw_data: prop,
        status: 'pendiente',
      }, { onConflict: 'mls_property_id' });

      if (error) {
        results.push({ id: prop.mls_property_id, status: 'error: ' + error.message });
        continue;
      }

      // Notify admins/coordinadoras
      const { data: admins } = await client
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'coordinadora']);

      for (const admin of admins || []) {
        await client.from('notifications').insert({
          event_type: 'new_property',
          entity_type: 'mls_incoming',
          entity_id: prop.mls_property_id,
          title: '🏘️ Nueva propiedad MLS: ' + prop.title,
          description: `${prop.agency_name || 'Agencia MLS'} · ${prop.city || ''} · ${prop.price ? prop.price.toLocaleString('es-ES') + ' €' : ''}`,
          agent_id: admin.user_id,
        });
      }

      results.push({ id: prop.mls_property_id, status: 'ok' });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[mls-ingest]', err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
