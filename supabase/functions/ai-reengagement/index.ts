import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI, AIError } from '../_shared/ai.ts';

interface ReengagementBody {
  action: string;
  contact_id?: string;
  email?: string;
  subject?: string;
  html_content?: string;
}

interface ReengagementMatchRow {
  id: string;
  status: string | null;
  compatibility: number | null;
  created_at: string;
  property_id: string | null;
  properties?: {
    title?: string | null;
    city?: string | null;
    price?: number | null;
    bedrooms?: number | null;
    surface_area?: number | null;
    images?: string[] | null;
  } | null;
}

interface ReengagementPropertyRow {
  title: string | null;
  city: string | null;
  price: number | null;
  bedrooms?: number | null;
  surface_area?: number | null;
}

interface ReengagementToolCall {
  function?: {
    arguments?: string;
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as ReengagementBody;
    const { action, contact_id } = body;

    // ACTION: analyze
    if (action === "analyze") {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, full_name, email, phone, contact_type, status")
        .in("contact_type", ["comprador", "ambos"])
        .in("status", ["nuevo", "en_seguimiento", "activo"]);

      if (!contacts || contacts.length === 0) return json({ buyers: [] });

      const buyerAnalysis = [];
      for (const contact of contacts) {
        const { data: demands } = await supabase
          .from("demands")
          .select("id, property_type, operation, cities, min_price, max_price, is_active")
          .eq("contact_id", contact.id)
          .eq("is_active", true);

        if (!demands || demands.length === 0) continue;

        const demandIds = demands.map(d => d.id);
        const { data: matches } = await supabase
          .from("matches")
          .select("id, status, compatibility, created_at, property_id, properties(title, city, price, status, images)")
          .in("demand_id", demandIds)
          .order("created_at", { ascending: false })
          .limit(10);

        const { data: visits } = await supabase
          .from("visits")
          .select("id, visit_date, result, properties(title)")
          .eq("contact_id", contact.id)
          .order("visit_date", { ascending: false })
          .limit(5);

        const { data: interactions } = await supabase
          .from("interactions")
          .select("interaction_type, subject, interaction_date")
          .eq("contact_id", contact.id)
          .order("interaction_date", { ascending: false })
          .limit(5);

        const lastInteraction = interactions?.[0]?.interaction_date;
        const daysSinceContact = lastInteraction
          ? Math.floor((Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        const pendingMatches = (matches || []).filter(m => m.status === "pendiente" || m.status === "enviado");
        const interestedMatches = (matches || []).filter(m => m.status === "interesado");

        const demandCities = demands.flatMap(d => d.cities || []);
        let newPropertiesCount = 0;
        if (demandCities.length > 0) {
          const query = supabase
            .from("properties")
            .select("id", { count: "exact", head: true })
            .eq("status", "disponible")
            .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
            .in("city", demandCities);
          const { count } = await query;
          newPropertiesCount = count || 0;
        }

        buyerAnalysis.push({
          contact, demands,
          matchCount: matches?.length || 0,
          pendingMatches: pendingMatches.length,
          interestedMatches: interestedMatches.length,
          recentMatches: (matches || []).slice(0, 3).map(m => ({ property: m.properties, status: m.status, compatibility: m.compatibility })),
          recentVisits: visits || [],
          daysSinceContact, newPropertiesCount,
          hasEmail: !!contact.email, hasPhone: !!contact.phone,
        });
      }

      buyerAnalysis.sort((a, b) => {
        if (a.pendingMatches > 0 && b.pendingMatches === 0) return -1;
        if (b.pendingMatches > 0 && a.pendingMatches === 0) return 1;
        return b.daysSinceContact - a.daysSinceContact;
      });

      return json({ buyers: buyerAnalysis.slice(0, 20) });
    }

    // ACTION: generate
    if (action === "generate") {
      if (!contact_id) throw new Error("contact_id requerido");

      const { data: contact } = await supabase.from("contacts").select("*").eq("id", contact_id).single();
      if (!contact) throw new Error("Contacto no encontrado");

      const { data: demands } = await supabase.from("demands").select("*").eq("contact_id", contact_id).eq("is_active", true);
      const demandIds = (demands || []).map(d => d.id);
      let matches: ReengagementMatchRow[] = [];
      if (demandIds.length > 0) {
        const { data } = await supabase.from("matches").select("*, properties(title, city, price, bedrooms, surface_area, images)").in("demand_id", demandIds).order("created_at", { ascending: false }).limit(5);
        matches = (data ?? []) as ReengagementMatchRow[];
      }

      const { data: visits } = await supabase.from("visits").select("*, properties(title, city)").eq("contact_id", contact_id).order("visit_date", { ascending: false }).limit(5);
      const { data: interactions } = await supabase.from("interactions").select("*").eq("contact_id", contact_id).order("interaction_date", { ascending: false }).limit(5);

      const demandCities = (demands || []).flatMap(d => d.cities || []);
      let newProperties: ReengagementPropertyRow[] = [];
      if (demandCities.length > 0) {
        const { data } = await supabase.from("properties").select("title, city, price, bedrooms, surface_area").eq("status", "disponible").in("city", demandCities).gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()).limit(5);
        newProperties = (data ?? []) as ReengagementPropertyRow[];
      }

      const prompt = `Eres Alicia, de Legado Inmobiliaria. Tu personalidad: amiga experta en el sector inmobiliario, CERO comercial, cercana y natural. Nunca presionas ni usas urgencia artificial. Hablas como una amiga que sabe mucho del mercado y quiere ayudar de verdad.

REGLAS:
- Tono cálido, directo, sin florituras ni frases de marketing
- NUNCA digas cosas como "tenemos X clientes para tu piso" ni uses datos de presión
- Firma como "Alicia" o "Alicia, de Legado Inmobiliaria"
- Sin links en WhatsApp. En email, solo un botón de WhatsApp para responder

CONTACTO: ${contact.full_name} (${contact.contact_type})
EMAIL: ${contact.email || 'No disponible'}
TELÉFONO: ${contact.phone || 'No disponible'}
DEMANDAS: ${JSON.stringify(demands)}
CRUCES RECIENTES: ${JSON.stringify(matches.map(m => ({ propiedad: m.properties?.title, ciudad: m.properties?.city, precio: m.properties?.price, estado: m.status, compatibilidad: m.compatibility })))}
VISITAS: ${JSON.stringify(visits?.map(v => ({ propiedad: v.properties?.title, fecha: v.visit_date, resultado: v.result })))}
ÚLTIMAS INTERACCIONES: ${JSON.stringify(interactions?.map(i => ({ tipo: i.interaction_type, asunto: i.subject, fecha: i.interaction_date })))}
PROPIEDADES NUEVAS EN SU ZONA: ${JSON.stringify(newProperties)}

Genera exactamente DOS mensajes:
1. EMAIL: Asunto + cuerpo del email (HTML simple, breve, máximo 5 líneas, tono de amiga experta)
2. WHATSAPP: Mensaje corto para WhatsApp (2-3 líneas máximo, natural, como si hablaras con un amigo)

Personaliza según el historial real del contacto.`;

      const aiResult = await callAI('google/gemini-3-flash-preview', [
        { role: 'system', content: 'Genera mensajes de seguimiento inmobiliario. Responde SIEMPRE en formato JSON.' },
        { role: 'user', content: prompt },
      ], {
        tools: [{
          type: 'function',
          function: {
            name: 'reengagement_messages',
            description: 'Return email and whatsapp reengagement messages',
            parameters: {
              type: 'object',
              properties: {
                email_subject: { type: 'string' },
                email_body: { type: 'string' },
                whatsapp_message: { type: 'string' },
              },
              required: ['email_subject', 'email_body', 'whatsapp_message'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'reengagement_messages' } },
      });

      const toolCall = aiResult.tool_calls?.[0] as ReengagementToolCall | undefined;
      if (!toolCall?.function?.arguments) throw new Error('No se pudo generar los mensajes');
      const messages = JSON.parse(toolCall.function.arguments);

      return json({
        contact: { id: contact.id, full_name: contact.full_name, email: contact.email, phone: contact.phone },
        messages,
      });
    }

    // ACTION: send_email — via Brevo direct
    if (action === "send_email") {
      const { email, subject, html_content } = body;
      if (!email || !subject || !html_content) throw new Error("email, subject, html_content requeridos");
      if (!contact_id) throw new Error("contact_id requerido");

      const { sendBrevoEmail } = await import('../_shared/brevo.ts');
      await sendBrevoEmail(
        [{ email, name: email }],
        subject,
        html_content,
      );

      await supabase.from("interactions").insert({
        contact_id,
        interaction_type: "email",
        subject: `Reengagement: ${subject}`,
        description: `Email de seguimiento enviado vía Brevo`,
      });

      return json({ success: true });
    }

    throw new Error(`Acción desconocida: ${action}`);
  } catch (e) {
    if (e instanceof AIError) return json({ error: e.message }, e.status);
    console.error('ai-reengagement error:', e);
    return json({ error: e instanceof Error ? e.message : 'Error desconocido' }, 500);
  }
});
