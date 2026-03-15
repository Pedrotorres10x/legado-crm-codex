import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI } from '../_shared/ai.ts';
import { getAIContext, logAIInteraction, saveMemory } from '../_shared/ai-context.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { query } = await req.json();
    if (!query || query.trim().length < 2) {
      return json({ filters: null });
    }

    const systemPrompt = `Eres un asistente de búsqueda para un CRM inmobiliario español. 
Analiza la consulta del usuario y devuelve los filtros para buscar en contactos y propiedades.

Campos disponibles para CONTACTOS: full_name, phone, email, city, contact_type (propietario|comprador|ambos|prospecto|colaborador), status, notes
Campos disponibles para PROPIEDADES: title, description, address, city, zone, price (numérico, en euros), bedrooms (numérico), bathrooms (numérico), surface_area (numérico, m²), property_type (piso|casa|chalet|adosado|atico|duplex|estudio|local|oficina|nave|terreno|garaje|trastero|otro), operation (venta|alquiler), status (disponible|reservado|arras|vendido|alquilado|retirado), reference, crm_reference, features (array)

REGLA CRÍTICA — DESCRIPCIÓN:
El campo "description" es MUY IMPORTANTE. Los nombres de urbanizaciones, zonas residenciales y complejos (ej: "Coblanca", "Montiboli", "Rincon de Loix", "La Cala") suelen aparecer SOLO en la descripción larga, no en city/zone/address.
Por tanto, "description" SIEMPRE debe estar incluido en text_fields cuando el usuario busca por nombre de lugar, urbanización o término libre.

REGLA CRÍTICA — NOMBRES DE LUGARES, URBANIZACIONES Y ZONAS:
Cuando el usuario escriba un nombre que pueda ser una ciudad, pueblo, urbanización, zona, barrio o cualquier topónimo (ej: "Benidorm", "Coblanca", "La Manga", "Calpe", "Moraira", "El Campello"), SIEMPRE debes:
1. Poner ese nombre en "text_query" dentro de property_filters
2. Poner text_fields: ["title", "description", "address", "zone", "city"] — SIEMPRE incluir "description"
3. Poner ese nombre también en "city" si parece una ciudad conocida
4. Poner ese nombre también en "full_text_search" (campo nuevo en el JSON raíz)
Esto garantiza que se busque en TODOS los campos de texto, especialmente en descripciones largas donde puede aparecer el nombre de la urbanización.

REGLA CRÍTICA — SIEMPRE incluye full_text_search:
El campo "full_text_search" en el JSON raíz debe contener el término de búsqueda principal. El frontend lo usará para buscar también en description.

IMPORTANTE: Devuelve SOLO un JSON válido con esta estructura exacta, sin markdown ni explicaciones:
{
  "search_type": "contacts" | "properties" | "both",
  "full_text_search": "término principal de búsqueda o null",
  "contact_filters": {
    "text_fields": ["campo1", "campo2"],
    "text_query": "texto a buscar",
    "contact_type": "tipo o null",
    "city": "ciudad o null"
  },
  "property_filters": {
    "text_fields": ["title", "description", "address", "zone", "city"],
    "text_query": "texto a buscar",
    "city": "ciudad o null",
    "zone": "zona o null",
    "property_type": "tipo o null",
    "operation": "venta|alquiler o null",
    "min_price": número o null,
    "max_price": número o null,
    "min_bedrooms": número o null,
    "min_surface": número o null,
    "status": "estado o null",
    "features": ["feature1"] o null
  },
  "explanation": "breve explicación en español de lo que se busca"
}

EJEMPLOS:
- Usuario escribe "benidorm" → search_type: "properties", full_text_search: "benidorm", property_filters: { text_query: "benidorm", text_fields: ["title","description","address","zone","city"], city: "benidorm" }
- Usuario escribe "coblanca" → search_type: "properties", full_text_search: "coblanca", property_filters: { text_query: "coblanca", text_fields: ["title","description","address","zone","city"], city: null }
- Usuario escribe "urbanizacion coblanca" → search_type: "properties", full_text_search: "coblanca", property_filters: { text_query: "coblanca", text_fields: ["title","description","address","zone","city"], city: null }
- Usuario escribe "piso 3 habitaciones benidorm" → search_type: "properties", full_text_search: "benidorm", property_filters: { text_query: "benidorm", text_fields: ["title","description","address","zone","city"], city: "benidorm", min_bedrooms: 3, property_type: "piso" }
- Usuario escribe "piscina terraza" → search_type: "properties", full_text_search: "piscina terraza", property_filters: { text_query: "piscina", text_fields: ["title","description","address","zone","city"], features: ["piscina","terraza"] }`;

    // ── AI Learning context ──────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const startMs = Date.now();
    const aiCtx = await getAIContext(serviceClient, "ai-search");
    const finalPrompt = (aiCtx.systemPromptOverride || systemPrompt) + aiCtx.contextBlock;

    const aiResult = await callAI('google/gemini-3-flash-preview', [
      { role: 'system', content: finalPrompt },
      { role: 'user', content: query },
    ], { stream: false });

    const raw = aiResult.content || '{}';
    let filters;
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      filters = JSON.parse(cleaned);
    } catch {
      filters = null;
    }

    // Log & learn: save successful search patterns
    const durationMs = Date.now() - startMs;
    logAIInteraction(serviceClient, {
      functionName: "ai-search",
      inputSummary: query,
      outputSummary: filters ? JSON.stringify(filters).substring(0, 300) : "parse_failed",
      promptVersionId: aiCtx.promptVersionId,
      memoryIds: aiCtx.memoryIds,
      kbIds: aiCtx.kbIds,
      durationMs,
    }).catch(() => {});

    // Learn from successful parses
    if (filters?.search_type) {
      saveMemory(serviceClient, {
        category: "search_patterns",
        contextKey: `search:${query.toLowerCase().trim().substring(0, 50)}`,
        content: `Query "${query}" → ${filters.search_type}, filters: ${JSON.stringify(filters.property_filters || filters.contact_filters || {}).substring(0, 200)}`,
        sourceFunction: "ai-search",
      }).catch(() => {});
    }

    return json({ filters });
  } catch (err) {
    console.error('[ai-search] error:', err);
    return json({ error: String(err) }, 500);
  }
});
