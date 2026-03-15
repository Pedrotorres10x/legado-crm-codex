import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { sendMessage } from '../_shared/send-message.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Auth check: require valid JWT (user or service role) ────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    // First try as a logged-in user
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { channel, contact_id, text, subject, html, source, property_id, demand_id, agent_id, reply_to, campaign } = body;

    if (!channel || !contact_id || !text) {
      throw new Error("channel, contact_id, and text are required");
    }
    if (!["whatsapp", "email"].includes(channel)) {
      throw new Error("channel must be 'whatsapp' or 'email'");
    }

    // Look up contact phone/email
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("phone, phone2, email, full_name, opt_out")
      .eq("id", contact_id)
      .single();

    if (contactError || !contact) {
      throw new Error(`Contact ${contact_id} not found in CRM`);
    }

    if (contact.opt_out) {
      throw new Error(`Contact has opt-out enabled — communication blocked`);
    }

    const destination = channel === "whatsapp"
      ? (contact.phone || contact.phone2)
      : contact.email;

    if (!destination) {
      throw new Error(`Contact has no ${channel === "whatsapp" ? "phone" : "email"} for ${channel} channel`);
    }

    // Send directly via local helpers
    console.log("multichannel-send → sending via", channel, "to:", destination);
    const result = await sendMessage({
      channel,
      to: destination,
      contactName: contact.full_name || undefined,
      text,
      subject,
      html,
      replyTo: reply_to,
    });

    const sendOk = result.ok;
    const logStatus = sendOk ? "enviado" : "error";
    const errorMsg = sendOk ? null : (result.error || 'Send failed');

    // Record interaction in CRM (timeline entry)
    const interactionType = channel === "whatsapp" ? "whatsapp" as any : "email" as any;
    await supabase.from("interactions").insert({
      contact_id,
      interaction_type: interactionType,
      subject: channel === "email"
        ? `Email: ${subject || "(sin asunto)"}`
        : `WhatsApp enviado`,
      description: channel === "email"
        ? `Email enviado vía Brevo. Origen: ${source || "manual"}`
        : `WhatsApp enviado vía Green API. Origen: ${source || "manual"}. Mensaje: ${text.slice(0, 200)}`,
      agent_id: agent_id || null,
    });

    // Record detailed communication log
    await supabase.from("communication_logs").insert({
      contact_id,
      channel,
      direction: "outbound",
      source: source || "manual",
      subject: channel === "email" ? (subject || null) : null,
      body_preview: text?.slice(0, 500) || null,
      html_preview: channel === "email" ? (html?.slice(0, 1000) || null) : null,
      provider_msg_id: result.provider_message_id || null,
      status: logStatus,
      error_message: errorMsg,
      agent_id: agent_id || null,
      property_id: property_id || null,
      demand_id: demand_id || null,
      metadata: { campaign: campaign || null },
    });

    if (!sendOk) {
      throw new Error(errorMsg!);
    }

    return json({ ok: true, provider_message_id: result.provider_message_id });
  } catch (e: any) {
    console.error("multichannel-send error:", e.message);
    return json({ ok: false, error: e.message }, 500);
  }
});
