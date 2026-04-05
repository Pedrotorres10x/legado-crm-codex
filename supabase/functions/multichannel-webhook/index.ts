import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI } from '../_shared/ai.ts';
import { sendMessage as sendDirectMessage } from '../_shared/send-message.ts';
import { isPropertyInterestAutomationEnabled } from '../_shared/automation-outbound.ts';
import { buildPropertyUrl, buildWhatsAppFollowUp, resolveLeadLanguage } from '../_shared/match-whatsapp.ts';
import {
  buildDemandConfirmationMessage,
  buildDemandFollowUpMessage,
  languageName,
  normalizeContactLanguage,
  resolveContactLanguage,
} from '../_shared/contact-language.ts';

type SupabaseClient = ReturnType<typeof createClient>;

type ContactRecord = {
  id: string;
  full_name: string | null;
  tags: string[] | null;
  contact_type: string | null;
  pipeline_stage: string | null;
  agent_id: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  notes: string | null;
  preferred_language: string | null;
  status?: string | null;
};

type PropertySummary = {
  id: string;
  title?: string | null;
  city?: string | null;
  province?: string | null;
};

type OpenerLog = {
  id: string;
  created_at: string;
  property_id: string | null;
  demand_id: string | null;
  body_preview: string | null;
  metadata?: Record<string, unknown> | null;
  source: string | null;
};

type UserRoleRow = { user_id: string };
type ConversationRow = { direction: string; body_preview: string | null; created_at: string };
type DemandRow = { id: string; operation: string | null; property_type: string | null; max_price: number | null; cities: string[] | null; zones: string[] | null; min_price: number | null };
type DemandCreationRow = { id: string };
type WebhookPayload = {
  type?: string;
  contact_id?: string;
  text?: string;
  channel?: string;
  provider_msg_id?: string;
  status?: string;
  error_message?: string;
  metadata?: Record<string, unknown> | null;
};
type ClassificationResult = {
  classification: "comprador" | "prospecto" | "inactivo" | "ambiguo";
  confidence: number;
  summary: string;
};
type DemandExtractionResult = {
  operation: "venta" | "alquiler" | null;
  property_types: string[];
  cities: string[];
  zones: string[];
  min_bedrooms: number | null;
  min_bathrooms: number | null;
  min_price: number | null;
  max_price: number | null;
  min_surface: number | null;
  features: string[];
  notes: string;
  has_enough_data: boolean;
};
type DemandEnrichResult = {
  max_price: number | null;
  min_price: number | null;
  cities: string[];
  zones: string[];
  notes: string;
  extracted_something: boolean;
  still_missing: string[];
  stop: boolean;
  reply: string;
};

