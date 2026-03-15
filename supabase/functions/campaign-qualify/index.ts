import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * Campaign to qualify propietarios & contactos as compradores or prospectos.
 * Sends AI-generated qualifying messages directly via Green API / Brevo.
 * Tags: qualify-pendiente (in progress), qualify-done (finished), no-contactar (opt-out).
 * 
 * POST body:
 * - batch_size: max contacts per batch (default 200)
 * - preview: if true, returns one example without sending
 * - mode: "initial" | "followup"
 * - stats_only: if true, returns only stats
 */

const FOLLOWUP_CADENCE_DAYS = [3, 5, 7];
const MAX_ATTEMPTS = 4;

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

    const body = await req.json();
    const batchSize = Math.min(body.batch_size || 200, 200);
    const preview = body.preview === true;
    const mode = body.mode || "initial";

    if (body.stats_only) {
      return await getStats(supabase);
    }

    if (mode === "followup") {
      return await handleFollowups(supabase, supabaseUrl, serviceKey, batchSize, preview);
    }

    return await handleInitial(supabase, supabaseUrl, serviceKey, batchSize, preview);
  } catch (e: any) {
    console.error("campaign-qualify error:", e.message);
    return json({ ok: false, error: e.message }, 500);
  }
});

/** Get campaign statistics */
async function getStats(supabase: any) {
  const [
    { count: totalEligible },
    { count: pendingSend },
    { count: pendingResponse },
    { count: convertedComprador },
    { count: convertedProspecto },
    { count: noContactar },
    { count: sinRespuesta },
    { count: needsReview },
  ] = await Promise.all([
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .in('contact_type', ['propietario', 'contacto'])
      .not('tags', 'cs', '{qualify-done}')
      .not('tags', 'cs', '{no-contactar}'),
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .in('contact_type', ['propietario', 'contacto'])
      .not('tags', 'cs', '{qualify-pendiente}')
      .not('tags', 'cs', '{qualify-done}')
      .not('tags', 'cs', '{no-contactar}'),
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .contains('tags', ['qualify-pendiente']),
    supabase.from('communication_logs').select('id', { count: 'exact', head: true })
      .eq('source', 'campaign_qualify')
      .eq('status', 'clasificado')
      .contains('metadata', { classification: 'comprador' }),
    supabase.from('communication_logs').select('id', { count: 'exact', head: true })
      .eq('source', 'campaign_qualify')
      .eq('status', 'clasificado')
      .contains('metadata', { classification: 'prospecto' }),
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .contains('tags', ['no-contactar']),
    supabase.from('contacts').select('id', { count: 'exact', head: true })
      .contains('tags', ['qualify-done'])
      .not('tags', 'cs', '{qualify-comprador}')
      .not('tags', 'cs', '{qualify-prospecto}'),
    supabase.from('communication_logs').select('id', { count: 'exact', head: true })
      .eq('source', 'campaign_qualify')
      .eq('status', 'revision_manual'),
  ]);

  return json({
    ok: true,
    total_eligible: totalEligible || 0,
    pending_send: pendingSend || 0,
    pending_response: pendingResponse || 0,
    converted_comprador: convertedComprador || 0,
    converted_prospecto: convertedProspecto || 0,
    no_contactar: noContactar || 0,
    sin_respuesta: sinRespuesta || 0,
    needs_review: needsReview || 0,
  });
}

/** Handle initial outreach */
async function handleInitial(
  supabase: any, supabaseUrl: string, serviceKey: string,
  batchSize: number, preview: boolean
) {
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, full_name, phone, phone2, email, city, nationality, notes, tags, contact_type, agent_id")
    .in("contact_type", ["propietario", "contacto"])
    .not("tags", "cs", "{qualify-pendiente}")
    .not("tags", "cs", "{qualify-done}")
    .not("tags", "cs", "{no-contactar}")
    .order("created_at", { ascending: true })
    .limit(preview ? 1 : batchSize);

  if (error) throw new Error(`Query error: ${error.message}`);
  if (!contacts?.length) {
    return json({ ok: true, message: "No quedan contactos por procesar", sent: 0, remaining: 0 });
  }

  const { count: remaining } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .in("contact_type", ["propietario", "contacto"])
    .not("tags", "cs", "{qualify-pendiente}")
    .not("tags", "cs", "{qualify-done}")
    .not("tags", "cs", "{no-contactar}");

  if (preview) {
    return await generatePreview(supabase, supabaseUrl, serviceKey, contacts[0], 1, [], remaining);
  }

  return await sendBatch(supabase, supabaseUrl, serviceKey, contacts, 1, remaining);
}

