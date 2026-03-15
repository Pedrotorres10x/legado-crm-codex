import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * Cron wrapper that calls prospecting-sequence with process_pending.
 * Scheduled every 2 hours.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const res = await fetch(`${supabaseUrl}/functions/v1/prospecting-sequence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ action: 'process_pending' }),
    });

    const result = await res.json();
    console.log('[prospecting-cron] Result:', result);
    return json(result);
  } catch (e) {
    console.error('[prospecting-cron] Error:', e);
    return json({ error: e.message }, 500);
  }
});
