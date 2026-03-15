import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";
import { corsHeaders, handleCors, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // 1. Get all contacts with activity in the last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Contacts with recent communication_logs
    const { data: recentLogs } = await sb
      .from("communication_logs")
      .select("contact_id, channel, direction, status, subject, body_preview, created_at, source")
      .gte("created_at", oneWeekAgo)
      .order("created_at", { ascending: false })
      .limit(1000);

    // Contacts with recent match_emails
    const { data: recentMatchEmails } = await sb
      .from("match_emails")
      .select("contact_id, subject, status, sent_at, property_id")
      .gte("sent_at", oneWeekAgo)
      .order("sent_at", { ascending: false })
      .limit(1000);

    // Contacts with recent interactions
    const { data: recentInteractions } = await sb
      .from("interactions")
      .select("contact_id, interaction_type, subject, description, interaction_date, agent_id")
      .gte("interaction_date", oneWeekAgo)
      .order("interaction_date", { ascending: false })
      .limit(1000);

    // Also get contacts with NO activity at all in 30 days (dormant)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activeContacts } = await sb
      .from("contacts")
      .select("id, full_name, contact_type, status, agent_id, email, phone, updated_at")
      .in("status", ["nuevo", "en_seguimiento", "activo"])
      .limit(1000);

    // Group activity by contact
    const contactActivity: Record<string, {
      contact: any;
      emails_out: number;
      emails_in: number;
      wa_out: number;
      wa_in: number;
      match_emails: number;
      interactions: number;
      last_activity: string;
      logs_summary: string[];
    }> = {};

    const contactMap = new Map((activeContacts || []).map(c => [c.id, c]));

    // Process communication logs
    for (const log of recentLogs || []) {
      if (!contactActivity[log.contact_id]) {
        contactActivity[log.contact_id] = {
          contact: contactMap.get(log.contact_id),
          emails_out: 0, emails_in: 0, wa_out: 0, wa_in: 0,
          match_emails: 0, interactions: 0,
          last_activity: log.created_at,
          logs_summary: [],
        };
      }
      const a = contactActivity[log.contact_id];
      if (log.channel === "email" && log.direction === "outbound") a.emails_out++;
      if (log.channel === "email" && log.direction === "inbound") a.emails_in++;
      if (log.channel === "whatsapp" && log.direction === "outbound") a.wa_out++;
      if (log.channel === "whatsapp" && log.direction === "inbound") a.wa_in++;
      if (a.logs_summary.length < 5) {
        a.logs_summary.push(`[${log.channel}/${log.direction}] ${log.subject || log.body_preview || "(sin asunto)"}`);
      }
    }

    // Process match emails
    for (const me of recentMatchEmails || []) {
      if (!contactActivity[me.contact_id]) {
        contactActivity[me.contact_id] = {
          contact: contactMap.get(me.contact_id),
          emails_out: 0, emails_in: 0, wa_out: 0, wa_in: 0,
          match_emails: 0, interactions: 0,
          last_activity: me.sent_at,
          logs_summary: [],
        };
      }
      contactActivity[me.contact_id].match_emails++;
    }

    // Process interactions
    for (const int of recentInteractions || []) {
      if (!contactActivity[int.contact_id]) {
        contactActivity[int.contact_id] = {
          contact: contactMap.get(int.contact_id),
          emails_out: 0, emails_in: 0, wa_out: 0, wa_in: 0,
          match_emails: 0, interactions: 0,
          last_activity: int.interaction_date,
          logs_summary: [],
        };
      }
      contactActivity[int.contact_id].interactions++;
    }

    // Find dormant contacts (active status but no recent activity)
    const activeIds = new Set(Object.keys(contactActivity));
    const dormantContacts = (activeContacts || []).filter(c =>
      !activeIds.has(c.id) && c.updated_at < thirtyDaysAgo
    ).slice(0, 30);

    // 2. Build AI prompt with aggregated data
    const activeEntries = Object.entries(contactActivity)
      .filter(([_, a]) => a.contact)
      .slice(0, 50); // limit to avoid token overflow

    const activitySummary = activeEntries.map(([id, a]) => {
      const c = a.contact;
      return `- ${c.full_name} (${c.contact_type}, estado: ${c.status}): ` +
        `emails enviados=${a.emails_out}, recibidos=${a.emails_in}, ` +
        `WA enviados=${a.wa_out}, recibidos=${a.wa_in}, ` +
        `cruces=${a.match_emails}, interacciones=${a.interactions}. ` +
        `Últimos: ${a.logs_summary.join("; ")}`;
    }).join("\n");

    const dormantSummary = dormantContacts.map(c =>
      `- ${c.full_name} (${c.contact_type}, estado: ${c.status}) — sin actividad en 30+ días`
    ).join("\n");

    const prompt = `Eres la IA de un CRM inmobiliario (Legado Real Estate). Analiza la actividad de comunicaciones de la última semana y genera recomendaciones accionables para la coordinadora.

ACTIVIDAD ÚLTIMA SEMANA:
${activitySummary || "(sin actividad registrada)"}

CONTACTOS DORMIDOS (30+ días sin actividad, estado activo):
${dormantSummary || "(ninguno)"}

REGLAS:
- Identifica contactos que NO responden (enviamos pero no recibimos) → recomendar cambio de canal o llamada
- Identifica contactos con alta interacción (responden rápido) → recomendar priorización/visita
- Contactos dormidos activos → recomendar reactivación o cierre
- Contactos con muchos cruces enviados pero sin interacciones → recomendar seguimiento telefónico
- Máximo 10 recomendaciones, ordenadas por urgencia
- Cada recomendación debe ser concreta: qué hacer, con quién, por qué

Devuelve SOLO un JSON array con objetos: {"title": "...", "description": "...", "urgency": "alta|media|baja", "contact_name": "..."}`;

    const result = await callAI("google/gemini-2.5-flash", [
      { role: "user", content: prompt },
    ], { max_tokens: 2000 });

    // 3. Parse recommendations
    let recommendations: { title: string; description: string; urgency: string; contact_name: string }[] = [];
    try {
      const text = result.content || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI recommendations:", e);
      return json({ ok: false, error: "Failed to parse AI output" }, 500);
    }

    if (recommendations.length === 0) {
      return json({ ok: true, recommendations: 0, message: "No recommendations generated" });
    }

    // 4. Insert as notifications for admin and coordinadora
    const { data: roleUsers } = await sb
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "coordinadora"]);

    const targetUserIds = [...new Set((roleUsers || []).map((r: any) => r.user_id))];

    // Create notifications
    const notifications = [];
    for (const rec of recommendations) {
      const urgencyEmoji = rec.urgency === "alta" ? "🔴" : rec.urgency === "media" ? "🟡" : "🟢";
      for (const userId of targetUserIds) {
        notifications.push({
          agent_id: userId,
          title: `${urgencyEmoji} IA: ${rec.title}`,
          description: rec.description,
          entity_type: "ai_recommendation",
          entity_id: crypto.randomUUID(),
          event_type: "ai_weekly_recommendation",
        });
      }
    }

    if (notifications.length > 0) {
      const { error: insertErr } = await sb.from("notifications").insert(notifications);
      if (insertErr) {
        console.error("Error inserting notifications:", insertErr);
        return json({ ok: false, error: insertErr.message }, 500);
      }
    }

    // Also create a summary announcement
    const summaryLines = recommendations.map((r, i) => {
      const emoji = r.urgency === "alta" ? "🔴" : r.urgency === "media" ? "🟡" : "🟢";
      return `${i + 1}. ${emoji} **${r.title}** — ${r.description}`;
    }).join("\n");

    await sb.from("announcements").insert({
      title: `🤖 Recomendaciones IA semanales (${recommendations.length})`,
      content: `Análisis automático del historial de comunicaciones:\n\n${summaryLines}`,
      category: "alerta",
    });

    return json({
      ok: true,
      recommendations: recommendations.length,
      notifications_created: notifications.length,
    });
  } catch (err) {
    console.error("ai-weekly-recommendations error:", err);
    return json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