/**
 * Receives status updates AND inbound messages.
 * 
 * Status update payload:
 * { provider_msg_id, status, error_message?, metadata? }
 * 
 * Inbound message payload:
 * { type: "inbound", contact_id, text, channel, provider_msg_id? }
 * 
 * Classification flow:
 * 1. Contact responds → AI classifies (comprador/prospecto/inactivo/ambiguo)
 * 2. If comprador → AI asks what they're looking for → on 2nd response, creates demand
 * 3. If prospecto → urgent notification to coordinator + agent (gold!)
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate via service role key in Authorization header
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const incomingSecret = req.headers.get("x-webhook-secret") || req.headers.get("x-crm-key");
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    
    const isAuthorized = (serviceKey && authHeader === serviceKey) ||
                         (serviceKey && incomingSecret === serviceKey);
    
    if (!isAuthorized) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json() as WebhookPayload;

    // Route: inbound message
    if (body.type === "inbound") {
      return await handleInbound(supabase, body);
    }

    // Route: status update (existing logic)
    return await handleStatusUpdate(supabase, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("multichannel-webhook error:", message);
    return json({ ok: false, error: message }, 500);
  }
});

async function handleAutoMatchReply(supabase: SupabaseClient, contact: ContactRecord, inboundText: string, channel: string) {
  if (channel !== "whatsapp") return { handled: false };
  if (!(await isPropertyInterestAutomationEnabled())) return { handled: false, automationDisabled: true };

  const { data: openerLog } = await supabase
    .from("communication_logs")
    .select("id, created_at, property_id, demand_id, body_preview, metadata, source")
    .eq("contact_id", contact.id)
    .eq("channel", "whatsapp")
    .eq("direction", "outbound")
    .in("source", ["cruces", "cruces_reminder", "cruces_last_reminder"])
    .not("property_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openerLog?.property_id) return { handled: false };

  const stage = typeof openerLog.metadata?.match_whatsapp_stage === "string" ? openerLog.metadata.match_whatsapp_stage : null;
  if (stage && !["opener", "reminder", "final_reminder"].includes(stage)) return { handled: false };

  const { data: existingFollowUp } = await supabase
    .from("communication_logs")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("channel", "whatsapp")
    .eq("direction", "outbound")
    .eq("source", "cruces_followup")
    .eq("property_id", openerLog.property_id)
    .limit(1)
    .maybeSingle();

  if (existingFollowUp) return { handled: false, alreadySent: true };

  const { data: property } = await supabase
    .from("properties")
    .select("id, title, city, province")
    .eq("id", openerLog.property_id)
    .single();

  if (!property) return { handled: false };

  const propertyUrl = buildPropertyUrl(property);
  const preferredLanguage = resolveLeadLanguage(
    contact.preferred_language || (typeof openerLog.metadata?.preferred_language === "string" ? openerLog.metadata.preferred_language : null) || null,
    inboundText,
    (typeof openerLog.metadata?.body_preview === "string" ? openerLog.metadata.body_preview : null) || null,
    contact.full_name,
  );
  const followUpText = buildWhatsAppFollowUp(contact.full_name, propertyUrl, preferredLanguage);

  const destination = contact.phone || contact.phone2;
  if (!destination) return { handled: false };

  const result = await sendDirectMessage({
    channel: "whatsapp",
    to: destination,
    contactName: contact.full_name,
    text: followUpText,
  });

  if (openerLog.demand_id && property.id) {
    await supabase
      .from("matches")
      .update({ status: result.ok ? "enviado" : "pendiente" })
      .eq("demand_id", openerLog.demand_id)
      .eq("property_id", property.id);
  }

  await supabase.from("communication_logs").insert({
    contact_id: contact.id,
    channel: "whatsapp",
    direction: "outbound",
    source: "cruces_followup",
    body_preview: followUpText.slice(0, 500),
    provider_msg_id: result.provider_message_id || null,
    status: result.ok ? "enviado" : "error",
    error_message: result.ok ? null : (result.error || "Send failed"),
    agent_id: contact.agent_id || null,
    property_id: property.id,
    demand_id: openerLog.demand_id || null,
    metadata: {
      match_whatsapp_stage: "followup_link",
      replied_to_inbound: inboundText.slice(0, 250),
      property_url: propertyUrl,
      preferred_language: preferredLanguage,
      pending_response: false,
    },
  });

  await supabase.from("interactions").insert({
    contact_id: contact.id,
    interaction_type: "whatsapp",
    subject: `Auto-match follow-up: ${property.title}`,
    description: result.ok
      ? `Se envió el enlace de la vivienda tras la respuesta del contacto.`
      : `Falló el envío del enlace de la vivienda tras la respuesta del contacto: ${result.error || 'error desconocido'}`,
    agent_id: contact.agent_id || null,
  });

  if (result.ok) {
    await notifyPropertyLinkSentToAdmins(supabase, contact, property, openerLog.demand_id || null);
  }

  return { handled: result.ok, propertyId: property.id, sent: result.ok, error: result.error || null };
}

async function notifyPropertyLinkSentToAdmins(
  supabase: SupabaseClient,
  contact: ContactRecord,
  property: { id: string; title?: string | null; city?: string | null; province?: string | null },
  demandId: string | null,
) {
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (!admins?.length) return;

  const propertyLabel = property.title || "Propiedad";
  const locationLabel = property.city || property.province || "sin zona";
  const notifications = admins
    .filter((admin: UserRoleRow) => admin.user_id && admin.user_id !== contact.agent_id)
    .map((admin: UserRoleRow) => ({
      event_type: "property_link_sent",
      entity_type: "contact",
      entity_id: contact.id,
      title: `🔗 Enlace enviado a ${contact.full_name || "contacto"}`,
      description: `${propertyLabel} · ${locationLabel}`,
      agent_id: admin.user_id,
      metadata: {
        property_id: property.id,
        demand_id: demandId,
        contact_id: contact.id,
      },
    }));

  if (notifications.length) {
    await supabase.from("notifications").insert(notifications);
  }
}

/** Handle inbound messages from contacts */
async function handleInbound(supabase: SupabaseClient, body: WebhookPayload) {
  const { contact_id, text, channel, provider_msg_id } = body;

  if (!contact_id || !text) {
    return json({ ok: false, error: "contact_id and text are required for inbound" }, 400);
  }

  // Log the inbound message
  await supabase.from("communication_logs").insert({
    contact_id,
    channel: channel || "whatsapp",
    direction: "inbound",
    source: "inbound",
    body_preview: text.slice(0, 500),
    provider_msg_id: provider_msg_id || null,
    status: "recibido",
  });

  // Check contact and tags
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, tags, contact_type, pipeline_stage, agent_id, phone, phone2, email, notes, preferred_language")
    .eq("id", contact_id)
    .single();

  if (!contact) {
    console.log("multichannel-webhook inbound: contact not found", contact_id);
    return json({ ok: true, classified: false, reason: "contact_not_found" });
  }

  const inboundLanguage = resolveContactLanguage(contact.preferred_language || null, text, contact.full_name);
  if (inboundLanguage !== normalizeContactLanguage(contact.preferred_language)) {
    await supabase.from("contacts").update({ preferred_language: inboundLanguage }).eq("id", contact_id);
    contact.preferred_language = inboundLanguage;
  }

  const tags: string[] = contact.tags || [];

  const autoMatchReply = await handleAutoMatchReply(supabase, contact, text, channel || "whatsapp");
  if (autoMatchReply.handled) {
    return json({ ok: true, classified: false, reason: "match_followup_sent", property_id: autoMatchReply.propertyId });
  }

  // ── FLOW 4: Contact has "qualify-pendiente" tag → qualify as comprador/prospecto ──
  if (tags.includes("qualify-pendiente")) {
    return await handleQualifyResponse(supabase, contact, text, channel);
  }

  // ── FLOW 3: Contact has "demanda-enrich-pendiente" tag → extract budget/zone ──
  if (tags.includes("demanda-enrich-pendiente")) {
    return await handleDemandEnrichResponse(supabase, contact, text, channel);
  }

  // ── FLOW 2: Contact has "demanda-pendiente" tag → extract demand from response ──
  if (tags.includes("demanda-pendiente")) {
    return await handleDemandExtraction(supabase, contact, text, channel);
  }

  // ── FLOW 1: Contact has "clasificacion-pendiente" → classify response ──
  if (!tags.includes("clasificacion-pendiente")) {
    console.log("multichannel-webhook inbound: contact not in campaign", contact_id);
    return json({ ok: true, classified: false, reason: "not_in_campaign" });
  }

  // Use AI to classify the response
  try {
    const classifyResult = await callAI('google/gemini-2.5-flash-lite', [
      {
        role: 'system',
        content: `Eres un clasificador de respuestas para una inmobiliaria. Analiza la respuesta del cliente y determina su intención.

Responde SOLO con un JSON (sin markdown) con estos campos:
- "classification": uno de "comprador" | "prospecto" | "inactivo" | "ambiguo"
  - "comprador": busca comprar, alquilar o invertir en una propiedad
  - "prospecto": tiene una propiedad que quiere vender o alquilar (es propietario)
  - "inactivo": no está interesado, pide que no le contacten, o similar
  - "ambiguo": no se puede determinar claramente (preguntas como "¿quién eres?", respuestas vagas, etc.)
- "confidence": número de 0 a 1 indicando confianza
- "pipeline_stage": "nuevo" para comprador/prospecto, "sin_interes" para inactivo, "revision_manual" para ambiguo
- "summary": resumen breve de la respuesta (1 línea)`,
      },
      {
        role: 'user',
        content: `Contacto: ${contact.full_name}\nRespuesta: "${text}"`,
      },
    ], { max_tokens: 300 });

    if (!classifyResult.content) {
      throw new Error("AI returned empty");
    }

    let cleaned = classifyResult.content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const classification = JSON.parse(cleaned) as ClassificationResult;

    // Update contact based on classification
    const newTags = tags.filter((t: string) => t !== "clasificacion-pendiente");
    newTags.push("clasificado-campana");

    const updateData: Record<string, unknown> = { tags: newTags };

    if (classification.classification === "comprador") {
      updateData.contact_type = "comprador";
      updateData.pipeline_stage = "nuevo";
      // Add tag to trigger demand extraction on next message
      updateData.tags = [...newTags, "demanda-pendiente"];
    } else if (classification.classification === "prospecto") {
      updateData.contact_type = "prospecto";
      updateData.pipeline_stage = "nuevo";
    } else if (classification.classification === "inactivo") {
      updateData.pipeline_stage = "sin_interes";
      updateData.status = "inactivo";
      updateData.tags = [...newTags, "nevera"];
    }

    await supabase.from("contacts").update(updateData).eq("id", contact_id);

    // Log the classification result
    await supabase.from("communication_logs").insert({
      contact_id,
      channel: "system",
      direction: "inbound",
      source: "campaign_classify",
      body_preview: `Clasificación: ${classification.classification} (${Math.round(classification.confidence * 100)}%). ${classification.summary}`,
      status: classification.classification === "ambiguo" ? "revision_manual" : "clasificado",
      metadata: {
        classification: classification.classification,
        confidence: classification.confidence,
        summary: classification.summary,
        needs_review: classification.classification === "ambiguo",
        original_text: text.slice(0, 500),
      },
    });

    // ── POST-CLASSIFICATION ACTIONS ──

    // COMPRADOR → Send follow-up asking what they're looking for
    if (classification.classification === "comprador") {
      await sendDemandFollowUp(supabase, contact, channel);
    }

    // PROSPECTO → Urgent notification to coordinator + agent 🏆
    if (classification.classification === "prospecto") {
      await notifyProspectDetected(supabase, contact, text);
    }

    console.log(`multichannel-webhook: classified ${contact.full_name} → ${classification.classification}`);
    return json({ ok: true, classified: true, classification: classification.classification });
  } catch (aiError) {
    const message = aiError instanceof Error ? aiError.message : "Unknown AI classification error";
    console.error("multichannel-webhook AI classification error:", message);
    const newTags = tags.filter((t: string) => t !== "clasificacion-pendiente");
    newTags.push("clasificado-campana");
    await supabase.from("contacts").update({ tags: newTags }).eq("id", contact_id);
    
    await supabase.from("communication_logs").insert({
      contact_id,
      channel: "system",
      direction: "inbound",
      source: "campaign_classify",
      body_preview: `Error IA al clasificar. Respuesta original: ${text.slice(0, 300)}`,
      status: "revision_manual",
      metadata: { needs_review: true, error: message, original_text: text.slice(0, 500) },
    });

    return json({ ok: true, classified: false, reason: "ai_error" });
  }
}

