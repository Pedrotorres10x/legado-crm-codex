import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, handleCors } from "../_shared/cors.ts";
import { isPropertyInterestAutomationEnabled } from "../_shared/automation-outbound.ts";
import { buildPropertyUrl, buildWhatsAppFinalReminder, buildWhatsAppReminder, resolveLeadLanguage } from "../_shared/match-whatsapp.ts";
import { sendMessage } from "../_shared/send-message.ts";

type OpenerLog = {
  id: string;
  contact_id: string | null;
  property_id: string | null;
  demand_id: string | null;
  created_at: string;
  body_preview?: string | null;
  metadata?: Record<string, unknown> | null;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const automationEnabled = await isPropertyInterestAutomationEnabled();
    if (!automationEnabled) {
      return json({ ok: true, sent: 0, skipped: "automation_disabled" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const threshold = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();

    const { data: logsToReview, error: logsError } = await supabase
      .from("communication_logs")
      .select("id, contact_id, property_id, demand_id, created_at, body_preview, metadata")
      .eq("channel", "whatsapp")
      .eq("direction", "outbound")
      .in("source", ["cruces", "cruces_reminder"])
      .lte("created_at", threshold)
      .order("created_at", { ascending: true })
      .limit(200);

    if (logsError) throw logsError;

    const validLogs = (logsToReview || []) as OpenerLog[];
    const allContactIds = [...new Set(validLogs.map((l) => l.contact_id).filter(Boolean) as string[])];
    const allPropertyIds = [...new Set(validLogs.map((l) => l.property_id).filter(Boolean) as string[])];

    // Batch 1: existing follow-up logs (deduplication check)
    const { data: followUpData } = allContactIds.length > 0
      ? await supabase
          .from("communication_logs")
          .select("contact_id, property_id, source")
          .eq("channel", "whatsapp")
          .eq("direction", "outbound")
          .in("source", ["cruces_followup", "cruces_reminder", "cruces_last_reminder"])
          .in("contact_id", allContactIds)
          .in("property_id", allPropertyIds)
      : { data: [] };

    const existingFollowUpKeys = new Set<string>(
      (followUpData ?? []).map((r) => `${r.contact_id}:${r.property_id}:${r.source}`)
    );

    // Batch 2: inbound replies per contact (to check if contact already responded)
    const { data: inboundData } = allContactIds.length > 0
      ? await supabase
          .from("communication_logs")
          .select("contact_id, created_at")
          .eq("channel", "whatsapp")
          .eq("direction", "inbound")
          .in("contact_id", allContactIds)
      : { data: [] };

    const inboundByContact = new Map<string, string[]>();
    for (const row of (inboundData ?? [])) {
      const arr = inboundByContact.get(row.contact_id) ?? [];
      arr.push(row.created_at);
      inboundByContact.set(row.contact_id, arr);
    }

    // Batch 3: contacts
    const { data: contactsData } = allContactIds.length > 0
      ? await supabase
          .from("contacts")
          .select("id, full_name, phone, phone2, agent_id, gdpr_consent, opt_out, preferred_language")
          .in("id", allContactIds)
      : { data: [] };

    const contactsById = new Map((contactsData ?? []).map((c) => [c.id, c]));

    // Batch 4: properties
    const { data: propertiesData } = allPropertyIds.length > 0
      ? await supabase
          .from("properties")
          .select("id, title, city, province")
          .in("id", allPropertyIds)
      : { data: [] };

    const propertiesById = new Map((propertiesData ?? []).map((p) => [p.id, p]));

    let sent = 0;
    let examined = 0;

    for (const openerLog of validLogs) {
      examined += 1;

      if (!openerLog.contact_id || !openerLog.property_id) continue;
      if (openerLog.metadata?.pending_response === false) continue;
      const source = openerLog.metadata?.match_whatsapp_stage === "reminder" ? "cruces_reminder" : "cruces";
      const isInitialOpener = source === "cruces";
      const nextSource = isInitialOpener ? "cruces_reminder" : "cruces_last_reminder";
      const nextStage = isInitialOpener ? "reminder" : "final_reminder";
      const reminderAttempt = isInitialOpener ? 1 : 2;

      const followUpKey = `${openerLog.contact_id}:${openerLog.property_id}:${nextSource}`;
      if (existingFollowUpKeys.has(followUpKey)) continue;

      const replies = inboundByContact.get(openerLog.contact_id) ?? [];
      if (replies.some((ts) => ts > openerLog.created_at)) continue;

      const contact = contactsById.get(openerLog.contact_id) ?? null;
      const property = propertiesById.get(openerLog.property_id) ?? null;

      if (!contact || !property) continue;
      if (contact.opt_out) continue;
      if (contact.gdpr_consent === false) continue;

      const destination = contact.phone || contact.phone2;
      if (!destination) continue;

      const preferredLanguage = resolveLeadLanguage(
        contact.preferred_language || openerLog.metadata?.preferred_language || null,
        contact.full_name,
        openerLog.body_preview || null,
      );
      const reminderText = isInitialOpener
        ? buildWhatsAppReminder(contact.full_name, preferredLanguage)
        : buildWhatsAppFinalReminder(contact.full_name, preferredLanguage);
      const propertyUrl = buildPropertyUrl(property);

      const result = await sendMessage({
        channel: "whatsapp",
        to: destination,
        contactName: contact.full_name || undefined,
        text: reminderText,
      });

      await supabase.from("communication_logs").insert({
        contact_id: contact.id,
        channel: "whatsapp",
        direction: "outbound",
        source: nextSource,
        body_preview: reminderText.slice(0, 500),
        provider_msg_id: result.provider_message_id || null,
        status: result.ok ? "enviado" : "error",
        error_message: result.ok ? null : (result.error || "Send failed"),
        agent_id: contact.agent_id || null,
        property_id: property.id,
        demand_id: openerLog.demand_id || null,
        metadata: {
          trigger_source: "property-interest-followup-cron",
          match_whatsapp_stage: nextStage,
          opener_log_id: openerLog.id,
          property_url: propertyUrl,
          preferred_language: preferredLanguage,
          pending_response: true,
          reminder_attempt: reminderAttempt,
        },
      });

      await supabase.from("interactions").insert({
        contact_id: contact.id,
        interaction_type: "whatsapp",
        subject: isInitialOpener
          ? `WhatsApp recordatorio: ${property.title || "Propiedad"}`
          : `WhatsApp último intento: ${property.title || "Propiedad"}`,
        description: result.ok
          ? (isInitialOpener
              ? "WhatsApp recordatorio enviado automaticamente tras 24 horas sin respuesta."
              : "WhatsApp final enviado automaticamente tras 48 horas sin respuesta.")
          : (isInitialOpener
              ? `Falló el WhatsApp recordatorio automático tras 24 horas sin respuesta: ${result.error || "error desconocido"}`
              : `Falló el WhatsApp final automático tras 48 horas sin respuesta: ${result.error || "error desconocido"}`),
        agent_id: contact.agent_id || null,
        property_id: property.id,
      });

      sent += result.ok ? 1 : 0;
    }

    return json({ ok: true, examined, sent });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unexpected_error";
    console.error("[property-interest-followup-cron] error:", message);
    return json({ ok: false, error: message }, 500);
  }
});
