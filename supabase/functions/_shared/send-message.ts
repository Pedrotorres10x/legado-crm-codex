/**
 * Unified message sender — routes to Green API (WhatsApp) or Brevo (Email).
 * Import: import { sendMessage } from '../_shared/send-message.ts';
 *
 * Respects the global kill switch (app_config.messaging_enabled).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendWhatsApp } from './greenapi.ts';
import { sendBrevoEmail } from './brevo.ts';

export interface SendMessageOpts {
  channel: 'whatsapp' | 'email';
  /** Phone number for WhatsApp, email address for Email */
  to: string;
  contactName?: string;
  text: string;
  subject?: string;
  html?: string;
  replyTo?: string;
}

export interface SendMessageResult {
  ok: boolean;
  provider_message_id?: string;
  error?: string;
}

/** Check global messaging kill switch */
async function isMessagingEnabled(): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'messaging_enabled')
      .single();
    return data?.value === 'true';
  } catch {
    // If we can't check, default to blocked for safety
    console.warn('[sendMessage] Could not check messaging_enabled, blocking send');
    return false;
  }
}

export async function sendMessage(opts: SendMessageOpts): Promise<SendMessageResult> {
  // ── Global kill switch ──
  const enabled = await isMessagingEnabled();
  if (!enabled) {
    console.warn(`[sendMessage] Messaging globally disabled. Blocked ${opts.channel} to ${opts.to}`);
    return { ok: false, error: 'Envíos desactivados globalmente' };
  }

  if (opts.channel === 'whatsapp') {
    const result = await sendWhatsApp(opts.to, opts.text);
    return {
      ok: result.ok,
      provider_message_id: result.id,
      error: result.error,
    };
  }

  if (opts.channel === 'email') {
    if (!opts.to) {
      return { ok: false, error: 'No email address provided' };
    }

    try {
      await sendBrevoEmail(
        [{ email: opts.to, name: opts.contactName || opts.to }],
        opts.subject || '(sin asunto)',
        opts.html || opts.text,
        opts.replyTo ? { email: opts.replyTo } : undefined,
      );
      return { ok: true };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Email send error';
      return { ok: false, error: errMsg };
    }
  }

  return { ok: false, error: `Unsupported channel: ${opts.channel}` };
}
