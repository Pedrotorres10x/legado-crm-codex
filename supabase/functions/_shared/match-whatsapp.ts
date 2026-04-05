import { sendMessage } from './send-message.ts';
import { isPropertyInterestAutomationEnabled } from './automation-outbound.ts';
import {
  type SupportedContactLanguage,
  detectContactLanguage,
  normalizeContactLanguage,
  resolveContactLanguage,
} from './contact-language.ts';

export type SupportedLeadLanguage = SupportedContactLanguage;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildPropertyUrl(property: { id: string; title?: string | null; city?: string | null; province?: string | null }) {
  const titleSlug = slugify(property.title || 'propiedad');
  const citySlug = slugify(property.city || property.province || '');
  const uuidSuffix = String(property.id || '').replace(/-/g, '').slice(-5);
  const propertySlug = citySlug
    ? `${titleSlug}-${citySlug}-${uuidSuffix}`
    : `${titleSlug}-${uuidSuffix}`;

  return `https://legadocoleccion.es/propiedad/${propertySlug}`;
}

export const normalizeLeadLanguage = normalizeContactLanguage;
export const detectLeadLanguage = detectContactLanguage;
export const resolveLeadLanguage = resolveContactLanguage;

export function buildWhatsAppOpener(contactName?: string | null, language: SupportedLeadLanguage = 'es') {
  const firstName = String(contactName || '').trim().split(/\s+/)[0] || '';
  if (language === 'en') {
    return firstName
      ? `Hi ${firstName}. I'm Alicia, from Legado. I'm messaging you about the property you saw. If you're interested, I'll send you the link here.`
      : `Hi. I'm Alicia, from Legado. I'm messaging you about the property you saw. If you're interested, I'll send you the link here.`;
  }
  if (language === 'fr') {
    return firstName
      ? `Bonjour ${firstName}. Je suis Alicia, de Legado. Je vous écris au sujet du bien que vous avez vu. Si cela vous intéresse, je vous envoie le lien ici.`
      : `Bonjour. Je suis Alicia, de Legado. Je vous écris au sujet du bien que vous avez vu. Si cela vous intéresse, je vous envoie le lien ici.`;
  }
  if (language === 'de') {
    return firstName
      ? `Hallo ${firstName}. Ich bin Alicia von Legado. Ich schreibe dir wegen der Immobilie, die du gesehen hast. Wenn du Interesse hast, schicke ich dir den Link hier.`
      : `Hallo. Ich bin Alicia von Legado. Ich schreibe dir wegen der Immobilie, die du gesehen hast. Wenn du Interesse hast, schicke ich dir den Link hier.`;
  }
  return firstName
    ? `Hola ${firstName}. Soy Alicia, de Legado. Te escribo por la vivienda que has visto. Si te interesa, te paso el enlace por aquí.`
    : `Hola. Soy Alicia, de Legado. Te escribo por la vivienda que has visto. Si te interesa, te paso el enlace por aquí.`;
}

export function buildWhatsAppFollowUp(contactName: string | null | undefined, propertyUrl: string, language: SupportedLeadLanguage = 'es') {
  return propertyUrl;
}

export function buildWhatsAppReminder(contactName?: string | null, language: SupportedLeadLanguage = 'es') {
  const firstName = String(contactName || '').trim().split(/\s+/)[0] || '';
  if (language === 'en') {
    return firstName
      ? `Hi ${firstName}. I'm messaging you again about the property you saw. If you're still interested, I'll send you the link now.`
      : `Hi. I'm messaging you again about the property you saw. If you're still interested, I'll send you the link now.`;
  }
  if (language === 'fr') {
    return firstName
      ? `Bonjour ${firstName}. Je vous réécris au sujet du bien que vous avez vu. Si cela vous intéresse toujours, je vous envoie le lien maintenant.`
      : `Bonjour. Je vous réécris au sujet du bien que vous avez vu. Si cela vous intéresse toujours, je vous envoie le lien maintenant.`;
  }
  if (language === 'de') {
    return firstName
      ? `Hallo ${firstName}. Ich schreibe dir noch einmal wegen der Immobilie, die du gesehen hast. Wenn du noch Interesse hast, schicke ich dir jetzt den Link.`
      : `Hallo. Ich schreibe dir noch einmal wegen der Immobilie, die du gesehen hast. Wenn du noch Interesse hast, schicke ich dir jetzt den Link.`;
  }
  return firstName
    ? `Hola ${firstName}. Te escribo de nuevo por la vivienda que viste. Si todavía te interesa, te mando el enlace ahora.`
    : `Hola. Te escribo de nuevo por la vivienda que viste. Si todavía te interesa, te mando el enlace ahora.`;
}

