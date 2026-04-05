import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * Receives inbound emails from Brevo Inbound Parsing.
 * Extracts contact_id from the "To" address (campaign+{contactId}@inbound.planhogar.es),
 * parses the email body, and forwards to the inbound webhook handler for AI classification.
 *
 * Brevo Inbound Parsing sends a POST with multipart/form-data or JSON containing:
 * - Sender: { Email, Name }
 * - Recipient: [{ Address, Name }] (the To address)
 * - Subject
 * - RawHtmlBody / RawTextBody
 * - ExtractedMarkdownMessage (cleaned reply text)
 * - Items[].RawTextBody / Items[].TextBody (parsed parts)
 *
 * Setup required:
 * 1. Configure MX record for inbound.planhogar.es → Brevo inbound servers
 * 2. In Brevo dashboard → Transactional → Inbound Parsing → Add domain
 * 3. Set webhook URL: https://edeprsrdumcnhixijlfu.supabase.co/functions/v1/brevo-inbound
 */

interface BrevoRecipient {
  Address?: string | null;
  Email?: string | null;
}

interface BrevoItem {
  RawTextBody?: string | null;
  TextBody?: string | null;
}

interface BrevoInboundPayload {
  Sender?: {
    Email?: string | null;
    Name?: string | null;
  } | null;
  Recipient?: BrevoRecipient[] | BrevoRecipient | string | null;
  Recipients?: BrevoRecipient[] | BrevoRecipient | string | null;
  Subject?: string | null;
  RawTextBody?: string | null;
  TextBody?: string | null;
  ExtractedMarkdownMessage?: string | null;
  Items?: BrevoItem[] | null;
  MessageId?: string | null;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const webhookSecret = Deno.env.get("BREVO_INBOUND_SECRET");
    const providedSecret =
      req.headers.get("x-brevo-key") ||
      req.headers.get("x-webhook-secret");

    if (!webhookSecret) {
      console.error("[brevo-inbound] BREVO_INBOUND_SECRET not configured");
      return json({ ok: false, error: "webhook_not_configured" }, 500);
    }

    if (providedSecret !== webhookSecret) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    let body: BrevoInboundPayload;
    const contentType = req.headers.get("content-type") || "";

    // Brevo can send as JSON or multipart form data
    if (contentType.includes("application/json")) {
      body = await req.json() as BrevoInboundPayload;
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      // Brevo sends the payload in an "items" field or as individual fields
      const itemsRaw = formData.get("items");
      if (itemsRaw) {
        body = JSON.parse(itemsRaw as string) as BrevoInboundPayload;
        // items is an array, take first
        if (Array.isArray(body)) body = (body[0] ?? {}) as BrevoInboundPayload;
      } else {
        // Try individual fields
        body = {
          Sender: { Email: formData.get("Sender") },
          Recipient: [{ Address: formData.get("Recipient") }],
          Subject: formData.get("Subject"),
          RawTextBody: formData.get("RawTextBody") || formData.get("TextBody"),
          ExtractedMarkdownMessage: formData.get("ExtractedMarkdownMessage"),
        };
      }
    } else {
      body = await req.json() as BrevoInboundPayload;
    }

    console.log("[brevo-inbound] Received email from:", body?.Sender?.Email, "to:", JSON.stringify(body?.Recipient));

    // Extract contact_id from the To address
    // Format: campaign+{uuid}@inbound.planhogar.es
    const recipients = body?.Recipient || body?.Recipients || [];
    let contactId: string | null = null;

    for (const r of (Array.isArray(recipients) ? recipients : [recipients])) {
      const addr = typeof r === "string" ? r : r?.Address || r?.Email || "";
      const match = addr.match(/campaign\+([a-f0-9-]{36})@/i);
      if (match) {
        contactId = match[1];
        break;
      }
    }

    if (!contactId) {
      console.log("[brevo-inbound] Could not extract contact_id from recipients:", JSON.stringify(recipients));
      return json({ ok: false, error: "No contact_id in recipient address" }, 400);
    }

    // Extract the reply text (prefer extracted/cleaned version)
    const text =
      body?.ExtractedMarkdownMessage?.trim() ||
      body?.RawTextBody?.trim() ||
      body?.TextBody?.trim() ||
      body?.Items?.[0]?.RawTextBody?.trim() ||
      body?.Items?.[0]?.TextBody?.trim() ||
      "";

    if (!text) {
      console.log("[brevo-inbound] Empty email body from:", body?.Sender?.Email);
      return json({ ok: true, skipped: true, reason: "empty_body" });
    }

    // Verify contact exists
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, full_name")
      .eq("id", contactId)
      .single();

    if (!contact) {
      console.log("[brevo-inbound] Contact not found:", contactId);
      return json({ ok: false, error: "contact_not_found" }, 404);
    }

    console.log(`[brevo-inbound] Email reply from ${body?.Sender?.Email} → contact: ${contact.full_name} (${contact.id})`);

    // Forward to inbound webhook handler using service key
    const fwdResponse = await fetch(`${supabaseUrl}/functions/v1/multichannel-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: "inbound",
        contact_id: contact.id,
        text: text.slice(0, 2000), // limit to avoid huge payloads
        channel: "email",
        provider_msg_id: body?.MessageId || null,
      }),
    });

    const fwdResult = await fwdResponse.json() as Record<string, unknown>;
    console.log(`[brevo-inbound] Forwarded to inbound handler:`, fwdResult);

    return json({
      ok: true,
      contact: contact.full_name,
      subject: body?.Subject,
      forwarded: fwdResult,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[brevo-inbound] Error:", message);
    return json({ ok: false, error: message }, 500);
  }
});