/** Handle follow-ups */
async function handleFollowups(
  supabase: any, supabaseUrl: string, serviceKey: string,
  batchSize: number, preview: boolean
) {
  const { data: pendingContacts, error } = await supabase
    .from("contacts")
    .select("id, full_name, phone, phone2, email, city, nationality, notes, tags, contact_type, agent_id")
    .contains("tags", ["qualify-pendiente"])
    .in("contact_type", ["propietario", "contacto"])
    .limit(500);

  if (error) throw new Error(`Query error: ${error.message}`);
  if (!pendingContacts?.length) {
    return json({ ok: true, message: "No hay seguimientos pendientes", sent: 0 });
  }

  const contactsReady: any[] = [];
  const now = new Date();

  for (const contact of pendingContacts) {
    const { data: logs } = await supabase
      .from("communication_logs")
      .select("created_at, metadata")
      .eq("contact_id", contact.id)
      .eq("source", "campaign_qualify")
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(MAX_ATTEMPTS);

    if (!logs?.length) continue;

    const attemptNumber = logs.length;
    if (attemptNumber >= MAX_ATTEMPTS) {
      await markNoResponse(supabase, contact);
      continue;
    }

    const lastSent = new Date(logs[0].created_at);
    const daysSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
    const requiredDays = FOLLOWUP_CADENCE_DAYS[attemptNumber - 1] || 7;

    if (daysSinceLast >= requiredDays) {
      const previousMessages = logs.map((l: any) => l.metadata?.message_preview || "").filter(Boolean);
      contactsReady.push({ ...contact, _attemptNumber: attemptNumber + 1, _previousMessages: previousMessages });
    }

    if (contactsReady.length >= batchSize) break;
  }

  if (!contactsReady.length) {
    return json({ ok: true, message: "Ningún contacto necesita seguimiento aún", sent: 0 });
  }

  if (preview) {
    const c = contactsReady[0];
    return await generatePreview(supabase, supabaseUrl, serviceKey, c, c._attemptNumber, c._previousMessages, contactsReady.length);
  }

  let sent = 0;
  const errors: string[] = [];
  for (const contact of contactsReady) {
    try {
      await sendMessage(supabase, supabaseUrl, serviceKey, contact, contact._attemptNumber, contact._previousMessages);
      sent++;
      if (sent < contactsReady.length) await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      errors.push(`${contact.full_name}: ${e.message}`);
    }
  }

  return json({ ok: true, sent, errors: errors.length ? errors : undefined });
}

