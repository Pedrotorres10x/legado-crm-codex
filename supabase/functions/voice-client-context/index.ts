import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, json } from "../_shared/cors.ts";

type ContactRow = {
  id: string;
  full_name: string;
  city: string | null;
  source_ref: string | null;
  phone: string | null;
  phone2: string | null;
};

function normalizePhone(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '').replace(/^(34|0034)/, '');
}

function matchesPhone(contact: ContactRow, number: string) {
  const target = normalizePhone(number);
  if (!target) return false;
  return normalizePhone(contact.phone) === target || normalizePhone(contact.phone2) === target;
}

function readParam(url: URL, key: string) {
  return url.searchParams.get(key) ?? '';
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const expectedSecret = Deno.env.get('VOICE_CLIENT_CONTEXT_SECRET');
    if (expectedSecret) {
      const provided = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      if (provided !== expectedSecret) {
        return json({ error: 'Unauthorized' }, 401);
      }
    }

    const url = new URL(req.url);
    const callerId = readParam(url, 'caller_id');
    const agentId = readParam(url, 'agent_id');
    const calledNumber = readParam(url, 'called_number');
    const callSid = readParam(url, 'call_sid');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let matchedContact: ContactRow | null = null;
    if (callerId || calledNumber) {
      const { data } = await supabase
        .from('contacts')
        .select('id, full_name, city, source_ref, phone, phone2')
        .eq('opt_out', false)
        .limit(500);

      matchedContact = ((data ?? []) as ContactRow[]).find((contact) => (
        matchesPhone(contact, callerId) || matchesPhone(contact, calledNumber)
      )) ?? null;
    }

    const dynamicVariables = {
      contact_name: matchedContact?.full_name ?? 'cliente',
      purpose_code: matchedContact?.source_ref?.startsWith('statefox:') ? 'statefox_disposicion_positiva' : 'sanitize_validar_decisor',
      source_ref: matchedContact?.source_ref ?? '',
      city: matchedContact?.city ?? 'Benidorm',
    };

    return json({
      type: 'conversation_initiation_client_data',
      dynamic_variables: dynamicVariables,
      conversation_config_override: {
        agent: {
          first_message: 'Hola, soy Alicia, la asistente virtual de Legado Inmobiliaria. Estamos en Benidorm y le llamo porque he visto el anuncio de una vivienda en portales. Quería preguntarle muy rápido si sigue disponible.',
          language: 'es',
        },
      },
      user_id: matchedContact?.id ?? callSid ?? callerId ?? agentId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