/**
 * Send a friendly follow-up to a buyer asking what they're looking for.
 * The next inbound will trigger demand extraction.
 */
async function sendDemandFollowUp(supabase: SupabaseClient, contact: ContactRecord, channel: string) {
  const isWhatsapp = channel === "whatsapp" || channel !== "email";
  const preferredLanguage = resolveContactLanguage(contact.preferred_language || null, contact.full_name, contact.notes);
  const message = buildDemandFollowUpMessage(contact.full_name, isWhatsapp ? "whatsapp" : "email", preferredLanguage);

  try {
    const destination = isWhatsapp
      ? (contact.phone || contact.phone2)
      : contact.email;

    if (!destination) {
      console.log(`sendDemandFollowUp: contact ${contact.id} has no ${isWhatsapp ? 'phone' : 'email'}`);
      return;
    }

    await sendDirectMessage({
      channel: isWhatsapp ? "whatsapp" : "email",
      to: destination,
      contactName: contact.full_name,
      text: message.text,
      subject: isWhatsapp ? undefined : message.subject,
      replyTo: isWhatsapp ? undefined : `campaign+${contact.id}@inbound.planhogar.es`,
    });

    // Log outbound
    await supabase.from("communication_logs").insert({
      contact_id: contact.id,
      channel: isWhatsapp ? "whatsapp" : "email",
      direction: "outbound",
      source: "campaign_demand_followup",
      body_preview: message.text.slice(0, 500),
      status: "enviado",
    });

    // Record interaction
    await supabase.from("interactions").insert({
      contact_id: contact.id,
      interaction_type: isWhatsapp ? "whatsapp" : "email",
      subject: "Follow-up campaña: preguntas para crear demanda",
      description: `Se preguntó al contacto qué busca para crear su demanda automáticamente.`,
    });

    console.log(`sendDemandFollowUp: sent to ${contact.full_name}`);
  } catch (error) {
    console.error("sendDemandFollowUp error:", error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * Extract demand details from contact's response and create demand in DB.
 */
async function handleDemandExtraction(supabase: SupabaseClient, contact: ContactRecord, text: string, channel: string) {
  const contactId = contact.id;
  const tags: string[] = contact.tags || [];

  try {
    const extractResult = await callAI('google/gemini-2.5-flash', [
      {
        role: 'system',
        content: `Eres un asistente inmobiliario que extrae datos de demanda de un mensaje de un cliente.

Analiza el mensaje y extrae la mayor cantidad de información posible. Responde SOLO con un JSON (sin markdown):

{
  "operation": "venta" | "alquiler" | null,
  "property_types": ["piso", "casa", "chalet", "adosado", "bungalow", "atico", "duplex", "estudio", "local", "terreno", "nave", "oficina"] (selecciona las que apliquen, array vacío si no se menciona),
  "cities": ["ciudad1", "ciudad2"] (array vacío si no se menciona),
  "zones": ["zona1"] (barrios o zonas específicas, array vacío si no se menciona),
  "min_bedrooms": número o null,
  "min_bathrooms": número o null,
  "min_price": número o null,
  "max_price": número o null,
  "min_surface": número en m² o null,
  "features": ["piscina", "garaje", "terraza", "jardín", "ascensor", "trastero", "aire acondicionado"] (las que mencione),
  "notes": "resumen libre de lo que pide el cliente, incluyendo detalles que no encajan en los campos anteriores",
  "has_enough_data": true si hay al menos operación O tipo de inmueble O zona, false si el mensaje es demasiado vago
}

IMPORTANTE:
- Si el cliente dice "casa" puede referirse a cualquier vivienda, pon ["piso", "casa", "chalet", "adosado"]
- Los precios en España suelen ser en euros. Si dice "200" probablemente son 200.000€
- Si dice "cerca de la playa", añádelo a features y notas
- Ciudades de la Costa Blanca comunes: Alicante, Benidorm, Torrevieja, Orihuela, Elche, Dénia, Jávea, Calpe, Altea, Villajoyosa, Santa Pola, Guardamar`,
      },
      {
        role: 'user',
        content: `Contacto: ${contact.full_name}\nMensaje: "${text}"`,
      },
    ], { max_tokens: 500 });

    if (!extractResult.content) throw new Error("AI returned empty for demand extraction");

    let cleaned = extractResult.content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const demandData = JSON.parse(cleaned) as DemandExtractionResult;

    // Remove "demanda-pendiente" tag
    const newTags = tags.filter((t: string) => t !== "demanda-pendiente");
    await supabase.from("contacts").update({ tags: newTags }).eq("id", contactId);

    if (demandData.has_enough_data) {
      // Create demand in DB
      const { data: demand, error: demandError } = await supabase.from("demands").insert({
        contact_id: contactId,
        operation: demandData.operation || "venta",
        property_types: demandData.property_types?.length ? demandData.property_types : [],
        cities: demandData.cities?.length ? demandData.cities : [],
        zones: demandData.zones?.length ? demandData.zones : [],
        min_bedrooms: demandData.min_bedrooms || null,
        min_bathrooms: demandData.min_bathrooms || null,
        min_price: demandData.min_price || null,
        max_price: demandData.max_price || null,
        min_surface: demandData.min_surface || null,
        features: demandData.features?.length ? demandData.features : [],
        notes: `[Auto-creada por campaña de clasificación] ${demandData.notes || ''}`,
        auto_match: true,
        is_active: true,
      }).select("id").single();

      if (demandError) {
        console.error("handleDemandExtraction: error creating demand:", demandError.message);
      } else {
        console.log(`handleDemandExtraction: demand created for ${contact.full_name} → ${demand.id}`);

        // Log it
        await supabase.from("communication_logs").insert({
          contact_id: contactId,
          channel: "system",
          direction: "inbound",
          source: "campaign_demand_created",
          body_preview: `Demanda creada automáticamente: ${demandData.operation || '?'} · ${(demandData.cities || []).join(', ') || 'sin zona'} · ${demandData.max_price ? demandData.max_price + '€' : 'sin presupuesto'}`,
          status: "clasificado",
          metadata: { demand_id: demand.id, extracted: demandData },
        });

        // Notify agent
        if (contact.agent_id) {
          await supabase.from("notifications").insert({
            event_type: "demand_auto_created",
            entity_type: "demand",
            entity_id: demand.id,
            title: `📋 Demanda creada: ${contact.full_name}`,
            description: `Campaña clasificación → ${demandData.operation || 'compra'} en ${(demandData.cities || []).join(', ') || 'zona por definir'}. ${demandData.max_price ? 'Presupuesto: ' + demandData.max_price + '€' : ''}`,
            agent_id: contact.agent_id,
          });
        }

        // Send confirmation to contact
        await sendDemandConfirmation(supabase, contact, demandData, channel);
      }
    } else {
      // Not enough data - log for review but don't create demand
      await supabase.from("communication_logs").insert({
        contact_id: contactId,
        channel: "system",
        direction: "inbound",
        source: "campaign_demand_incomplete",
        body_preview: `Datos insuficientes para crear demanda. Respuesta: ${text.slice(0, 300)}`,
        status: "revision_manual",
        metadata: { needs_review: true, extracted: demandData, original_text: text.slice(0, 500) },
      });

      console.log(`handleDemandExtraction: not enough data from ${contact.full_name}`);
    }

    return json({ ok: true, demand_created: demandData.has_enough_data, data: demandData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    console.error("handleDemandExtraction error:", message);
    // Remove tag to avoid infinite loop
    const newTags = tags.filter((t: string) => t !== "demanda-pendiente");
    await supabase.from("contacts").update({ tags: newTags }).eq("id", contactId);

    await supabase.from("communication_logs").insert({
      contact_id: contactId,
      channel: "system",
      direction: "inbound",
      source: "campaign_demand_error",
      body_preview: `Error extrayendo demanda. Respuesta: ${text.slice(0, 300)}`,
      status: "revision_manual",
      metadata: { needs_review: true, error: message, original_text: text.slice(0, 500) },
    });

    return json({ ok: true, demand_created: false, reason: "extraction_error" });
  }
}

/**
 * Send a brief confirmation to the contact that their demand was registered.
 */
async function sendDemandConfirmation(supabase: SupabaseClient, contact: ContactRecord, demandData: DemandExtractionResult, channel: string) {
  const isWhatsapp = channel === "whatsapp" || channel !== "email";

  const details = [];
  if (demandData.operation) details.push(demandData.operation === "alquiler" ? "alquiler" : "compra");
  if (demandData.cities?.length) details.push(`en ${demandData.cities.join(", ")}`);
  if (demandData.max_price) details.push(`hasta ${demandData.max_price.toLocaleString("es-ES")}€`);

  const detailStr = details.length ? ` (${details.join(", ")})` : "";
  const preferredLanguage = resolveContactLanguage(contact.preferred_language || null, contact.full_name, contact.notes);
  const localizedDetailStr =
    preferredLanguage === "en"
      ? detailStr
          .replace("(compra", "(buy")
          .replace("(alquiler", "(rental")
          .replace("en ", "in ")
          .replace("hasta ", "up to ")
      : preferredLanguage === "fr"
        ? detailStr
            .replace("(compra", "(achat")
            .replace("(alquiler", "(location")
            .replace("en ", "à ")
            .replace("hasta ", "jusqu'à ")
        : preferredLanguage === "de"
          ? detailStr
              .replace("(compra", "(Kauf")
              .replace("(alquiler", "(Miete")
              .replace("en ", "in ")
              .replace("hasta ", "bis ")
          : detailStr;
  const message = buildDemandConfirmationMessage(contact.full_name, localizedDetailStr, isWhatsapp ? "whatsapp" : "email", preferredLanguage);

  try {
    const destination = isWhatsapp ? (contact.phone || contact.phone2) : contact.email;
    if (!destination) return;

    await sendDirectMessage({
      channel: isWhatsapp ? "whatsapp" : "email",
      to: destination,
      contactName: contact.full_name,
      text: message.text,
      subject: isWhatsapp ? undefined : message.subject,
    });

    await supabase.from("communication_logs").insert({
      contact_id: contact.id,
      channel: isWhatsapp ? "whatsapp" : "email",
      direction: "outbound",
      source: "campaign_demand_confirmation",
      body_preview: message.text.slice(0, 500),
      status: "enviado",
    });
  } catch (error) {
    console.error("sendDemandConfirmation error:", error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * 🏆 PROSPECT DETECTED - Notify coordinator + agent urgently.
 * Prospects are gold for the agency.
 */
async function notifyProspectDetected(supabase: SupabaseClient, contact: ContactRecord, originalText: string) {
  const contactName = contact.full_name || "Contacto";

  // Get all coordinators and admins
  const { data: supervisors } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "coordinadora"]);

  const notifTitle = `🏆 ¡Nuevo prospecto detectado!`;
  const notifDesc = `${contactName} tiene algo para vender/alquilar. Respuesta: "${originalText.slice(0, 150)}"`;

  const notifications = [];

  // Notify agent (if assigned)
  if (contact.agent_id) {
    notifications.push({
      event_type: "prospect_detected",
      entity_type: "contact",
      entity_id: contact.id,
      title: notifTitle,
      description: notifDesc,
      agent_id: contact.agent_id,
    });
  }

  // Notify all admins and coordinators
  if (supervisors?.length) {
    for (const sup of supervisors) {
      // Avoid duplicate if agent is also admin/coord
      if (sup.user_id === contact.agent_id) continue;
      notifications.push({
        event_type: "prospect_detected",
        entity_type: "contact",
        entity_id: contact.id,
        title: notifTitle,
        description: notifDesc,
        agent_id: sup.user_id,
      });
    }
  }

  if (notifications.length) {
    await supabase.from("notifications").insert(notifications);
  }

  // Also try push notification for immediate attention
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && serviceKey) {
      const pushTargets = [contact.agent_id, ...((supervisors as UserRoleRow[] | null) || []).map((s) => s.user_id)].filter(Boolean);
      const uniqueTargets = [...new Set(pushTargets)];

      for (const targetId of uniqueTargets) {
        fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            agent_id: targetId,
            title: notifTitle,
            body: `${contactName} quiere vender/alquilar. ¡Contactar ya!`,
            data: { table: "contacts", id: contact.id },
          }),
        }).catch(() => {}); // Fire and forget
      }
    }
  } catch (error) {
    console.error("notifyProspectDetected push error:", error instanceof Error ? error.message : "Unknown error");
  }

  // Create urgent task for the agent
  if (contact.agent_id) {
    await supabase.from("tasks").insert({
      agent_id: contact.agent_id,
      title: `🏆 Contactar prospecto: ${contactName}`,
      description: `Prospecto detectado en campaña de clasificación. ${contactName} tiene una propiedad para vender/alquilar. Respuesta original: "${originalText.slice(0, 200)}". ¡Contactar lo antes posible!`,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      priority: "alta",
      task_type: "llamada",
      contact_id: contact.id,
    });
  }

  console.log(`notifyProspectDetected: ${contactName} → ${notifications.length} notifications + task created`);
}

