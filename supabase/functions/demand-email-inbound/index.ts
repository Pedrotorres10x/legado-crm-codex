import { json, handleCors } from "../_shared/cors.ts";

const PORTAL_HINTS = [
  "fotocasa",
  "todopisos",
  "pisos.com",
  "pisos",
  "1001portales",
  "kyero",
  "thinkspain",
  "spainhouses",
];

type InboundAttachment = {
  Name?: string | null;
  name?: string | null;
  ContentType?: string | null;
  contentType?: string | null;
  ContentLength?: number | null;
  size?: number | null;
};

type InboundBody = {
  ExtractedMarkdownMessage?: string | null;
  RawTextBody?: string | null;
  TextBody?: string | null;
  body?: string | null;
  Items?: Array<{ RawTextBody?: string | null; TextBody?: string | null }> | null;
  RawHtmlBody?: string | null;
  HtmlBody?: string | null;
  html?: string | null;
  Sender?: { Email?: string | null; Name?: string | null } | null;
  from?: string | null;
  sender_email?: string | null;
  from_name?: string | null;
  sender_name?: string | null;
  Attachments?: InboundAttachment[] | null;
  attachments?: InboundAttachment[] | null;
  Subject?: string | null;
  subject?: string | null;
  MessageId?: string | null;
  Recipient?: unknown;
  Recipients?: unknown;
};

function extractTextBody(body: InboundBody) {
  return (
    body?.ExtractedMarkdownMessage?.trim() ||
    body?.RawTextBody?.trim() ||
    body?.TextBody?.trim() ||
    body?.body?.trim() ||
    body?.Items?.[0]?.RawTextBody?.trim() ||
    body?.Items?.[0]?.TextBody?.trim() ||
    ""
  );
}

function extractHtmlBody(body: InboundBody) {
  return (
    body?.RawHtmlBody?.trim() ||
    body?.HtmlBody?.trim() ||
    body?.html?.trim() ||
    ""
  );
}

function extractSender(body: InboundBody) {
  const email = body?.Sender?.Email || body?.from || body?.sender_email || null;
  const name = body?.Sender?.Name || body?.from_name || body?.sender_name || null;
  const from = email ? `${name || email} <${email}>` : (name || "");
  return { from, sender_email: email, from_name: name };
}

function extractAttachments(body: InboundBody) {
  const items = Array.isArray(body?.Attachments)
    ? body.Attachments
    : Array.isArray(body?.attachments)
      ? body.attachments
      : [];

  return items.map((attachment: InboundAttachment) => ({
    name: attachment?.Name || attachment?.name || null,
    contentType: attachment?.ContentType || attachment?.contentType || null,
    size: attachment?.ContentLength || attachment?.size || null,
  }));
}

function isPortalDemandEmail(input: {
  subject?: string | null;
  senderEmail?: string | null;
  from?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
}) {
  const bucket = [
    input.subject,
    input.senderEmail,
    input.from,
    input.textBody,
    input.htmlBody,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!bucket) return false;

  const hasPortalBrand = PORTAL_HINTS.some((hint) => bucket.includes(hint));
  const hasLeadSignals = [
    "posible cliente en tu zona",
    "interesado en",
    "ha contactado",
    "nuevo lead",
    "posible comprador",
    "quiere comprar",
    "solicitud",
  ].some((hint) => bucket.includes(hint));

  return hasPortalBrand || hasLeadSignals;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const brevoSecret = Deno.env.get("BREVO_INBOUND_SECRET");
    const outlookSecret = Deno.env.get("OUTLOOK_DEMAND_SECRET");
    const portalSecret = Deno.env.get("PORTAL_LEAD_SECRET");

    const providedSecret =
      req.headers.get("x-brevo-key") ||
      req.headers.get("x-webhook-secret");

    if (!brevoSecret || !outlookSecret || !portalSecret) {
      return json({ ok: false, error: "webhook_not_configured" }, 500);
    }

    if (providedSecret !== brevoSecret) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    let body: InboundBody;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json() as InboundBody;
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const itemsRaw = formData.get("items");
      if (itemsRaw) {
        const parsed = JSON.parse(itemsRaw as string) as InboundBody | InboundBody[];
        body = Array.isArray(parsed) ? parsed[0] : parsed;
      } else {
        body = {
          Sender: {
            Email: formData.get("Sender"),
            Name: formData.get("SenderName"),
          },
          Subject: formData.get("Subject"),
          RawTextBody: formData.get("RawTextBody") || formData.get("TextBody"),
          ExtractedMarkdownMessage: formData.get("ExtractedMarkdownMessage"),
          RawHtmlBody: formData.get("RawHtmlBody"),
        };
      }
    } else {
      body = await req.json() as InboundBody;
    }

    const { from, sender_email, from_name } = extractSender(body);
    const subject = body?.Subject || body?.subject || "(sin asunto)";
    const textBody = extractTextBody(body);
    const htmlBody = extractHtmlBody(body);
    const attachments = extractAttachments(body);

    if (!textBody && !htmlBody && !subject) {
      return json({ ok: false, error: "empty_email" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const routeToPortal = isPortalDemandEmail({
      subject,
      senderEmail: sender_email,
      from,
      textBody,
      htmlBody,
    });

    const targetFunction = routeToPortal ? "portal-lead-inbound" : "outlook-demand-inbound";
    const targetHeaderName = routeToPortal ? "x-portal-key" : "x-outlook-key";
    const targetSecret = routeToPortal ? portalSecret : outlookSecret;

    const response = await fetch(`${supabaseUrl}/functions/v1/${targetFunction}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [targetHeaderName]: targetSecret,
      },
      body: JSON.stringify({
        subject,
        body: textBody,
        html: htmlBody,
        from,
        from_name,
        sender_email,
        attachments,
        metadata: {
          source_mailbox: "brevo-forward",
          route_detected: targetFunction,
          brevo_message_id: body?.MessageId || null,
          recipients: body?.Recipient || body?.Recipients || [],
          original_payload_type: contentType || "unknown",
        },
      }),
    });

    const result = await response.json();
    return json({
      ok: response.ok,
      forwarded_to: targetFunction,
      result,
    }, response.status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("[demand-email-inbound] Error:", message);
    return json({ ok: false, error: message }, 500);
  }
});
