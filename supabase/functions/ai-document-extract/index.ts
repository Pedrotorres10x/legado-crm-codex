import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI, AIError } from '../_shared/ai.ts';

const extractTool = {
  type: "function",
  function: {
    name: "extract_document_data",
    description: "Extrae datos estructurados de un documento inmobiliario (DNI, nota simple, escritura, contrato, etc.)",
    parameters: {
      type: "object",
      properties: {
        document_type: { type: "string", enum: ["dni", "nie", "pasaporte", "nota_simple", "escritura", "contrato", "recibo_ibi", "certificado_energetico", "otro"] },
        full_name: { type: "string" }, id_number: { type: "string" }, nationality: { type: "string" },
        birth_date: { type: "string" }, address: { type: "string" }, city: { type: "string" },
        phone: { type: "string" }, email: { type: "string" },
        property_address: { type: "string" }, property_city: { type: "string" },
        property_province: { type: "string" }, property_zip_code: { type: "string" },
        property_type: { type: "string", enum: ["piso","casa","chalet","adosado","atico","duplex","estudio","local","oficina","nave","terreno","garaje","trastero","otro"] },
        cadastral_reference: { type: "string" }, surface_area: { type: "number" },
        built_area: { type: "number" }, bedrooms: { type: "number" }, bathrooms: { type: "number" },
        floor: { type: "string" }, price: { type: "number" }, energy_cert: { type: "string" },
        property_description: { type: "string" },
        registro: { type: "string" }, tomo: { type: "string" }, libro: { type: "string" },
        folio: { type: "string" }, finca: { type: "string" },
        titulares: { type: "array", items: { type: "object", properties: { name: { type: "string" }, id_number: { type: "string" }, percentage: { type: "string" } } } },
        cargas: { type: "string" },
        legal_flags: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "vpo",
              "proteccion_publica",
              "usufructo",
              "nuda_propiedad",
              "hipoteca",
              "embargo",
              "servidumbre",
              "tanteo_retracto",
              "arrendamiento",
              "afeccion_fiscal",
              "condicion_resolutoria",
              "opcion_compra",
            ],
          },
        },
        legal_warnings: { type: "array", items: { type: "string" } },
        legal_notes: { type: "array", items: { type: "string" } },
        titularidad_tipo: { type: "string", enum: ["individual", "cotitularidad", "desconocida"] },
        summary: { type: "string" },
        fields_found: { type: "array", items: { type: "string" } },
      },
      required: ["document_type", "summary", "fields_found"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { image_base64, image_url, file_name } = await req.json();
    if (!image_base64 && !image_url) throw new Error("Se requiere image_base64 o image_url");

    const imageContent = image_url
      ? { type: "image_url", image_url: { url: image_url } }
      : { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } };

    const systemPrompt = `Eres un experto en documentación inmobiliaria española. Analiza el documento y extrae datos.

REGLA CRÍTICA DE FIABILIDAD:
- SOLO extrae datos que puedas leer CLARAMENTE en el documento.
- Si un dato es borroso, parcial o no estás seguro, NO lo incluyas.
- NUNCA inventes, supongas ni completes datos que no aparecen literalmente.
- NO interpretes códigos MRZ como datos reales.

TIPOS DE DOCUMENTO:
- DNI/NIE (ANVERSO): Nombre, apellidos, número, fecha nacimiento, caducidad, nacionalidad.
- DNI/NIE (REVERSO): Lugar nacimiento, padres, domicilio. NO sobreescribas nombre con datos MRZ.
- Pasaporte: Nombre, número, nacionalidad, fecha nacimiento.
- Nota Simple: Datos del inmueble (dirección, referencia catastral, superficie, titulares, cargas).
- Escritura: Datos del inmueble Y de los intervinientes.
- Recibo IBI: Referencia catastral, dirección, valor catastral, titular.
- Certificado energético: Calificación, dirección, referencia catastral, superficie.
- Contrato: Datos de las partes y del inmueble.

PARA NOTA SIMPLE Y ESCRITURA, SI Y SOLO SI APARECE CLARO EN EL DOCUMENTO:
- Rellena legal_flags con marcadores como vpo, usufructo, hipoteca, embargo, servidumbre, tanteo_retracto, arrendamiento, afeccion_fiscal, condicion_resolutoria u opcion_compra.
- Rellena legal_warnings con frases breves de riesgo o cautela juridica detectada literalmente.
- Rellena legal_notes con particularidades utiles no necesariamente negativas.
- Rellena titularidad_tipo como individual, cotitularidad o desconocida.
- Si no puedes leerlo con claridad, deja esos campos vacios y no inventes.

- En fields_found indica si encontraste datos de "contact", "property" o ambos.
- SIEMPRE usa la función extract_document_data.
${file_name ? `Nombre del archivo: ${file_name}` : ''}`;

    const aiResult = await callAI('google/gemini-2.5-flash', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: [
        { type: 'text', text: 'Analiza este documento y extrae todos los datos posibles:' },
        imageContent,
      ] as any },
    ], {
      tools: [extractTool],
      tool_choice: { type: 'function', function: { name: 'extract_document_data' } },
    });

    const toolCall = aiResult.tool_calls?.[0] as any;
    if (!toolCall) throw new Error('No se pudo extraer datos del documento');
    const extracted = JSON.parse(toolCall.function.arguments);

    return json({ extracted });
  } catch (e) {
    if (e instanceof AIError) return json({ error: e.message }, e.status);
    console.error('ai-document-extract error:', e);
    return json({ error: e instanceof Error ? e.message : 'Error desconocido' }, 500);
  }
});