/** Generate preview */
async function generatePreview(
  supabase: any, supabaseUrl: string, serviceKey: string,
  contact: any, attemptNumber: number, previousMessages: string[], remaining: number | null
) {
  const channel = contact.phone ? "whatsapp" : "email";
  const context = await loadContactContext(supabase, contact);

  const msgRes = await fetch(`${supabaseUrl}/functions/v1/ai-classify-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
    body: JSON.stringify({
      contact: { ...contact, ...context },
      channel,
      agent_name: "Alicia",
      attempt_number: attemptNumber,
      previous_messages: previousMessages,
      campaign_type: "qualify",
    }),
  });

  const msgData = await msgRes.json();
  return json({
    ok: true, preview: true,
    contact_name: contact.full_name,
    contact_type: contact.contact_type,
    channel, attempt_number: attemptNumber,
    message: msgData,
    remaining: remaining || 0,
  });
}

/** Send a single message */
async function sendMessage(
  supabase: any, supabaseUrl: string, serviceKey: string,
  contact: any, attemptNumber: number, previousMessages: string[]
) {
  const channel = contact.phone ? "whatsapp" : "email";
  const context = await loadContactContext(supabase, contact);

  const msgRes = await fetch(`${supabaseUrl}/functions/v1/ai-classify-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
    body: JSON.stringify({
      contact: { ...contact, ...context },
      channel,
      agent_name: "Alicia",
      attempt_number: attemptNumber,
      previous_messages: previousMessages,
      campaign_type: "qualify",
    }),
  });

  const msgData = await msgRes.json();
  if (!msgData.ok) throw new Error(`AI error: ${msgData.error}`);

  const sendPayload: any = {
    channel, contact_id: contact.id, text: msgData.text,
    source: "campaign_qualify",
    reply_to: channel === "email" ? "noreply@planhogar.es" : undefined,
    campaign: "qualify",
  };
  if (channel === "email") {
    sendPayload.subject = msgData.subject;
    sendPayload.html = msgData.html;
  }

  const sendRes = await fetch(`${supabaseUrl}/functions/v1/multichannel-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
    body: JSON.stringify(sendPayload),
  });

  const sendData = await sendRes.json();
  if (!sendData.ok) throw new Error(`Send error: ${sendData.error}`);

  // Update latest log metadata
  const { data: latestLog } = await supabase
    .from("communication_logs")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("source", "campaign_qualify")
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1).single();

  if (latestLog) {
    await supabase.from("communication_logs").update({
      metadata: { attempt_number: attemptNumber, message_preview: msgData.text?.slice(0, 200), channel },
    }).eq("id", latestLog.id);
  }

  // Tag as qualify-pendiente
  const currentTags = contact.tags || [];
  if (!currentTags.includes("qualify-pendiente")) {
    await supabase.from("contacts").update({
      tags: [...currentTags, "qualify-pendiente"],
    }).eq("id", contact.id);
  }
}

/** Send batch */
async function sendBatch(
  supabase: any, supabaseUrl: string, serviceKey: string,
  contacts: any[], attemptNumber: number, remainingCount: number | null
) {
  let sent = 0;
  const errors: string[] = [];
  for (const contact of contacts) {
    try {
      await sendMessage(supabase, supabaseUrl, serviceKey, contact, attemptNumber, []);
      sent++;
      if (sent < contacts.length) await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      errors.push(`${contact.full_name}: ${e.message}`);
    }
  }
  return json({ ok: true, sent, errors: errors.length ? errors : undefined, remaining: (remainingCount || 0) - sent });
}

/** Mark as no response after max attempts */
async function markNoResponse(supabase: any, contact: any) {
  const newTags = (contact.tags || []).filter((t: string) => t !== "qualify-pendiente");
  newTags.push("qualify-done");

  await supabase.from("contacts").update({
    pipeline_stage: "sin_respuesta",
    tags: newTags,
  }).eq("id", contact.id);

  // Notify
  if (contact.agent_id) {
    await supabase.from("notifications").insert({
      event_type: "campaign_qualify",
      entity_type: "contact",
      entity_id: contact.id,
      title: `⚠️ ${contact.full_name} — sin respuesta tras ${MAX_ATTEMPTS} intentos`,
      description: `Campaña de cualificación: se agotaron los intentos.`,
      agent_id: contact.agent_id,
    });
  }
}

/** Load contact context */
async function loadContactContext(supabase: any, contact: any) {
  const [interactionsRes, demandsRes, propertiesRes] = await Promise.all([
    supabase.from("interactions").select("subject, description, interaction_type")
      .eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("demands").select("operation, property_type, cities, zones, min_price, max_price")
      .eq("contact_id", contact.id).limit(3),
    // If propietario, load their properties
    supabase.from("properties").select("title, city, zone, price, operation_type, property_type")
      .eq("owner_id", contact.id).limit(3),
  ]);

  return {
    interactions: interactionsRes.data || [],
    demands: demandsRes.data || [],
    properties: propertiesRes.data || [],
  };
}