/**
 * Handle responses from the qualify campaign (propietarios + contactos → comprador/prospecto).
 */
async function handleQualifyResponse(supabase: SupabaseClient, contact: ContactRecord, text: string, channel: string) {
  const contactId = contact.id;
  const tags: string[] = contact.tags || [];

  // Check for stop intent first
  const stopWords = ["no me escribas", "déjame en paz", "no me contactes", "baja", "stop", "para", "no quiero"];
  const lowerText = text.toLowerCase().trim();
  const wantsStop = stopWords.some(w => lowerText.includes(w));

  if (wantsStop) {
    const newTags = tags.filter((t: string) => t !== "qualify-pendiente");
    newTags.push("qualify-done", "no-contactar");
    await supabase.from("contacts").update({ tags: newTags, status: "inactivo" }).eq("id", contactId);

    await supabase.from("communication_logs").insert({
      contact_id: contactId, channel: "system", direction: "inbound",
      source: "campaign_qualify", body_preview: `Contacto pidió no ser contactado. Respuesta: "${text.slice(0, 200)}"`,
      status: "clasificado", metadata: { classification: "stop", original_text: text.slice(0, 500), contact_name: contact.full_name },
    });

    if (contact.agent_id) {
      await supabase.from("notifications").insert({
        event_type: "campaign_qualify", entity_type: "contact", entity_id: contactId,
        title: `🛑 ${contact.full_name} — no contactar`,
        description: `El contacto pidió que no le escribamos: "${text.slice(0, 150)}"`,
        agent_id: contact.agent_id,
      });
    }

    return json({ ok: true, classified: true, classification: "stop" });
  }

  try {
    const classifyResult = await callAI('google/gemini-2.5-flash-lite', [
      {
        role: 'system',
        content: `Eres un clasificador de respuestas para una inmobiliaria. El contacto respondió a un mensaje de cualificación.

Analiza la respuesta y determina la intención. Responde SOLO con JSON (sin markdown):
- "classification": "comprador" | "prospecto" | "inactivo" | "ambiguo"
  - "comprador": busca comprar, alquilar o invertir en una propiedad
  - "prospecto": tiene una propiedad que quiere vender o alquilar
  - "inactivo": no está interesado, no necesita nada
  - "ambiguo": no se puede determinar
- "confidence": 0-1
- "summary": resumen breve (1 línea)`,
      },
      {
        role: 'user',
        content: `Contacto: ${contact.full_name} (tipo actual: ${contact.contact_type})\nRespuesta: "${text}"`,
      },
    ], { max_tokens: 300 });

    if (!classifyResult.content) throw new Error("AI returned empty");

    let cleaned = classifyResult.content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const classification = JSON.parse(cleaned) as ClassificationResult;

    const newTags = tags.filter((t: string) => t !== "qualify-pendiente");
    newTags.push("qualify-done");

    const updateData: Record<string, unknown> = { tags: newTags };
    let notifTitle = "";
    let notifDesc = "";

    if (classification.classification === "comprador") {
      updateData.contact_type = "comprador";
      updateData.pipeline_stage = "nuevo";
      newTags.push("qualify-comprador");
      updateData.tags = [...newTags, "demanda-pendiente"];
      notifTitle = `🏠 ${contact.full_name} → COMPRADOR`;
      notifDesc = `Cualificación: quiere comprar. ${classification.summary}`;
      await sendDemandFollowUp(supabase, contact, channel);
    } else if (classification.classification === "prospecto") {
      updateData.contact_type = "prospecto";
      updateData.pipeline_stage = "nuevo";
      newTags.push("qualify-prospecto");
      updateData.tags = newTags;
      notifTitle = `🔑 ${contact.full_name} → PROSPECTO`;
      notifDesc = `Cualificación: tiene algo para vender. ${classification.summary}`;
      await notifyProspectDetected(supabase, contact, text);
    } else if (classification.classification === "inactivo") {
      updateData.pipeline_stage = "sin_interes";
      updateData.status = "inactivo";
      newTags.push("no-contactar");
      updateData.tags = newTags;
      notifTitle = `❌ ${contact.full_name} → Inactivo`;
      notifDesc = `Cualificación: no interesado. ${classification.summary}`;
    }

    await supabase.from("contacts").update(updateData).eq("id", contactId);

    await supabase.from("communication_logs").insert({
      contact_id: contactId, channel: "system", direction: "inbound",
      source: "campaign_qualify",
      body_preview: `Cualificación: ${classification.classification} (${Math.round(classification.confidence * 100)}%). ${classification.summary}`,
      status: classification.classification === "ambiguo" ? "revision_manual" : "clasificado",
      metadata: {
        classification: classification.classification, confidence: classification.confidence,
        summary: classification.summary, original_text: text.slice(0, 500),
        contact_name: contact.full_name, previous_type: contact.contact_type,
        needs_review: classification.classification === "ambiguo",
      },
    });

    // Notify agent + admins about reassignment
    if (notifTitle && contact.agent_id) {
      await supabase.from("notifications").insert({
        event_type: "campaign_qualify", entity_type: "contact", entity_id: contactId,
        title: notifTitle, description: notifDesc, agent_id: contact.agent_id,
      });
    }
    if (notifTitle) {
      const { data: supervisors } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "coordinadora"]);
      if (supervisors?.length) {
        const notifs = (supervisors as UserRoleRow[]).filter((s) => s.user_id !== contact.agent_id).map((s) => ({
          event_type: "campaign_qualify", entity_type: "contact", entity_id: contactId,
          title: notifTitle, description: notifDesc, agent_id: s.user_id,
        }));
        if (notifs.length) await supabase.from("notifications").insert(notifs);
      }
    }

    console.log(`handleQualifyResponse: ${contact.full_name} (${contact.contact_type}) → ${classification.classification}`);
    return json({ ok: true, classified: true, classification: classification.classification });
  } catch (aiError) {
    const message = aiError instanceof Error ? aiError.message : "Unknown AI error";
    console.error("handleQualifyResponse AI error:", message);
    const newTags = tags.filter((t: string) => t !== "qualify-pendiente");
    newTags.push("qualify-done");
    await supabase.from("contacts").update({ tags: newTags }).eq("id", contactId);

    await supabase.from("communication_logs").insert({
      contact_id: contactId, channel: "system", direction: "inbound",
      source: "campaign_qualify",
      body_preview: `Error IA al cualificar. Respuesta: ${text.slice(0, 300)}`,
      status: "revision_manual",
      metadata: { needs_review: true, error: message, original_text: text.slice(0, 500), contact_name: contact.full_name },
    });

    return json({ ok: true, classified: false, reason: "ai_error" });
  }
}

