import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * Campaign to classify unclassified contacts.
 * Handles both initial outreach AND follow-ups with adaptive cadence.
 * 
 * POST body: { batch_size?, preview?, agent_name?, mode? }
 * - mode: "initial" (default) or "followup"
 * - batch_size: max contacts per batch (default 50)
 * - preview: if true, generates one example message without sending
 * - agent_name: name to sign messages with (default "Alicia")
 */

// Adaptive cadence: days to wait before each follow-up attempt
// Attempt 1 = initial message, attempt 2 = 1st follow-up, etc.
const FOLLOWUP_CADENCE_DAYS = [3, 5, 7]; // after 1st, 2nd, 3rd message
const MAX_ATTEMPTS = 4; // initial + 3 follow-ups

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // ── Auth: require authenticated admin/coordinadora ───────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    // Check admin or coordinadora role
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'coordinadora'])
      .limit(1);
    if (!roleRow || roleRow.length === 0) {
      return json({ error: 'Forbidden: admin or coordinadora role required' }, 403);
    }

    // Kill-switch check
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "campaign_classify_enabled")
      .maybeSingle();
    if (setting?.value === false || setting?.value === 'false') {
      return json({ ok: false, error: "Campaña de clasificación desactivada" });
    }

    const body = await req.json();
    const batchSize = Math.min(body.batch_size || 50, 100);
    const preview = body.preview === true;
    const agentName = body.agent_name || "Alicia";
    const mode = body.mode || "initial"; // "initial" or "followup"

    if (mode === "followup") {
      return await handleFollowups(supabase, supabaseUrl, serviceKey, batchSize, preview, agentName);
    }

    return await handleInitial(supabase, supabaseUrl, serviceKey, batchSize, preview, agentName);
  } catch (e: any) {
    console.error("campaign-classify error:", e.message);
    return json({ ok: false, error: e.message }, 500);
  }
});

/** Handle initial outreach to uncontacted contacts */
async function handleInitial(
  supabase: any, supabaseUrl: string, serviceKey: string,
  batchSize: number, preview: boolean, agentName: string
) {
  // Query unclassified contacts without campaign tags
  const { data: contacts, error: queryError } = await supabase
    .from("contacts")
    .select("id, full_name, phone, phone2, email, city, nationality, notes, tags")
    .eq("contact_type", "contacto")
    .not("tags", "cs", "{clasificacion-pendiente}")
    .not("tags", "cs", "{clasificado-campana}")
    .order("created_at", { ascending: true })
    .limit(preview ? 1 : batchSize);

  if (queryError) throw new Error(`Query error: ${queryError.message}`);
  if (!contacts?.length) {
    return json({ ok: true, message: "No quedan contactos por procesar", sent: 0, remaining: 0 });
  }

  // Count remaining for stats
  const { count: remainingCount } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("contact_type", "contacto")
    .not("tags", "cs", "{clasificacion-pendiente}")
    .not("tags", "cs", "{clasificado-campana}");

  if (preview) {
    return await generatePreview(supabase, supabaseUrl, serviceKey, contacts[0], agentName, 1, [], remainingCount);
  }

  // Process batch
  return await sendBatch(supabase, supabaseUrl, serviceKey, contacts, agentName, 1, remainingCount);
}

