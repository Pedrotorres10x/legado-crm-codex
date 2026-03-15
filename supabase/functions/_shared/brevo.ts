/**
 * Shared Brevo (Sendinblue) email sender.
 * Import: import { sendBrevoEmail } from '../_shared/brevo.ts';
 */

const SENDER = { email: 'info@planhogar.es', name: 'Legado Colección' };

export async function sendBrevoEmail(
  recipients: { email: string; name: string }[],
  subject: string,
  htmlContent: string,
  replyTo?: { email: string; name?: string },
): Promise<void> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) {
    console.error('[Brevo] BREVO_API_KEY not configured, skipping email');
    return;
  }

  if (recipients.length === 0) {
    console.log('[Brevo] No recipients, skipping email');
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: SENDER,
      to: recipients.map((r) => ({ email: r.email, name: r.name })),
      subject,
      htmlContent,
      ...(replyTo ? { replyTo: { email: replyTo.email, name: replyTo.name || replyTo.email } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo API error [${res.status}]: ${text}`);
  }

  console.log(`[Brevo] Email sent to ${recipients.map((r) => r.email).join(', ')}`);
}
