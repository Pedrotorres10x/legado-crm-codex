import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI, AIError } from '../_shared/ai.ts';

const propertyTool = {
  type: "function",
  function: {
    name: "extract_property",
    description: "Extrae los datos estructurados de un inmueble a partir de la descripción del usuario.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Título descriptivo del inmueble" },
        property_type: { type: "string", enum: ["piso","casa","chalet","adosado","atico","duplex","estudio","local","oficina","nave","terreno","garaje","trastero"], description: "Tipo de inmueble. NUNCA uses 'otro'. Elige siempre el tipo más apropiado basándote en la descripción." },
        operation: { type: "string", enum: ["venta","alquiler","ambas"] },
        price: { type: "number", description: "Precio en euros" },
        surface_area: { type: "number", description: "Superficie útil en m²" },
        built_area: { type: "number", description: "Superficie construida en m²" },
        bedrooms: { type: "integer" },
        bathrooms: { type: "integer" },
        city: { type: "string" },
        province: { type: "string" },
        address: { type: "string" },
        zip_code: { type: "string" },
        floor: { type: "string" },
        energy_cert: { type: "string", enum: ["A","B","C","D","E","F","G","En trámite","Exento"] },
        description: { type: "string", description: "Descripción profesional del inmueble (300-500 palabras)" },
        status: { type: "string", enum: ["disponible","reservado"] },
        has_elevator: { type: "boolean" },
        has_garage: { type: "boolean" },
        has_pool: { type: "boolean" },
        has_terrace: { type: "boolean" },
        has_garden: { type: "boolean" },
        features: { type: "array", items: { type: "string" } },
        missing_fields: { type: "array", items: { type: "string" } },
        follow_up_message: { type: "string" },
      },
      required: ["title", "property_type", "operation", "follow_up_message"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { messages, current_data } = await req.json();

    const systemPrompt = `Eres un asistente inmobiliario experto. El usuario te va a describir un inmueble en lenguaje natural y tú debes extraer todos los datos estructurados posibles.

INSTRUCCIONES:
- Extrae TODOS los campos que puedas identificar del texto del usuario
- Si el usuario proporciona datos parciales, combínalos con los datos previos
- Genera un título profesional si el usuario no proporciona uno
- Genera una descripción profesional para portales inmobiliarios (300-500 palabras)
- En follow_up_message, confirma lo que has extraído y pregunta por los datos importantes que faltan
- SIEMPRE usa la función extract_property

CLASIFICACIÓN DE TIPO (CRÍTICO):
- NUNCA uses "otro". Siempre clasifica con el tipo más apropiado.
- Si tiene dormitorios y es en un edificio → "piso" (o "atico"/"duplex"/"estudio" según corresponda)
- Si es independiente/unifamiliar → "chalet" o "casa" o "adosado"
- Si es un garaje o plaza de parking → "garaje"
- Si es un trastero → "trastero"
- Si es un local comercial → "local"
- Si es una oficina → "oficina"
- Si es una nave industrial → "nave"
- Si es un terreno/solar → "terreno"
- Si no puedes determinar el tipo exacto, usa "piso" como valor por defecto para viviendas

${current_data ? `DATOS PREVIOS YA EXTRAÍDOS (actualízalos con la nueva info del usuario):\n${JSON.stringify(current_data)}` : ''}`;

    const aiResult = await callAI('google/gemini-3-flash-preview', [
      { role: 'system', content: systemPrompt },
      ...messages,
    ], {
      tools: [propertyTool],
      tool_choice: { type: 'function', function: { name: 'extract_property' } },
    });

    const toolCall = aiResult.tool_calls?.[0] as any;
    if (!toolCall) throw new Error('No tool call in response');
    const extracted = JSON.parse(toolCall.function.arguments);

    return json({ extracted });
  } catch (e) {
    if (e instanceof AIError) return json({ error: e.message }, e.status);
    console.error('ai-property-extract error:', e);
    return json({ error: e instanceof Error ? e.message : 'Error desconocido' }, 500);
  }
});
