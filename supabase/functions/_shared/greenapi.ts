/**
 * Shared Green API WhatsApp sender with GLOBAL daily rate limiting.
 * Import: import { sendWhatsApp } from '../_shared/greenapi.ts';
 *
 * Rate limiting: max 12 messages/day across ALL functions.
 * Uses wa_daily_counter table + wa_increment_daily() DB function.
 *
 * Also respects the global messaging kill switch (app_config.messaging_enabled).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WA_GLOBAL_DAILY_LIMIT = 12;

function normalizePhone(phone: string): string {
  let digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 9) digits = '34' + digits;
  return digits;
}

export async function sendWhatsApp(
  phone: string,
  text: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const idInstance = Deno.env.get('GREENAPI_ID_INSTANCE');
  const apiToken = Deno.env.get('GREENAPI_API_TOKEN');

  if (!idInstance || !apiToken) {
    console.error('[GreenAPI] GREENAPI_ID_INSTANCE or GREENAPI_API_TOKEN not configured');
    return { ok: false, error: 'Green API credentials not configured' };
  }

  // ── Global kill switch check ──
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { data: cfg } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'messaging_enabled')
      .single();
    if (cfg?.value !== 'true') {
      console.warn('[GreenAPI] Messaging globally disabled. Blocked WhatsApp send.');
      return { ok: false, error: 'Envíos desactivados globalmente' };
    }
  } catch {
    console.warn('[GreenAPI] Could not check messaging_enabled, blocking send');
    return { ok: false, error: 'Envíos desactivados (config no disponible)' };
  }

  // ── Global daily rate limit check ──
  try {
    const { data: newCount, error: rpcErr } = await supabase.rpc('wa_increment_daily');
    if (rpcErr) {
      console.error('[GreenAPI] Rate limit check failed:', rpcErr.message);
    } else if (newCount > WA_GLOBAL_DAILY_LIMIT) {
      console.warn(`[GreenAPI] Daily limit reached (${newCount}/${WA_GLOBAL_DAILY_LIMIT}). Blocking send.`);
      return { ok: false, error: `Límite diario de WhatsApp alcanzado (${WA_GLOBAL_DAILY_LIMIT}/día)` };
    } else {
      console.log(`[GreenAPI] Daily counter: ${newCount}/${WA_GLOBAL_DAILY_LIMIT}`);
    }
  } catch (e) {
    console.error('[GreenAPI] Rate limit error (allowing send):', e);
  }

  const chatId = `${normalizePhone(phone)}@c.us`;
  const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: text }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.message || `Green API error [${res.status}]`;
      console.error(`[GreenAPI] Send failed: ${errMsg}`);
      return { ok: false, error: errMsg };
    }

    console.log(`[GreenAPI] Message sent to ${chatId}, id: ${data.idMessage}`);
    return { ok: true, id: data.idMessage };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[GreenAPI] Send error: ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}
