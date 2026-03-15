import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI, AIError } from '../_shared/ai.ts';

const contactTool = {
  type: "function",
  function: {
    name: "extract_contact",
    description: "Extrae los datos estructurados de un contacto inmobiliario a partir de la descripción del usuario.",
    parameters: {
      type: "object",
      properties: {
        full_name: { type: "string", description: "Nombre completo del contacto" },
        email: { type: "string", description: "Email" },
        phone: { type: "string", description: "Teléfono principal" },
        phone2: { type: "string", description: "Teléfono secundario" },
        city: { type: "string", description: "Ciudad" },
        address: { type: "string", description: "Dirección" },
        contact_type: { type: "string", enum: ["propietario", "comprador", "ambos", "prospecto"], description: "Tipo de contacto" },
        notes: { type: "string", description: "Notas relevantes sobre el contacto" },
        tags: { type: "array", items: { type: "string" }, description: "Etiquetas útiles" },
        pipeline_stage: { type: "string", description: "Etapa del pipeline" },
        missing_fields: { type: "array", items: { type: "string" }, description: "Campos importantes que faltan" },
        follow_up_message: { type: "string", description: "Mensaje en español confirmando lo extraído y preguntando por datos que faltan" },
      },
      required: ["full_name", "contact_type", "follow_up_message"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { messages, current_data } = await req.json();

    const systemPrompt = `Eres un asistente de CRM inmobiliario experto. El usuario te describe un contacto y tú extraes los datos estructurados.

INSTRUCCIONES:
- Extrae TODOS los campos posibles del texto
- Si el usuario da datos parciales, combínalos con los datos previos
- Determina el tipo de contacto según el contexto
- Asigna una etapa del pipeline adecuada
- Añade tags útiles para clasificar al contacto
- En follow_up_message, confirma lo extraído y pregunta por lo que falta
- SIEMPRE usa la función extract_contact

${current_data ? `DATOS PREVIOS YA EXTRAÍDOS (actualízalos con nueva info):\n${JSON.stringify(current_data)}` : ''}`;

    const aiResult = await callAI('google/gemini-3-flash-preview', [
      { role: 'system', content: systemPrompt },
      ...messages,
    ], {
      tools: [contactTool],
      tool_choice: { type: 'function', function: { name: 'extract_contact' } },
    });

    const toolCall = aiResult.tool_calls?.[0] as any;
    if (!toolCall) throw new Error('No tool call in response');
    const extracted = JSON.parse(toolCall.function.arguments);

    return json({ extracted });
  } catch (e) {
    if (e instanceof AIError) return json({ error: e.message }, e.status);
    console.error('ai-contact-extract error:', e);
    return json({ error: e instanceof Error ? e.message : 'Error desconocido' }, 500);
  }
});