/**
 * Handle responses from the demand enrichment campaign.
 * Uses conversational AI to extract budget/zone from natural language,
 * and continues the conversation if data is incomplete or unclear.
 */
async function handleDemandEnrichResponse(supabase: SupabaseClient, contact: ContactRecord, text: string, channel: string) {
  const contactId = contact.id;
  const tags: string[] = contact.tags || [];
  const MAX_CONVERSATION_TURNS = 999; // No limit — keep until complete or opt-out
  const preferredLanguage = resolveContactLanguage(contact.preferred_language || null, text, contact.full_name, contact.notes);

  try {
    const { data: demands } = await supabase
      .from("demands")
      .select("id, operation, property_type, max_price, cities, zones, min_price")
      .eq("contact_id", contactId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);

    const demand = (demands as DemandRow[] | null)?.[0];
    if (!demand) {
      const newTags = tags.filter((t: string) => t !== "demanda-enrich-pendiente");
      await supabase.from("contacts").update({ tags: newTags }).eq("id", contactId);
      return json({ ok: true, enriched: false, reason: "no_demand" });
    }

    // Load conversation history
    const { data: convHistory } = await supabase
      .from("communication_logs")
      .select("direction, body_preview, created_at")
      .eq("contact_id", contactId)
      .eq("source", "campaign_demand_enrich")
      .neq("channel", "system")
      .order("created_at", { ascending: true })
      .limit(20);

    const history = (convHistory as ConversationRow[] | null) || [];
    const outboundCount = history.filter((h) => h.direction === "outbound").length;

    if (outboundCount >= MAX_CONVERSATION_TURNS) {
      const newTags = tags.filter((t: string) => t !== "demanda-enrich-pendiente");
      newTags.push("demanda-enrich-sin-respuesta");
      await supabase.from("contacts").update({ tags: newTags }).eq("id", contactId);
      await supabase.from("communication_logs").insert({
        contact_id: contactId, channel: "system", direction: "inbound",
        source: "campaign_demand_enrich",
        body_preview: `Conversación agotada tras ${outboundCount} mensajes.`,
        status: "revision_manual",
        metadata: { needs_review: true, original_text: text.slice(0, 500), contact_name: contact.full_name },
      });
      return json({ ok: true, enriched: false, reason: "max_turns_reached" });
    }

    const conversationMessages = history.map((h) => ({
      role: h.direction === "outbound" ? "assistant" as const : "user" as const,
      content: h.body_preview || "",
    }));
    conversationMessages.push({ role: "user" as const, content: text });

    const missingBudget = demand.max_price == null;
    const missingZone = !demand.cities?.length;
    const missingParts = [missingBudget && "presupuesto", missingZone && "zona/ciudad"].filter(Boolean);

    const extractResult = await callAI('google/gemini-2.5-flash', [
      {
        role: 'system',
        content: `Eres Alicia, asistente virtual de Legado Inmobiliaria. Estás manteniendo una conversación por WhatsApp con un comprador para completar los datos de su búsqueda inmobiliaria.

CONTEXTO DE LA DEMANDA ACTUAL:
- Operación: ${demand.operation || 'compra'}
- Tipo: ${demand.property_type || 'no especificado'}
- Presupuesto actual: ${demand.max_price ? demand.max_price + '€' : '❌ SIN DEFINIR'}
- Zona actual: ${demand.cities?.length ? demand.cities.join(', ') : '❌ SIN DEFINIR'}
- Datos que FALTAN: ${missingParts.join(' y ') || 'ninguno'}

TU TAREA:
1. Analiza el ÚLTIMO mensaje del contacto y extrae cualquier dato sobre presupuesto o zona.
2. Si el contacto dice algo que NO tiene que ver con inmuebles (saludo, pregunta, comentario personal), responde con naturalidad y redirige suavemente.
3. Si pudiste extraer datos, confirma lo que entendiste y pregunta por lo que falta (si falta algo).
4. Si el contacto dice que no sabe o necesita pensarlo, sé comprensivo y sugiere opciones concretas.
5. Si el contacto pide que no le escribas más, respeta su decisión.

INTERPRETACIÓN DE LENGUAJE NATURAL:
- "por la zona de Alicante" → cities: ["Alicante"]
- "no más de 200" o "unos 200" → max_price: 200000
- "200k" o "200mil" → max_price: 200000
- "entre 150 y 250" → min_price: 150000, max_price: 250000
- "algo económico" → no es suficiente, pregunta rango
- "cerca de la playa" → añadir a notes, preguntar ciudad concreta
- "me da igual la zona" → no forzar, preguntar si tiene preferencia por norte/sur Costa Blanca
- "no sé cuánto" → sugerir rangos: "hasta 150k", "150-300k", "más de 300k"
- "déjame en paz" / "no me escribas" → stop: true

TONO: Cálida, directa, como una amiga. Máximo 3-4 líneas por WhatsApp. NUNCA suenes como un formulario.
IDIOMA: La respuesta al cliente debe salir íntegramente en ${languageName(preferredLanguage)}.

Responde SOLO con JSON (sin markdown):
{
  "max_price": número o null,
  "min_price": número o null,
  "cities": ["ciudad1"] o [],
  "zones": ["zona1"] o [],
  "notes": "resumen libre",
  "extracted_something": true/false,
  "still_missing": ["presupuesto", "zona"],
  "stop": false,
  "reply": "tu respuesta natural como Alicia por WhatsApp"
}`,
      },
      ...conversationMessages,
    ], { max_tokens: 600 });

    if (!extractResult.content) throw new Error("AI returned empty");

    let cleaned = extractResult.content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    const extracted = JSON.parse(cleaned) as DemandEnrichResult;

    if (extracted.stop) {
      const newTags = tags.filter((t: string) => t !== "demanda-enrich-pendiente");
      newTags.push("nevera");
      await supabase.from("contacts").update({ tags: newTags, status: "inactivo" }).eq("id", contactId);
      await supabase.from("communication_logs").insert({
        contact_id: contactId, channel: "system", direction: "inbound",
        source: "campaign_demand_enrich",
        body_preview: `Contacto pidió que no le escriban más → nevera.`,
        status: "clasificado",
        metadata: { stop_requested: true, nevera: true, original_text: text.slice(0, 500) },
      });

      // Notify agent
      if (contact.agent_id) {
        await supabase.from("notifications").insert({
          event_type: "contact_nevera", entity_type: "contact", entity_id: contactId,
          title: `❄️ ${contact.full_name} → Nevera`,
          description: `El contacto pidió que no le escribamos más. Respuesta: "${text.slice(0, 150)}"`,
          agent_id: contact.agent_id,
        });
      }

      return json({ ok: true, enriched: false, reason: "stop_requested_nevera" });
    }

    const updateData: Record<string, unknown> = {};
    if (extracted.max_price && !demand.max_price) updateData.max_price = extracted.max_price;
    if (extracted.min_price && !demand.min_price) updateData.min_price = extracted.min_price;
    if (extracted.cities?.length && !demand.cities?.length) updateData.cities = extracted.cities;
    if (extracted.zones?.length && !demand.zones?.length) updateData.zones = extracted.zones;

    const didUpdate = Object.keys(updateData).length > 0;
    if (didUpdate) {
      await supabase.from("demands").update(updateData).eq("id", demand.id);
    }

    const nowHasBudget = !!(extracted.max_price || demand.max_price);
    const nowHasZone = !!(extracted.cities?.length || demand.cities?.length);
    const isComplete = nowHasBudget && nowHasZone;

    if (isComplete) {
      const newTags = tags.filter((t: string) => t !== "demanda-enrich-pendiente");
      newTags.push("demanda-enriquecida");
      await supabase.from("contacts").update({ tags: newTags }).eq("id", contactId);

      await supabase.from("communication_logs").insert({
        contact_id: contactId, channel: "system", direction: "inbound",
        source: "campaign_demand_enrich",
        body_preview: `Demanda enriquecida: ${extracted.cities?.length ? extracted.cities.join(', ') : demand.cities?.join(', ') || '-'} · ${(extracted.max_price || demand.max_price) + '€'}`,
        status: "clasificado",
        metadata: { demand_id: demand.id, extracted, original_text: text.slice(0, 500) },
      });

      if (contact.agent_id) {
        await supabase.from("notifications").insert({
          event_type: "demand_enriched", entity_type: "demand", entity_id: demand.id,
          title: `📋 Demanda enriquecida: ${contact.full_name}`,
          description: `${extracted.cities?.length ? 'Zona: ' + extracted.cities.join(', ') : ''} ${extracted.max_price ? 'Presupuesto: ' + extracted.max_price + '€' : ''}`.trim(),
          agent_id: contact.agent_id,
        });
      }

      if (extracted.reply) await sendEnrichReply(supabase, contact, extracted.reply, channel);
      console.log(`handleDemandEnrichResponse: COMPLETE for ${contact.full_name}`);
      return json({ ok: true, enriched: true, data: extracted });
    }

    // Still incomplete → continue conversation
    if (extracted.reply) await sendEnrichReply(supabase, contact, extracted.reply, channel);

    await supabase.from("communication_logs").insert({
      contact_id: contactId, channel: "system", direction: "inbound",
      source: "campaign_demand_enrich",
      body_preview: `Datos parciales: ${JSON.stringify(extracted.still_missing || [])}. Continuando conversación.`,
      status: "pendiente",
      metadata: { demand_id: demand.id, extracted, still_missing: extracted.still_missing, original_text: text.slice(0, 500) },
    });

    console.log(`handleDemandEnrichResponse: partial from ${contact.full_name}, continuing`);
    return json({ ok: true, enriched: false, partial: didUpdate, still_missing: extracted.still_missing });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown enrich error";
    console.error("handleDemandEnrichResponse error:", message);
    await supabase.from("communication_logs").insert({
      contact_id: contactId, channel: "system", direction: "inbound",
      source: "campaign_demand_enrich",
      body_preview: `Error en conversación: ${text.slice(0, 300)}`,
      status: "revision_manual",
      metadata: { needs_review: true, error: message, original_text: text.slice(0, 500) },
    });
    return json({ ok: true, enriched: false, reason: "extraction_error" });
  }
}

