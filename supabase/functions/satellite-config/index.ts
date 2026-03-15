import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/** Maps satellite_key → env var name holding its API secret */
const SECRET_MAP: Record<string, string> = {
  legado: 'WEBSITE_API_KEY',
  faktura: 'FAKTURA_WEBHOOK_SECRET',
  multichannel: 'MULTICHANNEL_WEBHOOK_SECRET',
  mls: 'MLS_AGENCY_ID',
  linkinbio: 'WEBSITE_API_KEY', // shares the website key
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (!key) return json({ error: 'Missing ?key= parameter' }, 400);

    // Validate API key
    const apiKey = req.headers.get('x-api-key') || '';
    const expectedEnv = SECRET_MAP[key];
    if (!expectedEnv) return json({ error: 'Unknown satellite key' }, 404);

    const expectedSecret = Deno.env.get(expectedEnv) || '';
    if (!expectedSecret || apiKey !== expectedSecret) {
      return json({ error: 'Invalid API key' }, 401);
    }

    // Use service role to bypass RLS for heartbeat update
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch config
    const { data: satellite, error } = await supabase
      .from('satellite_config')
      .select('*')
      .eq('satellite_key', key)
      .single();

    if (error || !satellite) {
      return json({ error: 'Satellite not found' }, 404);
    }

    if (!satellite.is_active) {
      return json({ error: 'Satellite is disabled', config: satellite.config }, 403);
    }

    // Update heartbeat (fire and forget)
    supabase
      .from('satellite_config')
      .update({ last_heartbeat: new Date().toISOString() })
      .eq('satellite_key', key)
      .then(({ error: hbErr }) => {
        if (hbErr) console.warn(`[satellite-config] heartbeat update failed for ${key}:`, hbErr.message);
      });

    return json({
      success: true,
      satellite_key: satellite.satellite_key,
      display_name: satellite.display_name,
      base_url: satellite.base_url,
      config: satellite.config,
      is_active: satellite.is_active,
    });
  } catch (err) {
    console.error('[satellite-config] error:', err);
    return json({ error: String(err) }, 500);
  }
});
