import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI, AIError } from '../_shared/ai.ts';
import { getAIContext, logAIInteraction } from '../_shared/ai-context.ts';

interface SummaryInteractionRow {
  subject?: string | null;
  interaction_date?: string | null;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // ── Auth: require authenticated user ─────────────────────────────
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

    const { contact_id } = await req.json();

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const [contactRes, interactionsRes, visitsRes, demandsRes, offersRes] = await Promise.all([
      supabase.from("contacts").select("*").eq("id", contact_id).single(),
      supabase.from("interactions").select("*").eq("contact_id", contact_id).order("interaction_date", { ascending: false }).limit(40),
      supabase.from("visits").select("*, properties(title, city, price)").eq("contact_id", contact_id).order("visit_date", { ascending: false }).limit(10),
      supabase.from("demands").select("*").eq("contact_id", contact_id),
      supabase.from("offers").select("*, properties(title, price)").eq("contact_id", contact_id).order("created_at", { ascending: false }).limit(10),
    ]);

    const contact = contactRes.data;
    if (!contact) throw new Error("Contacto no encontrado");

    const interactions = interactionsRes.data || [];

    // Extract Brevo email engagement metrics
    const brevoEvents = (interactions as SummaryInteractionRow[]).filter((i) => i.subject?.startsWith("Brevo:"));
    const opens = brevoEvents.filter((i) => i.subject?.includes("Abrió")).length;
    const clicks = brevoEvents.filter((i) => i.subject?.includes("Clic")).length;
    const bounces = brevoEvents.filter((i) => i.subject?.includes("Rebote")).length;
    const unsubscribed = brevoEvents.filter((i) => i.subject?.includes("baja")).length;
    const hotAlerts = brevoEvents.filter((i) => i.subject?.includes("ALTO INTERÉS")).length;
    const delivered = brevoEvents.filter((i) => i.subject?.includes("entregado")).length;

    const recentEngagement = brevoEvents
      .filter((i) => i.subject?.includes("Abrió") || i.subject?.includes("Clic"))
      .slice(0, 10)
      .map((i) => `${i.interaction_date}: ${i.subject}`)
      .join("\n");

    const manualInteractions = (interactions as SummaryInteractionRow[]).filter((i) => !i.subject?.startsWith("Brevo:"));

    const engagementBlock = brevoEvents.length > 0 ? `
📊 EMAIL ENGAGEMENT (datos de Brevo):
- Emails entregados: ${delivered}
- Aperturas: ${opens}
- Clics en enlaces: ${clicks}
- Rebotes: ${bounces}
- Bajas: ${unsubscribed}
- Alertas de alto interés (3+ interacciones en 7 días): ${hotAlerts}
- Tasa de apertura: ${delivered > 0 ? ((opens / delivered) * 100).toFixed(1) + "%" : "N/A"}
- Tasa de clics: ${opens > 0 ? ((clicks / opens) * 100).toFixed(1) + "%" : "N/A"}
- Nivel de engagement: ${(opens + clicks) >= 5 ? "🔥 MUY ALTO" : (opens + clicks) >= 3 ? "⚡ ALTO" : (opens + clicks) >= 1 ? "MEDIO" : "BAJO"}

Cronología reciente de engagement:
${recentEngagement || "Sin actividad reciente"}
` : `
📊 EMAIL ENGAGEMENT: Sin datos de Brevo registrados para este contacto.
`;

    const prompt = `Resume la actividad y perfil de este contacto inmobiliario. Tienes datos completos incluyendo métricas de engagement de email.

CONTACTO: ${JSON.stringify(contact)}

INTERACCIONES MANUALES (${manualInteractions.length}): ${JSON.stringify(manualInteractions.slice(0, 15))}

${engagementBlock}

VISITAS (${visitsRes.data?.length || 0}): ${JSON.stringify(visitsRes.data)}
DEMANDAS (${demandsRes.data?.length || 0}): ${JSON.stringify(demandsRes.data)}
OFERTAS (${offersRes.data?.length || 0}): ${JSON.stringify(offersRes.data)}

Genera un resumen ejecutivo en español que incluya:
1. **Perfil del contacto** — tipo, estado, datos clave
2. **Engagement email** — analiza las métricas de Brevo: ¿abre los emails? ¿hace clic? ¿cuándo fue la última actividad? ¿ha habido alertas de alto interés? Esto indica si el contacto está "caliente" o "frío"
3. **Actividad reciente** — visitas, llamadas, reuniones, ofertas
4. **Qué busca** (comprador) o **qué ofrece** (propietario)
5. **Recomendaciones accionables** — basadas en el engagement. Si abre emails pero no responde, sugiere llamar. Si hace clic en propiedades concretas, sugiere visita. Si tiene alto interés, sugiere acción urgente. Si está frío, sugiere re-engagement.
6. **Score de interés** — 🔥 Caliente / ⚡ Tibio / ❄️ Frío — basado en engagement + actividad

Sé conciso, práctico y orientado a la acción (máximo 200 palabras).`;

    // ── AI Learning context ──────────────────────────────────────────────────
    const startMs = Date.now();
    const aiCtx = await getAIContext(supabase, "ai-summary", "contact_analysis");

    const baseSystemPrompt = aiCtx.systemPromptOverride || 'Eres un asistente CRM inmobiliario experto en análisis de engagement y comportamiento de compradores. Usas datos de email marketing (Brevo) para evaluar el nivel de interés real de cada contacto y sugerir la mejor estrategia de seguimiento.';

    const aiResult = await callAI('google/gemini-3-flash-preview', [
      { role: 'system', content: baseSystemPrompt + aiCtx.contextBlock },
      { role: 'user', content: prompt },
    ]);

    // Log interaction
    logAIInteraction(supabase, {
      functionName: "ai-summary",
      inputSummary: `Resumen de contacto: ${contact.full_name}`,
      outputSummary: (aiResult.content || "").substring(0, 200),
      promptVersionId: aiCtx.promptVersionId,
      memoryIds: aiCtx.memoryIds,
      kbIds: aiCtx.kbIds,
      durationMs: Date.now() - startMs,
    }).catch(() => {});

    return json({ summary: aiResult.content || '' });
  } catch (e) {
    if (e instanceof AIError) return json({ error: e.message }, e.status);
    console.error('ai-summary error:', e);
    return json({ error: e instanceof Error ? e.message : 'Error desconocido' }, 500);
  }
});
