import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, json } from "../_shared/cors.ts";
import { verifyWebhookEvent } from "../_shared/elevenlabs.ts";

type TranscriptTurn = {
  role?: string;
  message?: string;
  time_in_call_secs?: number;
};

type CallPayload = {
  agent_id?: string;
  conversation_id?: string;
  status?: string;
  transcript?: TranscriptTurn[];
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    termination_reason?: string;
  };
  analysis?: {
    evaluation_criteria_results?: Record<string, unknown>;
    data_collection_results?: Record<string, unknown>;
    call_successful?: string;
    transcript_summary?: string;
  };
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, string>;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readScalar(container: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = container[key];
    if (raw == null) continue;

    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const nested = raw as Record<string, unknown>;
      if (nested.value != null) return nested.value;
      if (nested.result != null) return nested.result;
      if (nested.boolean != null) return nested.boolean;
      if (nested.number != null) return nested.number;
      if (nested.score != null) return nested.score;
    }

    return raw;
  }
  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (['true', 'yes', 'si', 'sí', '1'].includes(value.toLowerCase())) return true;
    if (['false', 'no', '0'].includes(value.toLowerCase())) return false;
  }
  if (typeof value === 'number') return value !== 0;
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapOutcomeCode(rawValue: string | null, callSuccessful: string | null) {
  const normalized = (rawValue ?? '').toLowerCase().trim();
  if (!normalized) {
    return callSuccessful === 'success' ? 'neutral' : 'failed';
  }

  if (normalized.includes('positive_high')) return 'positive_high';
  if (normalized.includes('positive_medium')) return 'positive_medium';
  if (normalized.includes('wrong')) return 'wrong_number';
  if (normalized.includes('hostil')) return 'hostile_do_not_call';
  if (normalized.includes('intermed') || normalized.includes('agency') || normalized.includes('inmobili')) return 'intermediary_agency';
  if (normalized.includes('not_interested') || normalized.includes('sin_interes')) return 'not_interested';
  if (normalized.includes('neutral')) return 'neutral';
  return normalized.replace(/\s+/g, '_');
}

function buildTranscriptText(turns: TranscriptTurn[] | undefined) {
  return (turns ?? [])
    .map((turn) => {
      const role = turn.role === 'user' ? 'Cliente' : 'IA';
      const seconds = typeof turn.time_in_call_secs === 'number' ? ` [${turn.time_in_call_secs}s]` : '';
      return `${role}${seconds}: ${turn.message ?? ''}`.trim();
    })
    .join('\n');
}

function extractOutcome(payload: CallPayload) {
  const analysis = asRecord(payload.analysis);
  const dataCollectionResults = asRecord(analysis.data_collection_results);
  const evaluationCriteriaResults = asRecord(analysis.evaluation_criteria_results);
  const scalarSource = {
    ...evaluationCriteriaResults,
    ...dataCollectionResults,
  };

  const rawOutcome = readScalar(scalarSource, ['outcome_code', 'classification', 'disposition', 'result']);
  const rawHandoff = readScalar(scalarSource, ['handoff_to_human', 'requires_human', 'positive_disposition']);
  const rawScore = readScalar(scalarSource, ['positive_signal_score', 'signal_score', 'lead_score']);
  const rawContactType = readScalar(scalarSource, ['contact_type', 'owner_type', 'profile_type']);
  const callSuccessful = typeof analysis.call_successful === 'string' ? analysis.call_successful : null;
  const summary = typeof analysis.transcript_summary === 'string' ? analysis.transcript_summary : null;

  const outcomeCode = mapOutcomeCode(
    typeof rawOutcome === 'string' ? rawOutcome : rawOutcome != null ? String(rawOutcome) : null,
    callSuccessful,
  );

  const handoff = toBoolean(rawHandoff)
    ?? (outcomeCode === 'positive_high' || outcomeCode === 'positive_medium');
  const positiveScore = toNumber(rawScore)
    ?? (outcomeCode === 'positive_high' ? 0.9 : outcomeCode === 'positive_medium' ? 0.7 : outcomeCode === 'neutral' ? 0.4 : 0.1);

  return {
    outcomeCode,
    handoff,
    positiveScore,
    contactType: rawContactType != null ? String(rawContactType) : null,
    summary,
    callSuccessful,
  };
}

