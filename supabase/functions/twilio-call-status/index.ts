/**
 * twilio-call-status — Webhook called by Twilio when call status or recording changes.
 * - On call terminal states: creates/updates interaction records in the CRM.
 * - On recording-completed: generates AI summary and creates a follow-up task.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAI } from '../_shared/ai.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function mapCallStatus(twilioStatus: string): string {
  switch (twilioStatus) {
    case 'completed': return 'contestada';
    case 'no-answer': return 'no_contesta';
    case 'busy': return 'ocupado';
    case 'failed': return 'fallida';
    case 'canceled': return 'cancelada';
    default: return twilioStatus;
  }
}

function normalizeRecordingUrl(recordingUrl: string): string | null {
  if (!recordingUrl) return null;
  if (/\.(mp3|wav)$/i.test(recordingUrl)) return recordingUrl;
  return `${recordingUrl}.mp3`;
}

async function transcribeRecordingWithOpenAI(recordingUrl: string): Promise<string | null> {
  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!openAIKey || !twilioAccountSid || !twilioAuthToken) {
    return null;
  }

  const normalizedRecordingUrl = normalizeRecordingUrl(recordingUrl);
  if (!normalizedRecordingUrl) return null;

  const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
  const audioRes = await fetch(normalizedRecordingUrl, {
    headers: {
      Authorization: `Basic ${twilioAuth}`,
    },
  });

  if (!audioRes.ok) {
    throw new Error(`No se pudo descargar la grabación de Twilio (${audioRes.status})`);
  }

  const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
  const audioBuffer = await audioRes.arrayBuffer();
  const formData = new FormData();
  formData.append('model', 'gpt-4o-mini-transcribe');
  formData.append('language', 'es');
  formData.append('response_format', 'text');
  formData.append('file', new Blob([audioBuffer], { type: contentType }), 'twilio-call.mp3');

  const transcriptionRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAIKey}`,
    },
    body: formData,
  });

  if (!transcriptionRes.ok) {
    const errorText = await transcriptionRes.text();
    throw new Error(`OpenAI transcription error [${transcriptionRes.status}]: ${errorText}`);
  }

  const transcript = (await transcriptionRes.text()).trim();
  return transcript || null;
}

function extractMetadata(description: string | null) {
  const lines = (description || '').split('\n');
  const getValue = (prefix: string) =>
    lines.find((line) => line.startsWith(prefix))?.replace(prefix, '').trim() || null;

  return {
    direction: getValue('Dirección:') || 'Saliente',
    displayNumber: getValue('Número:') || '',
  };
}

function buildInteractionDescription(params: {
  direction: string;
  status: string;
  displayNumber: string;
  duration: number;
  recordingUrl?: string | null;
  transcript?: string | null;
  transcriptStatus?: string | null;
  aiSummary?: string | null;
}) {
  const lines = [
    `Dirección: ${params.direction}`,
    `Estado: ${params.status}`,
    `Número: ${params.displayNumber}`,
    params.duration > 0 ? `Duración: ${params.duration}s` : null,
    params.recordingUrl ? `Grabación: ${params.recordingUrl}` : null,
    params.transcriptStatus ? `Transcripción: ${params.transcriptStatus}` : null,
  ].filter(Boolean);

  if (params.transcript) {
    lines.push('', '📝 Transcripción:', params.transcript);
  }

  if (params.aiSummary) {
    lines.push('', '🤖 Resumen IA:', params.aiSummary);
  }

  return lines.join('\n');
}

async function generateAISummary(
  contactName: string,
  direction: string,
  status: string,
  duration: number,
  phoneNumber: string,
  transcript?: string | null,
): Promise<string | null> {
  const rawNotes = [
    `Número marcado: ${phoneNumber}`,
    duration > 0 ? `Duración: ${Math.floor(duration / 60)}m ${duration % 60}s` : 'Llamada no conectada',
    `Estado: ${status}`,
    transcript ? `Transcripción:\n${transcript}` : 'Sin transcripción disponible',
  ].join('\n');

  try {
    const result = await callAI('google/gemini-2.5-flash-lite', [
      {
        role: 'system',
        content: `Eres un asistente de CRM inmobiliario. Genera un resumen breve y estructurado de una llamada telefónica. Si hay transcripción, úsala como fuente principal; si no, apóyate en los metadatos disponibles. Responde SOLO con el resumen, máximo 4 bullets, priorizando acuerdos, objeciones y próximos pasos.`,
      },
      {
        role: 'user',
        content: `Contacto: ${contactName}\nDirección: ${direction}\nResultado: ${status}\n\nDatos:\n${rawNotes}`,
      },
    ], { max_tokens: 200 });

    return result.content || null;
  } catch {
    return null;
  }
}

async function upsertFollowUpTask(params: {
  interactionId: string;
  followUpTaskId?: string | null;
  agentId?: string | null;
  contactId: string;
  contactName: string;
  direction: string;
  duration: number;
  recordingUrl?: string | null;
  transcript?: string | null;
  aiSummary?: string | null;
}) {
  if (!params.agentId) return null;

  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + 24);

  const taskDescription = [
    `📞 Llamada ${params.direction.toLowerCase()} — ${params.duration > 0 ? `${Math.floor(params.duration / 60)}m ${params.duration % 60}s` : 'sin duración'}`,
    params.aiSummary ? `\nResumen IA:\n${params.aiSummary}` : '',
    params.transcript ? `\n📝 Transcripción:\n${params.transcript}` : '',
    params.recordingUrl ? `\n🔗 Grabación: ${params.recordingUrl}` : '',
  ].filter(Boolean).join('');

  const payload = {
    agent_id: params.agentId,
    contact_id: params.contactId,
    title: `Seguimiento llamada: ${params.contactName}`,
    description: taskDescription,
    task_type: 'llamada',
    priority: 'media',
    due_date: dueDate.toISOString(),
    completed: false,
    source: 'twilio_auto_followup',
  };

  if (params.followUpTaskId) {
    const { error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', params.followUpTaskId);

    if (!error) return params.followUpTaskId;
    console.error('Error updating follow-up task:', error);
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return null;
  }

  return data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    // ── Transcription callback ───────────────────────────────────────────────
    const transcriptionStatus = params.get('TranscriptionStatus') || '';
    const transcriptionText = params.get('TranscriptionText') || '';
    if (transcriptionStatus || transcriptionText) {
      const callSid = params.get('CallSid') || '';
      console.log(`Transcription webhook: call=${callSid} status=${transcriptionStatus}`);

      if (!callSid) {
        return new Response('OK', { status: 200 });
      }

      const { data: interactions } = await supabase
        .from('interactions')
        .select('id, contact_id, agent_id, call_status, description, recording_url, follow_up_task_id')
        .eq('call_sid', callSid)
        .limit(1);

      if (!interactions || interactions.length === 0) {
        console.log('No interaction found for transcription call_sid:', callSid);
        return new Response('OK', { status: 200 });
      }

      const interaction = interactions[0];
      const { data: contact } = await supabase
        .from('contacts')
        .select('full_name, phone')
        .eq('id', interaction.contact_id)
        .single();

      const contactName = contact?.full_name || 'Contacto';
      const phoneNumber = contact?.phone || '';
      const metadata = extractMetadata(interaction.description);
      const callStatus = interaction.call_status || 'contestada';
      const completedTranscript = transcriptionText?.trim() || null;
      const effectiveTranscriptStatus = completedTranscript ? 'completed' : (transcriptionStatus || 'pending');
      const aiSummary = completedTranscript
        ? await generateAISummary(contactName, metadata.direction, callStatus, 0, phoneNumber, completedTranscript)
        : null;

      const followUpTaskId = callStatus === 'contestada'
        ? await upsertFollowUpTask({
            interactionId: interaction.id,
            followUpTaskId: interaction.follow_up_task_id,
            agentId: interaction.agent_id,
            contactId: interaction.contact_id,
            contactName,
            direction: metadata.direction,
            duration: 0,
            recordingUrl: interaction.recording_url,
            transcript: completedTranscript,
            aiSummary,
          })
        : interaction.follow_up_task_id;

      await supabase
        .from('interactions')
        .update({
          transcript: completedTranscript,
          transcript_status: effectiveTranscriptStatus,
          ai_summary: aiSummary,
          follow_up_task_id: followUpTaskId,
          description: buildInteractionDescription({
            direction: metadata.direction,
            status: callStatus,
            displayNumber: metadata.displayNumber,
            duration: 0,
            recordingUrl: interaction.recording_url,
            transcript: completedTranscript,
            transcriptStatus: effectiveTranscriptStatus,
            aiSummary,
          }),
        })
        .eq('id', interaction.id);

      return new Response('OK', { status: 200 });
    }

    // ── Recording status callback ────────────────────────────────────────────
    const recordingStatus = params.get('RecordingStatus') || '';
    if (recordingStatus) {
      console.log(`Recording webhook: status=${recordingStatus}`);

      if (recordingStatus !== 'completed') {
        return new Response('OK', { status: 200 });
      }

      const callSid = params.get('CallSid') || '';
      const recordingUrl = params.get('RecordingUrl') || '';
      const recordingDuration = parseInt(params.get('RecordingDuration') || '0', 10);

      console.log(`Recording completed for call ${callSid}, duration=${recordingDuration}s`);

      // Find the interaction created by the call status webhook
      const { data: interactions } = await supabase
        .from('interactions')
        .select('id, contact_id, agent_id, call_status, description, transcript, follow_up_task_id')
        .eq('call_sid', callSid)
        .limit(1);

      if (!interactions || interactions.length === 0) {
        console.log('No interaction found for call_sid:', callSid);
        return new Response('OK', { status: 200 });
      }

      const interaction = interactions[0];
      const contactId = interaction.contact_id;
      const agentId = interaction.agent_id;

      // Get contact name
      const { data: contact } = await supabase
        .from('contacts')
        .select('full_name, phone')
        .eq('id', contactId)
        .single();

      const contactName = contact?.full_name || 'Contacto';
      const phoneNumber = contact?.phone || '';
      const metadata = extractMetadata(interaction.description);
      const direction = metadata.direction;
      const callStatus = interaction.call_status || 'contestada';
      const normalizedRecordingUrl = normalizeRecordingUrl(recordingUrl);
      const openAIConfigured = Boolean(Deno.env.get('OPENAI_API_KEY'));
      let transcript = interaction.transcript;
      let transcriptStatus = interaction.transcript ? 'completed' : (openAIConfigured ? 'processing' : 'provider_not_configured');

      if (!transcript && normalizedRecordingUrl && openAIConfigured) {
        try {
          transcript = await transcribeRecordingWithOpenAI(normalizedRecordingUrl);
          transcriptStatus = transcript ? 'completed' : 'empty';
        } catch (error) {
          transcriptStatus = 'failed';
          console.error('OpenAI STT failed:', error);
        }
      }

      // Only create task for answered calls with recording
      if (callStatus !== 'contestada') {
        await supabase
          .from('interactions')
          .update({
            recording_url: normalizedRecordingUrl,
            transcript,
            transcript_status: transcriptStatus,
            description: buildInteractionDescription({
              direction,
              status: callStatus,
              displayNumber: metadata.displayNumber,
              duration: recordingDuration,
              recordingUrl: normalizedRecordingUrl,
              transcript,
              transcriptStatus,
            }),
          })
          .eq('id', interaction.id);
        return new Response('OK', { status: 200 });
      }

      // Generate AI summary using transcript when available.
      const aiSummary = await generateAISummary(
        contactName,
        direction,
        callStatus,
        recordingDuration,
        phoneNumber,
        transcript,
      );

      const followUpTaskId = await upsertFollowUpTask({
        interactionId: interaction.id,
        followUpTaskId: interaction.follow_up_task_id,
        agentId,
        contactId,
        contactName,
        direction,
        duration: recordingDuration,
        recordingUrl: normalizedRecordingUrl,
        transcript,
        aiSummary,
      });

      await supabase
        .from('interactions')
        .update({
          call_duration_seconds: recordingDuration || null,
          recording_url: normalizedRecordingUrl,
          transcript,
          transcript_status: transcriptStatus,
          ai_summary: aiSummary,
          follow_up_task_id: followUpTaskId,
          description: buildInteractionDescription({
            direction,
            status: callStatus,
            displayNumber: metadata.displayNumber,
            duration: recordingDuration,
            recordingUrl: normalizedRecordingUrl,
            transcript,
            transcriptStatus,
            aiSummary,
          }),
        })
        .eq('id', interaction.id);

      console.log(`Task + interaction updated for contact ${contactId} after call ${callSid}`);

      return new Response('OK', { status: 200 });
    }

    // ── Call status callback ─────────────────────────────────────────────────
    const callSid = params.get('CallSid') || '';
    const callStatus = params.get('CallStatus') || '';
    const to = params.get('To') || '';
    const from = params.get('From') || '';
    const duration = parseInt(params.get('CallDuration') || '0', 10);
    const callerIdentity = params.get('CallerName') || '';
    const agentId = callerIdentity.replace('agent_', '');

    console.log(`Call status webhook: ${callSid} → ${callStatus} (${duration}s) from=${from} to=${to}`);

    // Only process terminal states
    if (!['completed', 'no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) {
      return new Response('OK', { status: 200 });
    }

    const isOutbound = from.startsWith('client:');
    const direction = isOutbound ? 'Saliente' : 'Entrante';
    const phoneToSearch = isOutbound ? to : from;
    const phoneNumber = phoneToSearch.replace(/[^0-9+]/g, '');
    let contactId: string | null = null;

    if (phoneNumber) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .or(`phone.eq.${phoneNumber},phone2.eq.${phoneNumber}`)
        .limit(1);
      if (contacts && contacts.length > 0) {
        contactId = contacts[0].id;
      }
    }

    const mappedStatus = mapCallStatus(callStatus);
    const displayNumber = isOutbound ? to : from;

    const description = buildInteractionDescription({
      direction,
      status: mappedStatus,
      displayNumber,
      duration,
    });

    if (contactId) {
      // Use SELECT + INSERT/UPDATE instead of upsert to avoid partial-index conflict error
      const { data: existing } = await supabase
        .from('interactions')
        .select('id')
        .eq('call_sid', callSid)
        .limit(1);

      const interactionData = {
        contact_id: contactId,
        agent_id: agentId || null,
        interaction_type: 'llamada',
        subject: mappedStatus,
        description,
        call_sid: callSid,
        call_duration_seconds: duration || null,
        call_status: mappedStatus,
        transcript_status: null,
        interaction_date: new Date().toISOString(),
      };

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('interactions')
          .update(interactionData)
          .eq('id', existing[0].id);
        if (error) console.error('Error updating interaction:', error);
      } else {
        const { error } = await supabase
          .from('interactions')
          .insert(interactionData);
        if (error) console.error('Error inserting interaction:', error);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('twilio-call-status error:', err);
    return new Response('Error', { status: 500 });
  }
});
