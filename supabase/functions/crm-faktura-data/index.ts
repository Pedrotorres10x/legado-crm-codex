import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Validate API key
  const apiKey = req.headers.get('x-faktura-key') || '';
  const expected = Deno.env.get('FAKTURA_WEBHOOK_SECRET') || '';
  if (!expected || apiKey !== expected) {
    return json({ error: 'Invalid API key' }, 401);
  }

  const url = new URL(req.url);
  const resource = url.searchParams.get('resource');

  if (!resource) {
    return json({ error: 'Missing ?resource= parameter' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    if (resource === 'commissions') {
      const { data, error } = await supabase
        .from('commissions')
        .select('id, sale_price, agency_commission, agent_total, status, created_at, updated_at, property_id, agent_id, listing_agent_id, buying_agent_id, horus_bonus, horus_bonus_amount, agent_base_amount, agent_base_pct, listing_amount, buying_amount')
        .in('status', ['aprobado', 'pagado']);

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, count: data.length, data });
    }

    if (resource === 'profiles') {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url');

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, count: data.length, data });
    }

    if (resource === 'properties') {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, city, crm_reference, status, price, address');

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, count: data.length, data });
    }

    return json({ error: `Unknown resource: ${resource}. Valid: commissions, profiles, properties` }, 400);
  } catch (err) {
    console.error('[crm-faktura-data] error:', err);
    return json({ error: String(err) }, 500);
  }
});