async function maybeCreateHandoffTask(service: ReturnType<typeof createClient>, queueRow: Record<string, unknown>, outcome: ReturnType<typeof extractOutcome>, summary: string | null) {
  if (!outcome.handoff || queueRow.handoff_task_id || !queueRow.contact_id) {
    return queueRow.handoff_task_id ?? null;
  }

  const agentId = (queueRow.assigned_agent_id as string | null) || (queueRow.created_by as string | null);
  if (!agentId) return null;

  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + 1);

  const { data: task, error } = await service
    .from('tasks')
    .insert({
      agent_id: agentId,
      contact_id: queueRow.contact_id as string,
      title: `Llamar tras IA: ${queueRow.display_name as string}`,
      description: [
        `Campaña: ${queueRow.campaign_name as string}`,
        `Objetivo: ${queueRow.purpose_code as string}`,
        `Resultado IA: ${outcome.outcomeCode}`,
        summary ? `Resumen: ${summary}` : null,
      ].filter(Boolean).join('\n'),
      due_date: dueDate.toISOString(),
      priority: outcome.outcomeCode === 'positive_high' ? 'alta' : 'media',
      task_type: 'seguimiento',
      source: 'voice_campaign',
      completed: false,
    })
    .select('id')
    .single();

  if (error) throw error;
  return task?.id ?? null;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const payloadText = await req.text();
    const signature = req.headers.get('elevenlabs-signature');
    const event = await verifyWebhookEvent(payloadText, signature);

    const payload = asRecord(event.data) as unknown as CallPayload;
    const dynamicVariables = asRecord(payload.conversation_initiation_client_data?.dynamic_variables);
    const campaignContactId = typeof dynamicVariables.campaign_contact_id === 'string'
      ? dynamicVariables.campaign_contact_id
      : null;

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (!campaignContactId) {
      return json({ ok: true, ignored: true, reason: 'missing_campaign_contact_id', type: event.type });
    }

    const { data: queueRow, error: queueError } = await service
      .from('voice_campaign_contacts')
      .select(`
        id,
        campaign_id,
        contact_id,
        assigned_agent_id,
        display_name,
        handoff_task_id,
        campaign:voice_campaigns!inner(id, name, purpose_code, created_by)
      `)
      .eq('id', campaignContactId)
      .single();

    if (queueError || !queueRow) {
      return json({ ok: true, ignored: true, reason: 'campaign_contact_not_found', type: event.type });
    }

    const campaign = asRecord(queueRow.campaign);
    const enrichedQueueRow = {
      ...queueRow,
      campaign_name: campaign.name as string,
      purpose_code: campaign.purpose_code as string,
      created_by: campaign.created_by as string,
    };

    const transcript = buildTranscriptText(payload.transcript);
    const outcome = extractOutcome(payload);
    const endedAt = payload.metadata?.call_duration_secs != null
      ? new Date((payload.metadata.start_time_unix_secs ?? Math.floor(Date.now() / 1000)) * 1000 + payload.metadata.call_duration_secs * 1000).toISOString()
      : new Date().toISOString();
    const startedAt = payload.metadata?.start_time_unix_secs
      ? new Date(payload.metadata.start_time_unix_secs * 1000).toISOString()
      : null;
    const summary = outcome.summary ?? payload.metadata?.termination_reason ?? null;

    const { data: existingRun } = await service
      .from('voice_call_runs')
      .select('id')
      .eq('campaign_contact_id', campaignContactId)
      .eq('provider_call_id', payload.conversation_id ?? '')
      .maybeSingle();

    if (existingRun?.id) {
      await service
        .from('voice_call_runs')
        .update({
          raw_status: payload.status ?? event.type,
          transcript,
          summary,
          duration_seconds: payload.metadata?.call_duration_secs ?? null,
          started_at: startedAt,
          ended_at: endedAt,
          outcome_payload: payload,
        })
        .eq('id', existingRun.id);
    } else {
      await service.from('voice_call_runs').insert({
        campaign_contact_id: campaignContactId,
        provider: 'elevenlabs',
        provider_call_id: payload.conversation_id ?? null,
        raw_status: payload.status ?? event.type,
        transcript,
        summary,
        duration_seconds: payload.metadata?.call_duration_secs ?? null,
        started_at: startedAt,
        ended_at: endedAt,
        outcome_payload: payload,
      });
    }

    let handoffTaskId = enrichedQueueRow.handoff_task_id as string | null;
    if (event.type === 'post_call_transcription') {
      handoffTaskId = await maybeCreateHandoffTask(service, enrichedQueueRow, outcome, summary);

      await service
        .from('voice_campaign_contacts')
        .update({
          status: outcome.callSuccessful === 'success' ? 'completed' : 'failed',
          outcome_code: outcome.outcomeCode,
          positive_signal_score: outcome.positiveScore,
          handoff_to_human: outcome.handoff,
          handoff_task_id: handoffTaskId,
          notes: summary,
        })
        .eq('id', campaignContactId);

      if (queueRow.contact_id) {
        await service.from('interactions').insert({
          contact_id: queueRow.contact_id as string,
          agent_id: (enrichedQueueRow.assigned_agent_id as string | null) || (enrichedQueueRow.created_by as string | null),
          interaction_type: 'llamada',
          subject: `IA voz: ${outcome.outcomeCode}`,
          description: summary ?? transcript ?? 'Llamada IA sin resumen',
          call_status: payload.status ?? outcome.callSuccessful ?? event.type,
          call_duration_seconds: payload.metadata?.call_duration_secs ?? null,
        });

        if (['wrong_number', 'hostile_do_not_call', 'intermediary_agency'].includes(outcome.outcomeCode)) {
          await service.from('voice_contact_flags').upsert({
            contact_id: queueRow.contact_id as string,
            voice_allowed: outcome.outcomeCode !== 'hostile_do_not_call',
            do_not_call: outcome.outcomeCode === 'hostile_do_not_call',
            hostile_flag: outcome.outcomeCode === 'hostile_do_not_call',
            wrong_number_flag: outcome.outcomeCode === 'wrong_number',
            intermediary_flag: outcome.outcomeCode === 'intermediary_agency',
            last_disposition: outcome.outcomeCode,
            notes: summary,
          });
        }
      }
    }

    return json({
      ok: true,
      processed: true,
      type: event.type,
      campaign_contact_id: campaignContactId,
      outcome_code: outcome.outcomeCode,
      handoff_task_id: handoffTaskId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
