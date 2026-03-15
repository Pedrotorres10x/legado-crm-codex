import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI, AIError } from '../_shared/ai.ts';
import { getAIContext, logAIInteraction } from '../_shared/ai-context.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Invalid token" }, 401);
    }

    const { property } = await req.json();

    const features = property.features?.length ? property.features.join(', ') : 'no indicadas';

    const prompt = `Eres un redactor inmobiliario profesional en España, especializado en crear descripciones que CUMPLEN los requisitos de publicación de los principales portales (Idealista, Fotocasa, Pisos.com, Kyero).

REQUISITOS OBLIGATORIOS para que los portales NO rechacen la descripción:
- Mínimo 300 palabras, idealmente 400-500
- Debe incluir TODOS los datos proporcionados de forma natural y detallada
- NO usar mayúsculas excesivas ni signos de exclamación repetidos
- NO incluir datos de contacto (teléfono, email, web)
- NO usar frases genéricas vacías tipo "no dude en contactar"
- Usar párrafos bien estructurados con subtemas claros
- Describir la distribución interior habitación por habitación
- Mencionar orientación, luminosidad y ventilación si es posible deducirlo
- Describir el entorno y servicios de la zona si se conoce la ubicación
- Incluir ventajas competitivas del inmueble

DATOS DEL INMUEBLE:
- Tipo: ${property.property_type || 'no especificado'}
- Operación: ${property.operation || 'venta'}
- Precio: ${property.price ? Number(property.price).toLocaleString('es-ES') + ' €' : 'no indicado'}
- Superficie útil: ${property.surface_area ? property.surface_area + ' m²' : 'no indicada'}
- Superficie construida: ${property.built_area ? property.built_area + ' m²' : 'no indicada'}
- Habitaciones: ${property.bedrooms || 'no indicado'}
- Baños: ${property.bathrooms || 'no indicado'}
- Ciudad: ${property.city || 'no indicada'}
- Provincia: ${property.province || 'no indicada'}
- Dirección/Zona: ${property.address || 'no indicada'}
- Código postal: ${property.zip_code || 'no indicado'}
- Planta: ${property.floor || 'no indicada'}
- Ascensor: ${property.has_elevator ? 'Sí' : 'No'}
- Garaje: ${property.has_garage ? 'Sí' : 'No'}
- Piscina: ${property.has_pool ? 'Sí' : 'No'}
- Terraza: ${property.has_terrace ? 'Sí' : 'No'}
- Jardín: ${property.has_garden ? 'Sí' : 'No'}
- Certificado energético: ${property.energy_cert || 'no indicado'}
- Características adicionales: ${features}
- Referencia: ${property.reference || 'no indicada'}
- Título actual: ${property.title || ''}
- Descripción actual: ${property.description || 'ninguna'}

ESTRUCTURA DE LA DESCRIPCIÓN:
1. Párrafo de apertura: presentación general del inmueble, ubicación y principal atractivo
2. Distribución: descripción detallada de cada estancia (salón, cocina, dormitorios, baños)
3. Características y calidades: materiales, acabados, equipamiento
4. Extras: garaje, trastero, piscina, terraza, jardín, ascensor, etc.
5. Zona y entorno: servicios cercanos, transporte, colegios, comercios (basándote en la ciudad/zona si la conoces)
6. Cierre: resumen de por qué es una buena oportunidad

IMPORTANTE: No inventes datos concretos que no se hayan proporcionado (metros exactos, número de estancias no indicadas). Sí puedes hacer deducciones lógicas sobre la zona si conoces la ciudad. Escribe en español neutro, tono profesional y cálido.`;

    // ── AI Learning context ──────────────────────────────────────────────────
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const startMs = Date.now();
    const aiCtx = await getAIContext(serviceClient, "ai-description", "description_style");

    const baseSystemPrompt = aiCtx.systemPromptOverride || 'Eres un experto redactor inmobiliario que escribe descripciones detalladas y profesionales para portales de venta y alquiler de inmuebles en España. Tus descripciones siempre superan las 300 palabras y cumplen los estándares de publicación de Idealista, Fotocasa y Pisos.com. Nunca incluyes datos de contacto.';

    const aiResult = await callAI('google/gemini-3-flash-preview', [
      { role: 'system', content: baseSystemPrompt + aiCtx.contextBlock },
      { role: 'user', content: prompt },
    ], { max_tokens: 2000 });

    // Log interaction
    logAIInteraction(serviceClient, {
      functionName: "ai-description",
      inputSummary: `${property.property_type} en ${property.city} · ${property.price}€`,
      outputSummary: (aiResult.content || "").substring(0, 200),
      promptVersionId: aiCtx.promptVersionId,
      memoryIds: aiCtx.memoryIds,
      kbIds: aiCtx.kbIds,
      durationMs: Date.now() - startMs,
      agentId: claimsData.claims.sub as string,
    }).catch(() => {});

    return json({ description: aiResult.content || '' });
  } catch (e) {
    if (e instanceof AIError) {
      return json({ error: e.message }, e.status);
    }
    console.error('ai-description error:', e);
    return json({ error: e instanceof Error ? e.message : 'Error desconocido' }, 500);
  }
});