export function buildWhatsAppFinalReminder(contactName?: string | null, language: SupportedLeadLanguage = 'es') {
  const firstName = String(contactName || '').trim().split(/\s+/)[0] || '';
  if (language === 'en') {
    return firstName
      ? `Hi ${firstName}. I won't bother you again about this. If you're still interested in the property, I'll send you the link here.`
      : `Hi. I won't bother you again about this. If you're still interested in the property, I'll send you the link here.`;
  }
  if (language === 'fr') {
    return firstName
      ? `Bonjour ${firstName}. Je ne vous dérange plus avec cela. Si le bien vous intéresse toujours, je vous envoie le lien ici.`
      : `Bonjour. Je ne vous dérange plus avec cela. Si le bien vous intéresse toujours, je vous envoie le lien ici.`;
  }
  if (language === 'de') {
    return firstName
      ? `Hallo ${firstName}. Ich störe dich damit nicht weiter. Wenn du noch Interesse an der Immobilie hast, schicke ich dir den Link hier.`
      : `Hallo. Ich störe dich damit nicht weiter. Wenn du noch Interesse an der Immobilie hast, schicke ich dir den Link hier.`;
  }
  return firstName
    ? `Hola ${firstName}. No te molesto más con esto. Si la vivienda todavía te interesa, te paso el enlace por aquí.`
    : `Hola. No te molesto más con esto. Si la vivienda todavía te interesa, te paso el enlace por aquí.`;
}

export async function sendPropertyInterestOpener(params: {
  supabase: { from: (table: string) => { select: (...args: unknown[]) => unknown; insert: (...args: unknown[]) => PromiseLike<unknown> | unknown } };
  contact: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
    phone2?: string | null;
    agent_id?: string | null;
    gdpr_consent?: boolean | null;
    opt_out?: boolean | null;
  };
  property: {
    id: string;
    title?: string | null;
    city?: string | null;
    province?: string | null;
  } | null;
  demandId?: string | null;
  source: string;
  preferredLanguage?: string | null;
  languageSamples?: Array<string | null | undefined>;
}) {
  const { supabase, contact, property, demandId, source, preferredLanguage, languageSamples = [] } = params;
  const automationEnabled = await isPropertyInterestAutomationEnabled();
  if (!automationEnabled) return { ok: false, skipped: 'automation_disabled' };

  if (!property?.id) return { ok: false, skipped: 'missing_property' };
  if (contact.opt_out) return { ok: false, skipped: 'opt_out' };
  if (contact.gdpr_consent === false) return { ok: false, skipped: 'missing_gdpr' };

  const destination = contact.phone || contact.phone2;
  if (!destination) return { ok: false, skipped: 'missing_phone' };

  const { data: existingLog } = await supabase
    .from('communication_logs')
    .select('id')
    .eq('contact_id', contact.id)
    .eq('channel', 'whatsapp')
    .eq('direction', 'outbound')
    .eq('source', 'cruces')
    .eq('property_id', property.id)
    .limit(1)
    .maybeSingle();

  if (existingLog) return { ok: true, skipped: 'already_sent' };

  const language = resolveLeadLanguage(preferredLanguage, contact.full_name, ...languageSamples);
  const openerText = buildWhatsAppOpener(contact.full_name, language);
  const propertyUrl = buildPropertyUrl(property);
  const result = await sendMessage({
    channel: 'whatsapp',
    to: destination,
    contactName: contact.full_name || undefined,
    text: openerText,
  });

  await supabase.from('communication_logs').insert({
    contact_id: contact.id,
    channel: 'whatsapp',
    direction: 'outbound',
    source: 'cruces',
    body_preview: openerText.slice(0, 500),
    provider_msg_id: result.provider_message_id || null,
    status: result.ok ? 'enviado' : 'error',
    error_message: result.ok ? null : (result.error || 'Send failed'),
    agent_id: contact.agent_id || null,
    property_id: property.id,
    demand_id: demandId || null,
    metadata: {
      trigger_source: source,
      match_whatsapp_stage: 'opener',
      property_url: propertyUrl,
      preferred_language: language,
      opener_attempt: 1,
      max_opener_attempts: 3,
      pending_response: true,
      immediate_property_interest: true,
    },
  });

  await supabase.from('interactions').insert({
    contact_id: contact.id,
    interaction_type: 'whatsapp',
    subject: `WhatsApp apertura: ${property.title || 'Propiedad'}`,
    description: result.ok
      ? 'WhatsApp inicial enviado automaticamente para abrir conversacion antes de compartir el enlace de la propiedad.'
      : `Fallo el WhatsApp inicial automatico antes de compartir el enlace: ${result.error || 'error desconocido'}`,
    agent_id: contact.agent_id || null,
    property_id: property.id,
  });

  return { ok: result.ok, error: result.error || null, propertyUrl };
}
