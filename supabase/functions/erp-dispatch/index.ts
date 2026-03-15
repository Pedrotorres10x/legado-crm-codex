import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

interface TargetConfig {
  url: string | null;
  secretHeader: string;
  secretEnv: string;
  secretFallback?: string;
  events: string[];
  eventMap: Record<string, string> | null;
}

/**
 * erp-dispatch — Webhook dispatcher
 *
 * All satellite systems have migrated to pull-based data bridges or
 * direct integrations. No push webhook targets remain.
 *
 * This function is kept for future webhook integrations and continues
 * to log events to erp_sync_logs for audit purposes.
 */
const DEFAULT_TARGETS: Record<string, Omit<TargetConfig, 'url'> & { url: string | null; urlSuffix: string }> = {};

/** Build TARGETS by reading URLs from satellite_config table */
async function buildTargets(supabase: any): Promise<Record<string, TargetConfig>> {
  const { data: satellites } = await supabase
    .from('satellite_config')
    .select('satellite_key, base_url, is_active')
    .in('satellite_key', Object.keys(DEFAULT_TARGETS));

  const targets: Record<string, TargetConfig> = {};
  for (const [key, def] of Object.entries(DEFAULT_TARGETS)) {
    const sat = satellites?.find((s: any) => s.satellite_key === key);
    const baseUrl = sat?.base_url || null;
    const isActive = sat?.is_active ?? true;
    targets[key] = {
      url: isActive && baseUrl ? baseUrl + def.urlSuffix : null,
      secretHeader: def.secretHeader,
      secretEnv: def.secretEnv,
      secretFallback: def.secretFallback,
      events: def.events,
      eventMap: def.eventMap,
    };
  }
  return targets;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { event, data } = await req.json();
    if (!event || !data) return json({ error: 'Missing event or data' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const TARGETS = await buildTargets(supabase);
    const results: Record<string, { ok: boolean; status: number | null }> = {};

    const dispatches = Object.entries(TARGETS).map(async ([name, config]) => {
      if (!config.events.includes(event)) return;

      const mappedEvent = config.eventMap?.[event] || event;
      const secret = Deno.env.get(config.secretEnv) || config.secretFallback || '';
      let logStatus = 'ok';
      let httpStatus: number | null = null;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;

      if (!config.url) {
        logStatus = 'pending';
        errorMessage = `URL no configurada para ${name}`;
      } else {
        try {
          const payload = { event: mappedEvent, data, timestamp: new Date().toISOString() };

          const res = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', [config.secretHeader]: secret },
            body: JSON.stringify(payload),
          });

          httpStatus = res.status;
          responseBody = await res.text();
          if (!res.ok) {
            logStatus = 'error';
            errorMessage = `${name} respondió con HTTP ${res.status}`;
          }
        } catch (err) {
          logStatus = 'error';
          errorMessage = String(err);
          console.error(`[erp-dispatch] ${name} error:`, err);
        }
      }

      results[name] = { ok: logStatus === 'ok', status: httpStatus };

      supabase
        .from('erp_sync_logs')
        .insert({
          target: name,
          event,
          status: logStatus,
          http_status: httpStatus,
          response_body: responseBody?.slice(0, 500) ?? null,
          error_message: errorMessage,
          payload: data,
        })
        .then(({ error: dbErr }) => {
          if (dbErr) console.warn(`[erp-dispatch] log error (${name}):`, dbErr.message);
        });
    });

    await Promise.all(dispatches);
    return json({ ok: true, event, targets: results });
  } catch (err) {
    console.error('[erp-dispatch] error:', err);
    return json({ error: String(err) }, 500);
  }
});