/** Handle follow-ups for contacts who haven't responded yet */
async function handleFollowups(
  supabase: any, supabaseUrl: string, serviceKey: string,
  batchSize: number, preview: boolean, agentName: string
) {
  // Find contacts with tag 'clasificacion-pendiente' who need a follow-up
  const { data: pendingContacts, error } = await supabase
    .from("contacts")
    .select("id, full_name, phone, phone2, email, city, nationality, notes, tags")
    .contains("tags", ["clasificacion-pendiente"])
    .eq("contact_type", "contacto")
    .limit(200); // get more to filter by cadence

  if (error) throw new Error(`Query error: ${error.message}`);
  if (!pendingContacts?.length) {
    return json({ ok: true, message: "No hay seguimientos pendientes", sent: 0, followups_pending: 0 });
  }

  // For each contact, check their communication history to determine:
  // 1. How many attempts have been made
  // 2. When was the last one
  // 3. Whether it's time for a follow-up
  const contactsReadyForFollowup: any[] = [];
  const now = new Date();

  for (const contact of pendingContacts) {
    const { data: logs } = await supabase
      .from("communication_logs")
      .select("created_at, metadata")
      .eq("contact_id", contact.id)
      .eq("source", "campaign_classify")
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(MAX_ATTEMPTS);

    if (!logs?.length) continue;

    const attemptNumber = logs.length; // how many messages sent so far
    if (attemptNumber >= MAX_ATTEMPTS) {
      // Max attempts reached → mark as sin_respuesta and move on
      await markNoResponse(supabase, contact);
      continue;
    }

    // Check if enough days have passed since last message
    const lastSent = new Date(logs[0].created_at);
    const daysSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
    const requiredDays = FOLLOWUP_CADENCE_DAYS[attemptNumber - 1] || 7;

    if (daysSinceLast >= requiredDays) {
      // Collect previous messages for AI context
      const previousMessages = logs.map((l: any) => l.metadata?.message_preview || "").filter(Boolean);
      contactsReadyForFollowup.push({
        ...contact,
        _attemptNumber: attemptNumber + 1,
        _previousMessages: previousMessages,
      });
    }

    if (contactsReadyForFollowup.length >= batchSize) break;
  }

  if (!contactsReadyForFollowup.length) {
    return json({
      ok: true,
      message: "Ningún contacto necesita seguimiento aún",
      sent: 0,
      followups_pending: pendingContacts.length,
    });
  }

  if (preview && contactsReadyForFollowup.length > 0) {
    const c = contactsReadyForFollowup[0];
    return await generatePreview(
      supabase, supabaseUrl, serviceKey, c, agentName,
      c._attemptNumber, c._previousMessages, contactsReadyForFollowup.length
    );
  }

  // Send follow-up batch
  let sent = 0;
  const errors: string[] = [];

  for (const contact of contactsReadyForFollowup) {
    try {
      await sendMessage(
        supabase, supabaseUrl, serviceKey, contact, agentName,
        contact._attemptNumber, contact._previousMessages
      );
      sent++;
      if (sent < contactsReadyForFollowup.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (contactError: any) {
      errors.push(`${contact.full_name}: ${contactError.message}`);
    }
  }

  return json({
    ok: true,
    sent,
    errors: errors.length > 0 ? errors : undefined,
    followups_pending: pendingContacts.length - sent,
  });
}

/** Generate a preview message without sending */
async function generatePreview(
  supabase: any, supabaseUrl: string, serviceKey: string,
  contact: any, agentName: string, attemptNumber: number,
  previousMessages: string[], remaining: number | null
) {
  const channel = contact.phone ? "whatsapp" : "email";
  const context = await loadContactContext(supabase, contact);

  const msgRes = await fetch(`${supabaseUrl}/functions/v1/ai-classify-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      contact: { ...contact, ...context },
      channel,
      agent_name: agentName,
      attempt_number: attemptNumber,
      previous_messages: previousMessages,
    }),
  });

  const msgData = await msgRes.json();
  return json({
    ok: true,
    preview: true,
    contact_name: contact.full_name,
    channel,
    attempt_number: attemptNumber,
    message: msgData,
    remaining: remaining || 0,
  });
}

/** Send a message to a single contact */
async function sendMessage(
  supabase: any, supabaseUrl: string, serviceKey: string,
  contact: any, agentName: string,
  attemptNumber: number, previousMessages: string[]
) {
  const channel = contact.phone ? "whatsapp" : "email";
  const context = await loadContactContext(supabase, contact);

  // Generate AI message
  const msgRes = await fetch(`${supabaseUrl}/functions/v1/ai-classify-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      contact: { ...contact, ...context },
      channel,
      agent_name: agentName,
      attempt_number: attemptNumber,
      previous_messages: previousMessages,
    }),
  });

  const msgData = await msgRes.json();
  if (!msgData.ok) {
    throw new Error(`AI error: ${msgData.error}`);
  }

  // Reply-to: noreply since we direct users to WhatsApp for responses
  const replyTo = "noreply@planhogar.es";

  // Send via send function
  const sendPayload: any = {
    channel,
    contact_id: contact.id,
    text: msgData.text,
    source: "campaign_classify",
    reply_to: channel === "email" ? replyTo : undefined,
  };
  if (channel === "email") {
    sendPayload.subject = msgData.subject;
    sendPayload.html = msgData.html;
  }

  const sendRes = await fetch(`${supabaseUrl}/functions/v1/multichannel-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(sendPayload),
  });

  const sendData = await sendRes.json();
  if (!sendData.ok) {
    throw new Error(`Send error: ${sendData.error}`);
  }

  // Update communication_log metadata with attempt info
  // (the log was already created by the send function, update the latest one)
  const { data: latestLog } = await supabase
    .from("communication_logs")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("source", "campaign_classify")
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (latestLog) {
    await supabase
      .from("communication_logs")
      .update({
        metadata: {
          attempt_number: attemptNumber,
          message_preview: msgData.text?.slice(0, 200),
          channel,
        },
      })
      .eq("id", latestLog.id);
  }

  // Add tag 'clasificacion-pendiente' if not present
  const currentTags = contact.tags || [];
  if (!currentTags.includes("clasificacion-pendiente")) {
    await supabase
      .from("contacts")
      .update({ tags: [...currentTags, "clasificacion-pendiente"] })
      .eq("id", contact.id);
  }

  // Notify coordinadoras + contact's agent about campaign activity
  await notifyCampaignResult(supabase, contact, channel, attemptNumber, msgData.text?.slice(0, 150));
}

/** Send a batch of initial messages */
async function sendBatch(
  supabase: any, supabaseUrl: string, serviceKey: string,
  contacts: any[], agentName: string, attemptNumber: number,
  remainingCount: number | null
) {
  let sent = 0;
  const errors: string[] = [];

  for (const contact of contacts) {
    try {
      await sendMessage(supabase, supabaseUrl, serviceKey, contact, agentName, attemptNumber, []);
      sent++;
      if (sent < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (contactError: any) {
      errors.push(`${contact.full_name}: ${contactError.message}`);
    }
  }

  return json({
    ok: true,
    sent,
    errors: errors.length > 0 ? errors : undefined,
    remaining: (remainingCount || 0) - sent,
  });
}

/** Mark contact as sin_respuesta after max attempts */
async function markNoResponse(supabase: any, contact: any) {
  const currentTags = (contact.tags || []).filter(
    (t: string) => t !== "clasificacion-pendiente"
  );
  currentTags.push("clasificado-campana");

  await supabase
    .from("contacts")
    .update({
      pipeline_stage: "sin_respuesta",
      tags: currentTags,
    })
    .eq("id", contact.id);

  // Notify about max attempts exhausted
  await notifyCampaignResult(supabase, contact, "sistema", MAX_ATTEMPTS, null, true);
}

/** Notify coordinadoras and the contact's assigned agent about campaign results */
async function notifyCampaignResult(
  supabase: any, contact: any, channel: string,
  attemptNumber: number, preview: string | null, exhausted = false,
) {
  try {
    // Get coordinadoras
    const { data: coordUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "coordinadora");

    const recipientIds = new Set<string>(
      (coordUsers || []).map((r: { user_id: string }) => r.user_id)
    );

    // Add the contact's agent
    if (contact.agent_id) {
      recipientIds.add(contact.agent_id);
    }

    if (recipientIds.size === 0) return;

    const channelLabel: Record<string, string> = {
      whatsapp: "📱 WhatsApp",
      email: "📧 Email",
      sistema: "🔔 Sistema",
    };

    const title = exhausted
      ? `⚠️ Campaña: ${contact.full_name} — sin respuesta tras ${attemptNumber} intentos`
      : `📣 Campaña clasificación: ${contact.full_name} — intento ${attemptNumber} (${channelLabel[channel] || channel})`;

    const description = exhausted
      ? `Se agotaron los ${MAX_ATTEMPTS} intentos de contacto. Marcado como "sin respuesta".`
      : preview || `Mensaje enviado por ${channel}`;

    const notifs = Array.from(recipientIds).map((uid) => ({
      event_type: "campaign_classify",
      entity_type: "contact",
      entity_id: contact.id,
      title: title.slice(0, 200),
      description: description.slice(0, 500),
      agent_id: uid,
    }));

    const { error } = await supabase.from("notifications").insert(notifs);
    if (error) console.error("[campaign-classify] Notification error:", error);
  } catch (err) {
    console.error("[campaign-classify] Notification error (non-fatal):", err);
  }
}

/** Load interactions and demands for a contact to give AI context */
async function loadContactContext(supabase: any, contact: any) {
  const [interactionsRes, demandsRes] = await Promise.all([
    supabase
      .from("interactions")
      .select("subject, description, interaction_type")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("demands")
      .select("operation, property_type, cities, zones, min_price, max_price")
      .eq("contact_id", contact.id)
      .limit(3),
  ]);

  return {
    interactions: interactionsRes.data || [],
    demands: demandsRes.data || [],
  };
}
