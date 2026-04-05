import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * Receives incoming webhooks directly from Green API.
 * Parses the Green API format, finds the contact by phone number,
 * and forwards to the inbound webhook handler for AI classification.
 *
 * Green API sends:
 * {
 *   "typeWebhook": "incomingMessageReceived",
 *   "senderData": { "chatId": "34600123456@c.us", "sender": "34600123456@c.us", "senderName": "..." },
 *   "messageData": { "typeMessage": "textMessage", "textMessageData": { "textMessage": "..." } }
 * }
 */

type GreenApiWebhookBody = {
  typeWebhook?: string;
  senderData?: {
    chatId?: string | null;
    sender?: string | null;
    senderName?: string | null;
  } | null;
  messageData?: {
    typeMessage?: string | null;
    textMessageData?: { textMessage?: string | null } | null;
    extendedTextMessageData?: { text?: string | null } | null;
    buttonsResponseMessageData?: { selectedButtonText?: string | null } | null;
    listResponseMessageData?: { title?: string | null } | null;
  } | null;
  idMessage?: string | null;
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const webhookSecret = Deno.env.get("GREENAPI_WEBHOOK_SECRET");
    const authorizationHeader = req.headers.get("authorization");
    const normalizedAuthorization = authorizationHeader?.replace(/^Bearer\s+/i, "").trim();
    const providedSecret =
      req.headers.get("x-greenapi-key") ||
      req.headers.get("x-webhook-secret") ||
      normalizedAuthorization ||
      authorizationHeader;

    if (!webhookSecret) {
      console.error("[greenapi-webhook] GREENAPI_WEBHOOK_SECRET not configured");
      return json({ ok: false, error: "webhook_not_configured" }, 500);
    }

    if (providedSecret !== webhookSecret) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const body = await req.json() as GreenApiWebhookBody;
    console.log("[greenapi-webhook] Received:", body.typeWebhook, body.senderData?.sender);

    // Only process incoming text messages
    if (body.typeWebhook !== "incomingMessageReceived") {
      console.log("[greenapi-webhook] Ignoring webhook type:", body.typeWebhook);
      return json({ ok: true, skipped: true, reason: body.typeWebhook });
    }

    const sender = body.senderData?.sender || body.senderData?.chatId;
    if (!sender) {
      return json({ ok: false, error: "No sender in webhook" }, 400);
    }

    // Extract phone number from Green API format: "34600123456@c.us" → "+34600123456"
    const rawPhone = sender.replace("@c.us", "").replace("@g.us", "");
    const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;

    // Extract message text
    let text = "";
    const msgData = body.messageData;
    if (msgData?.typeMessage === "textMessage") {
      text = msgData.textMessageData?.textMessage || "";
    } else if (msgData?.typeMessage === "extendedTextMessage") {
      text = msgData.extendedTextMessageData?.text || "";
    } else if (msgData?.typeMessage === "buttonsResponseMessage") {
      text = msgData.buttonsResponseMessageData?.selectedButtonText || "";
    } else if (msgData?.typeMessage === "listResponseMessage") {
      text = msgData.listResponseMessageData?.title || "";
    } else {
      // Image, video, document, etc. — log but skip classification
      console.log("[greenapi-webhook] Non-text message type:", msgData?.typeMessage);
      return json({ ok: true, skipped: true, reason: "non_text_message" });
    }

    if (!text.trim()) {
      return json({ ok: true, skipped: true, reason: "empty_text" });
    }

    // Find contact by phone in CRM
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const normalizeDigits = (value?: string | null) => String(value || "").replace(/\D+/g, "");
    const senderDigits = normalizeDigits(rawPhone);
    const senderLast9 = senderDigits.slice(-9);
    const senderLast7 = senderDigits.slice(-7);
    const senderCandidates = new Set([
      senderDigits,
      senderDigits.startsWith("34") ? senderDigits.slice(2) : senderDigits,
      senderLast9,
    ].filter(Boolean));

    let contact = null;

    // Fast path: exact or raw contains
    const fastCandidates = Array.from(new Set([phone, rawPhone, senderDigits, senderLast9].filter(Boolean)));
    for (const candidate of fastCandidates) {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, phone, phone2")
        .or(`phone.eq.${candidate},phone2.eq.${candidate},phone.like.%${candidate},phone2.like.%${candidate}`)
        .limit(1)
        .maybeSingle();

      if (data) {
        contact = data;
        break;
      }
    }

    // Slow path: fetch likely candidates by suffix and normalize locally
    if (!contact && senderLast7) {
      const { data: possibleContacts } = await supabase
        .from("contacts")
        .select("id, full_name, phone, phone2")
        .or(`phone.like.%${senderLast7}%,phone2.like.%${senderLast7}%`)
        .limit(50);

      for (const item of possibleContacts || []) {
        const phone1 = normalizeDigits(item.phone);
        const phone2 = normalizeDigits(item.phone2);
        const matches =
          senderCandidates.has(phone1) ||
          senderCandidates.has(phone2) ||
          (senderLast9 && phone1.endsWith(senderLast9)) ||
          (senderLast9 && phone2.endsWith(senderLast9));

        if (matches) {
          contact = item;
          break;
        }
      }
    }

    if (!contact) {
      console.log("[greenapi-webhook] No contact found for phone:", phone);
      // Could create a new contact here in the future
      return json({ ok: true, skipped: true, reason: "contact_not_found", phone });
    }

    console.log(`[greenapi-webhook] Matched contact: ${contact.full_name} (${contact.id})`);

    // ── Reply detection: pause prospecting sequence if active ──
    const { data: activeSeq } = await supabase
      .from('prospecting_sequences')
      .select('id')
      .eq('contact_id', contact.id)
      .eq('completed', false)
      .eq('replied', false)
      .maybeSingle();

    if (activeSeq) {
      await supabase
        .from('prospecting_sequences')
        .update({ replied: true, paused: true })
        .eq('id', activeSeq.id);

      // Create urgent task for agent
      const { data: seqData } = await supabase
        .from('prospecting_sequences')
        .select('agent_id')
        .eq('id', activeSeq.id)
        .single();

      if (seqData?.agent_id) {
        await supabase.from('tasks').insert({
          agent_id: seqData.agent_id,
          title: `🔥 Prospecto respondió: ${contact.full_name}`,
          description: `El prospecto ha respondido al WhatsApp de captación: "${text.substring(0, 100)}". Contactar de inmediato.`,
          due_date: new Date().toISOString(),
          priority: 'alta',
          task_type: 'seguimiento',
          contact_id: contact.id,
          source: 'prospecting_reply',
        });

        // Push notification
        await supabase.from('notifications').insert({
          event_type: 'prospecting_reply',
          entity_type: 'contact',
          entity_id: contact.id,
          title: `🔥 Prospecto respondió: ${contact.full_name}`,
          description: text.substring(0, 200),
          agent_id: seqData.agent_id,
        });
      }

      console.log(`[greenapi-webhook] Paused prospecting sequence for ${contact.full_name}`);
    }

    // Forward to inbound handler using service key
    const fwdResponse = await fetch(`${supabaseUrl}/functions/v1/multichannel-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: "inbound",
        contact_id: contact.id,
        text: text.trim(),
        channel: "whatsapp",
        provider_msg_id: body.idMessage || null,
      }),
    });

    const fwdResult = await fwdResponse.json();
    console.log(`[greenapi-webhook] Forwarded to inbound handler:`, fwdResult);

    return json({ ok: true, contact: contact.full_name, forwarded: fwdResult });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unexpected_error";
    console.error("[greenapi-webhook] Error:", message);
    return json({ ok: false, error: message }, 500);
  }
});
