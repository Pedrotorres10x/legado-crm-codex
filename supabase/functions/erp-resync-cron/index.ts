import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * erp-resync-cron — Periodic resync check
 *
 * All satellites now use pull-based data bridges:
 * - Legado Colección → reads via public-properties API
 * - MLS Benidorm → shared database
 * - Faktura → crm-faktura-data bridge
 *
 * This cron function logs audit entries for properties that changed
 * since the last sync check, ensuring we have visibility into data freshness.
 * No webhook dispatches are made.
 */

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find last audit check timestamp
    const { data: lastSync } = await supabase
      .from('erp_sync_logs')
      .select('created_at')
      .eq('target', 'resync-audit')
      .eq('status', 'ok')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const since = lastSync?.created_at || '2000-01-01T00:00:00Z';

    // Count properties updated since last check
    const { count, error: countErr } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'disponible')
      .gt('updated_at', since);

    if (countErr) {
      console.error('[erp-resync-cron] count error:', countErr.message);
      return json({ error: countErr.message }, 500);
    }

    const changed = count || 0;
    console.log(`[erp-resync-cron] ${changed} properties changed since ${since}`);

    // Log audit entry
    await supabase.from('erp_sync_logs').insert({
      target: 'resync-audit',
      event: 'resync_check',
      status: 'ok',
      payload: { properties_changed: changed, since },
    });

    return json({ ok: true, properties_changed: changed, since });
  } catch (err) {
    console.error('[erp-resync-cron] error:', err);
    return json({ error: String(err) }, 500);
  }
});
