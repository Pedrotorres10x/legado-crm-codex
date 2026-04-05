import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, json } from "../_shared/cors.ts";
import { dispatchOutboundCall } from "../_shared/elevenlabs.ts";

type DispatchBody = {
  campaign_id?: string;
  limit?: number;
  dry_run?: boolean;
};

type VoiceCampaignRow = {
  id: string;
  name: string;
  purpose_code: string;
  purpose_prompt: string | null;
  status: string;
  created_by: string;
};

type VoiceCampaignContactRow = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  assigned_agent_id: string | null;
  display_name: string;
  phone: string;
  source_ref: string | null;
  city: string | null;
  status: string;
  attempt_count: number;
  handoff_task_id: string | null;
  payload: Record<string, unknown> | null;
};

type VoiceContactFlagRow = {
  contact_id: string;
  do_not_call: boolean;
  hostile_flag: boolean;
  wrong_number_flag: boolean;
  intermediary_flag: boolean;
};

async function requireCoordinator(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: json({ error: 'Unauthorized' }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return { error: json({ error: 'Unauthorized' }, 401) };
  }

  const userId = claimsData.claims.sub as string;
  const service = createClient(supabaseUrl, serviceKey);
  const { data: roleRow, error: roleError } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'coordinadora'])
    .limit(1);

  if (roleError || !roleRow?.length) {
    return { error: json({ error: 'Forbidden' }, 403) };
  }

  return { userId, service };
}

function buildFirstMessage(purposeCode: string, displayName: string) {
  if (purposeCode === 'statefox_disposicion_positiva') {
    return `Hola ${displayName}, te llamo para una consulta muy breve sobre tu anuncio.`;
  }
  return `Hola ${displayName}, te llamo para confirmar un dato rápido y no te robo tiempo.`;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const auth = await requireCoordinator(req);
    if ('error' in auth) return auth.error;

    const { service } = auth;
    const body = await req.json() as DispatchBody;
    if (!body.campaign_id) {
      return json({ error: 'campaign_id is required' }, 400);
    }

    const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);

    const { data: campaignData, error: campaignError } = await service
      .from('voice_campaigns')
      .select('id, name, purpose_code, purpose_prompt, status, created_by')
      .eq('id', body.campaign_id)
      .single();

    const campaign = campaignData as VoiceCampaignRow | null;

    if (campaignError || !campaign) {
      return json({ error: 'Campaign not found' }, 404);
    }

    const { data: queueData, error: queueError } = await service
      .from('voice_campaign_contacts')
      .select('id, campaign_id, contact_id, assigned_agent_id, display_name, phone, source_ref, city, status, attempt_count, handoff_task_id, payload')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    const queueRows = (queueData ?? []) as VoiceCampaignContactRow[];

    if (queueError) {
      throw queueError;
    }

    const contactIds = (queueRows ?? [])
      .map((row) => row.contact_id)
      .filter((value): value is string => Boolean(value));

    const flagsByContact = new Map<string, VoiceContactFlagRow>();
    if (contactIds.length > 0) {
      const { data: flagsData } = await service
        .from('voice_contact_flags')
        .select('contact_id, do_not_call, hostile_flag, wrong_number_flag, intermediary_flag')
        .in('contact_id', contactIds);

      const flags = (flagsData ?? []) as VoiceContactFlagRow[];

      for (const flag of flags ?? []) {
        flagsByContact.set(flag.contact_id, flag);
      }
    }

    if (!queueRows?.length) {
      return json({ ok: true, dispatched: 0, skipped: 0, message: 'No pending contacts in campaign' });
    }

    const launchedAt = new Date().toISOString();
    await service
      .from('voice_campaigns')
      .update({
        status: 'running',
        launched_at: campaign.status === 'draft' ? launchedAt : undefined,
      })
      .eq('id', campaign.id);

    const dispatched: Array<Record<string, unknown>> = [];
    const skipped: Array<Record<string, unknown>> = [];

    for (const row of queueRows) {
      const flags = row.contact_id ? flagsByContact.get(row.contact_id) : null;
      if (flags?.do_not_call || flags?.hostile_flag || flags?.wrong_number_flag) {
        await service
          .from('voice_campaign_contacts')
          .update({
            status: 'excluded',
            outcome_code: flags.do_not_call ? 'do_not_call' : flags.hostile_flag ? 'hostile_do_not_call' : 'wrong_number',
            notes: 'Excluido por flags previos antes del dispatch',
          })
          .eq('id', row.id);

        skipped.push({
          campaign_contact_id: row.id,
          reason: 'flagged',
        });
        continue;
      }

      if (flags?.intermediary_flag && campaign.purpose_code === 'statefox_disposicion_positiva') {
        await service
          .from('voice_campaign_contacts')
          .update({
            status: 'excluded',
            outcome_code: 'intermediary_agency',
            notes: 'Excluido por intermediario detectado previamente',
          })
          .eq('id', row.id);

        skipped.push({
          campaign_contact_id: row.id,
          reason: 'intermediary',
        });
        continue;
      }

      const sanitize = (s: string | null | undefined, maxLen = 100) =>
        (s ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, maxLen);

      const dynamicVariables = {
        campaign_id: campaign.id,
        campaign_contact_id: row.id,
        contact_id: row.contact_id ?? '',
        purpose_code: campaign.purpose_code,
        contact_name: sanitize(row.display_name, 80),
        city: sanitize(row.city, 60),
        source_ref: sanitize(row.source_ref, 60),
      };

      if (body.dry_run) {
        dispatched.push({
          campaign_contact_id: row.id,
          to_number: row.phone,
          dynamic_variables: dynamicVariables,
        });
        continue;
      }

      const result = await dispatchOutboundCall({
        toNumber: row.phone,
        dynamicVariables,
        prompt: campaign.purpose_prompt,
        firstMessage: buildFirstMessage(campaign.purpose_code, row.display_name),
      });

      const nowIso = new Date().toISOString();
      await service.from('voice_campaign_contacts').update({
        status: 'calling',
        attempt_count: row.attempt_count + 1,
        last_attempt_at: nowIso,
      }).eq('id', row.id);

      await service.from('voice_call_runs').insert({
        campaign_contact_id: row.id,
        provider: 'elevenlabs',
        provider_call_id: result.conversation_id ?? result.callSid ?? result.sip_call_id ?? null,
        raw_status: result.success ? 'initiated' : 'unknown',
        started_at: nowIso,
        outcome_payload: result,
      });

      dispatched.push({
        campaign_contact_id: row.id,
        provider_call_id: result.conversation_id ?? result.callSid ?? result.sip_call_id ?? null,
      });
    }

    return json({
      ok: true,
      dry_run: body.dry_run === true,
      dispatched: dispatched.length,
      skipped: skipped.length,
      dispatched_items: dispatched,
      skipped_items: skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
