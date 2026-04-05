import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * portal-refresh-cron — Daily property freshness refresh
 *
 * Touches `updated_at` on ALL available properties so every portal
 * (Fotocasa, Kyero, Pisos.com, etc.) shows "Actualizado hoy".
 *
 * Runs every 12 hours (00:00 and 12:00 UTC) via pg_cron.
 */

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Get ALL available properties
    const { data: props, error: queryErr } = await supabase
      .from('properties')
      .select('id')
      .eq('status', 'disponible');

    if (queryErr) {
      console.error('[portal-refresh] query error:', queryErr.message);
      return json({ error: queryErr.message }, 500);
    }

    const ids = (props || []).map((p: { id: string }) => p.id);
    console.log(`[portal-refresh] ${ids.length} available properties to refresh`);

    // 2. Touch updated_at in batches of 100
    let refreshed = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error: updateErr } = await supabase
        .from('properties')
        .update({ updated_at: now })
        .in('id', batch);

      if (updateErr) {
        console.error(`[portal-refresh] batch update error:`, updateErr.message);
      } else {
        refreshed += batch.length;
      }
    }

    console.log(`[portal-refresh] ${refreshed} properties refreshed`);

    // 3. Regenerate active XML feeds so portals like 1001 Portales and TodoPisos
    // always have a fresh payload even if they have not re-polled the URL yet.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const { data: xmlFeeds, error: xmlFeedsError } = await supabase
      .from('portal_feeds')
      .select('id, portal_name, display_name, feed_token')
      .neq('portal_name', 'fotocasa')
      .eq('is_active', true);

    if (xmlFeedsError) {
      console.error('[portal-refresh] xml feeds query error:', xmlFeedsError.message);
    }

    const xmlResults: Array<Record<string, unknown>> = [];
    for (const feed of xmlFeeds || []) {
      const feedUrl = `${supabaseUrl}/functions/v1/portal-xml-feed?token=${encodeURIComponent(feed.feed_token)}`;
      try {
        const response = await fetch(feedUrl);
        const body = await response.text();
        xmlResults.push({
          portal_name: feed.portal_name,
          display_name: feed.display_name,
          ok: response.ok,
          status: response.status,
          bytes: body.length,
        });
      } catch (xmlError) {
        console.error(`[portal-refresh] xml feed refresh failed for ${feed.portal_name}:`, xmlError);
        xmlResults.push({
          portal_name: feed.portal_name,
          display_name: feed.display_name,
          ok: false,
          status: 0,
          error: String(xmlError),
        });
      }
    }

    // 4. Recover any stale Fotocasa run before starting another batch sequence.
    try {
      const watchdogRes = await fetch(`${supabaseUrl}/functions/v1/fotocasa-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
        },
        body: JSON.stringify({ action: 'watchdog', batch_size: 10 }),
      });
      console.log(`[portal-refresh] fotocasa watchdog triggered, status: ${watchdogRes.status}`);
      await watchdogRes.text();
    } catch (fcErr) {
      console.error('[portal-refresh] fotocasa watchdog call failed:', fcErr);
    }

    // 4b. Trigger Fotocasa full re-sync
    try {
      const fcRes = await fetch(`${supabaseUrl}/functions/v1/fotocasa-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
        },
        body: JSON.stringify({ action: 'sync_all', batch_size: 10, offset: 0 }),
      });
      console.log(`[portal-refresh] fotocasa-sync triggered, status: ${fcRes.status}`);
      await fcRes.text();
    } catch (fcErr) {
      console.error('[portal-refresh] fotocasa-sync call failed:', fcErr);
    }

    // 4c. Purge stale/orphaned ads from Fotocasa (properties no longer available)
    try {
      const staleRes = await fetch(`${supabaseUrl}/functions/v1/fotocasa-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
        },
        body: JSON.stringify({ action: 'delete_stale' }),
      });
      const staleData = await staleRes.json().catch(() => ({}));
      console.log(`[portal-refresh] delete_stale completed: ${staleData.deleted || 0} ads removed`);
    } catch (staleErr) {
      console.error('[portal-refresh] delete_stale call failed:', staleErr);
    }

    // 5. Log summary
    await supabase.from('erp_sync_logs').insert({
      target: 'portal-refresh',
      event: 'refresh_cron',
      status: 'ok',
      payload: {
        refreshed,
        total: ids.length,
        xml_feeds_regenerated: xmlResults.filter((item) => item.ok).length,
        xml_results: xmlResults,
      },
    });

    return json({
      ok: true,
      refreshed,
      total: ids.length,
      xml_feeds_regenerated: xmlResults.filter((item) => item.ok).length,
      xml_results: xmlResults,
    });
  } catch (err) {
    console.error('[portal-refresh] error:', err);
    return json({ error: String(err) }, 500);
  }
});