/** Send a conversational reply in the demand enrichment flow */
async function sendEnrichReply(supabase: SupabaseClient, contact: ContactRecord, replyText: string, channel: string) {
  try {
    const isWhatsapp = channel === "whatsapp" || channel !== "email";
    const destination = isWhatsapp ? (contact.phone || contact.phone2) : contact.email;
    if (!destination) return;

    await sendDirectMessage({
      channel: isWhatsapp ? "whatsapp" : "email",
      to: destination,
      contactName: contact.full_name,
      text: replyText,
    });

    await supabase.from("communication_logs").insert({
      contact_id: contact.id,
      channel: isWhatsapp ? "whatsapp" : "email",
      direction: "outbound",
      source: "campaign_demand_enrich",
      body_preview: replyText.slice(0, 500),
      status: "enviado",
    });
  } catch (error) {
    console.error("sendEnrichReply error:", error instanceof Error ? error.message : "Unknown error");
  }
}

/** Handle status updates (existing logic) */
async function handleStatusUpdate(supabase: SupabaseClient, body: WebhookPayload) {
  const { provider_msg_id, status, error_message, metadata } = body;

  if (!provider_msg_id || !status) {
    return json({ ok: false, error: "provider_msg_id and status are required" }, 400);
  }

  const validStatuses = ["enviado", "entregado", "abierto", "rebotado", "error"];
  if (!validStatuses.includes(status)) {
    return json({ ok: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, 400);
  }

  const updateData: Record<string, unknown> = { status };
  if (error_message) updateData.error_message = error_message;
  if (metadata) {
    const { data: existing } = await supabase
      .from("communication_logs")
      .select("metadata")
      .eq("provider_msg_id", provider_msg_id)
      .limit(1)
      .single();

    updateData.metadata = { ...((existing?.metadata as Record<string, unknown> | null) || {}), ...metadata, [`${status}_at`]: new Date().toISOString() };
  }

  const { error } = await supabase
    .from("communication_logs")
    .update(updateData)
    .eq("provider_msg_id", provider_msg_id);

  if (error) {
    console.error("multichannel-webhook update error:", error.message);
    return json({ ok: false, error: error.message }, 500);
  }

  console.log(`multichannel-webhook: updated ${provider_msg_id} → ${status}`);
  return json({ ok: true });
}
