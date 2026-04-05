import { ElevenLabsClient } from "npm:@elevenlabs/elevenlabs-js";

export type ElevenLabsTelephonyMode = 'twilio' | 'sip-trunk';

export type ElevenLabsDispatchInput = {
  toNumber: string;
  dynamicVariables?: Record<string, string>;
  prompt?: string | null;
  firstMessage?: string | null;
  callRecordingEnabled?: boolean;
};

export type ElevenLabsDispatchResult = {
  success: boolean;
  message?: string;
  conversation_id?: string | null;
  callSid?: string | null;
  sip_call_id?: string | null;
};

export type ElevenLabsWebhookEvent = {
  type: string;
  data: Record<string, unknown>;
  event_timestamp?: string | number;
};

type ElevenLabsConfig = {
  apiKey: string;
  agentId: string;
  agentPhoneNumberId: string;
  telephonyMode: ElevenLabsTelephonyMode;
};

function getConfig(): ElevenLabsConfig {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY') ?? '';
  const agentId = Deno.env.get('ELEVENLABS_AGENT_ID') ?? '';
  const agentPhoneNumberId = Deno.env.get('ELEVENLABS_AGENT_PHONE_NUMBER_ID') ?? '';
  const telephonyMode = (Deno.env.get('ELEVENLABS_TELEPHONY_MODE') ?? 'sip-trunk') as ElevenLabsTelephonyMode;

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not configured');
  if (!agentId) throw new Error('ELEVENLABS_AGENT_ID is not configured');
  if (!agentPhoneNumberId) throw new Error('ELEVENLABS_AGENT_PHONE_NUMBER_ID is not configured');
  if (telephonyMode !== 'twilio' && telephonyMode !== 'sip-trunk') {
    throw new Error('ELEVENLABS_TELEPHONY_MODE must be "twilio" or "sip-trunk"');
  }

  return { apiKey, agentId, agentPhoneNumberId, telephonyMode };
}

export function normalizeDialNumber(value: string): string {
  return value.replace(/[^\d+]/g, '').trim();
}

export async function dispatchOutboundCall(input: ElevenLabsDispatchInput): Promise<ElevenLabsDispatchResult> {
  const config = getConfig();
  const toNumber = normalizeDialNumber(input.toNumber);
  if (!toNumber) throw new Error('Destination phone number is empty');

  const endpoint = config.telephonyMode === 'twilio'
    ? 'https://api.elevenlabs.io/v1/convai/twilio/outbound-call'
    : 'https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': config.apiKey,
    },
    body: JSON.stringify({
      agent_id: config.agentId,
      agent_phone_number_id: config.agentPhoneNumberId,
      to_number: toNumber,
      call_recording_enabled: input.callRecordingEnabled ?? true,
      conversation_initiation_client_data: {
        dynamic_variables: input.dynamicVariables ?? {},
        conversation_config_override: {
          agent: {
            prompt: input.prompt ?? null,
            first_message: input.firstMessage ?? null,
            language: 'es',
          },
        },
      },
    }),
  });

  const rawText = await response.text();
  let parsed: ElevenLabsDispatchResult | null = null;

  try {
    parsed = rawText ? JSON.parse(rawText) as ElevenLabsDispatchResult : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(`ElevenLabs outbound call failed [${response.status}]: ${rawText}`);
  }

  return parsed ?? { success: true };
}

export async function verifyWebhookEvent(payload: string, signature: string | null): Promise<ElevenLabsWebhookEvent> {
  const secret = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET');
  if (!secret) {
    throw new Error('ELEVENLABS_WEBHOOK_SECRET is not configured');
  }

  if (!signature) {
    throw new Error('Missing elevenlabs-signature header');
  }

  const apiKey = Deno.env.get('ELEVENLABS_API_KEY') ?? 'webhook-only';
  const client = new ElevenLabsClient({ apiKey });
  const event = await client.webhooks.constructEvent(payload, signature, secret);
  return event as ElevenLabsWebhookEvent;
}
