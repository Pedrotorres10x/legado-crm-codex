import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * mls-publish — Unified DB version
 *
 * No longer POSTs to an external MLS endpoint.
 * Simply updates `mls_listings` status. The MLS frontend reads
 * `properties` + `mls_listings` directly from this same database.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { action, property_id } = await req.json();
    if (!property_id) throw new Error('property_id required');

    const crm = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ─── PUBLISH ─────────────────────────────────────────────────────
    if (action === 'publish') {
      // Verify property exists AND is not from XML feed
      const { data: prop, error: propErr } = await crm
        .from('properties')
        .select('id, title, xml_id')
        .eq('id', property_id)
        .single();
      if (propErr || !prop) throw new Error('Property not found');

      // BLOCK: never publish XML-imported properties to MLS
      if (prop.xml_id) {
        console.warn(`[mls-publish] Blocked XML property ${property_id} (xml_id=${prop.xml_id})`);
        return json({ ok: false, error: 'XML properties cannot be published to MLS', blocked: true });
      }

      // Upsert mls_listings — MLS frontend reads properties + this table directly
      const { error: upsertErr } = await crm.from('mls_listings').upsert({
        property_id,
        status: 'published',
        published_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        error_message: null,
      }, { onConflict: 'property_id' });

      if (upsertErr) throw new Error(`Failed to update mls_listings: ${upsertErr.message}`);

      return json({ ok: true, property_id });
    }

    // ─── UNPUBLISH ───────────────────────────────────────────────────
    if (action === 'unpublish') {
      const { error: updateErr } = await crm.from('mls_listings').update({
        status: 'removed',
        last_synced_at: new Date().toISOString(),
      }).eq('property_id', property_id);

      if (updateErr) throw new Error(`Failed to update mls_listings: ${updateErr.message}`);

      return json({ ok: true });
    }

    throw new Error('Invalid action. Use "publish" or "unpublish".');

  } catch (err) {
    console.error('[mls-publish]', err);

    // Try to mark as error
    try {
      const { property_id } = await req.clone().json().catch(() => ({}));
      if (property_id) {
        const crm = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await crm.from('mls_listings').upsert({
          property_id,
          status: 'error',
          error_message: (err as Error).message,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'property_id' });
      }
    } catch (_) {}

    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
