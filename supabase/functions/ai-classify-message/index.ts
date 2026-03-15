import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI } from '../_shared/ai.ts';

/**
 * Generates a personalized campaign message for a contact.
 * Supports two campaign types:
 * - "classify" (default): classification/depuration campaign
 * - "demand_enrich": demand enrichment campaign (budget & zone)
 * 
 * Input: { contact, channel, agent_name?, options?, campaign_type?, demand? }
 * Output: { text, subject?, html? }
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { contact, channel, agent_name, attempt_number, previous_messages, options, campaign_type, demand } = await req.json();

    if (!contact || !channel) {
      return json({ ok: false, error: "contact and channel are required" }, 400);
    }

    const agentName = agent_name || "Alicia";
    const isEmail = channel === "email";
    const attempt = attempt_number || 1;
    const prevMsgs = previous_messages || [];
    const customOptions = options || null;
    const campaignType = campaign_type || "classify";

    // Build context about the contact
    const contextParts: string[] = [];
    if (contact.full_name) contextParts.push(`Nombre: ${contact.full_name}`);
    if (contact.city) contextParts.push(`Ciudad: ${contact.city}`);
    if (contact.nationality) contextParts.push(`Nacionalidad: ${contact.nationality}`);
    if (contact.notes) contextParts.push(`Notas: ${contact.notes.slice(0, 200)}`);
    if (contact.interactions?.length) {
      contextParts.push(`Historial: ${contact.interactions.map((i: any) => i.subject || i.description).filter(Boolean).slice(0, 3).join("; ")}`);
    }
    if (contact.demands?.length) {
      contextParts.push(`Demandas anteriores: ${contact.demands.map((d: any) => {
        const parts = [];
        if (d.operation) parts.push(d.operation);
        if (d.property_type) parts.push(d.property_type);
        if (d.cities?.length) parts.push(d.cities.join(", "));
        if (d.max_price) parts.push(`hasta ${d.max_price}€`);
        return parts.join(" - ");
      }).join("; ")}`);
    }

    // Add demand-specific context for enrichment
    if (demand && campaignType === "demand_enrich") {
      const missingParts: string[] = [];
      if (!demand.max_price) missingParts.push("presupuesto");
      if (!demand.cities?.length) missingParts.push("zona/ciudad");
      contextParts.push(`Demanda actual: ${demand.operation || 'compra'} ${demand.property_type || ''}`);
      contextParts.push(`Datos que FALTAN: ${missingParts.join(" y ")}`);
      if (demand.cities?.length) contextParts.push(`Zonas que ya tiene: ${demand.cities.join(", ")}`);
      if (demand.max_price) contextParts.push(`Presupuesto que ya tiene: ${demand.max_price}€`);
    }

    const contactContext = contextParts.length > 0 
      ? `\n\nContexto del contacto:\n${contextParts.join("\n")}` 
      : "\n\nNo hay historial previo con este contacto.";

    // Build follow-up context
    let followupContext = "";
    if (attempt > 1 && prevMsgs.length > 0) {
      followupContext = `\n\nMENSAJES ANTERIORES QUE YA ENVIASTE (NO repitas el mismo enfoque):\n${prevMsgs.map((m: string, i: number) => `Intento ${i + 1}: "${m}"`).join("\n")}`;
    }

    // Build custom options context
    let optionsContext = "";
    if (customOptions && Array.isArray(customOptions) && customOptions.length > 0) {
      optionsContext = `\n\nOPCIONES PREDEFINIDAS POR LA CAMPAÑA (usa estas tal cual al final del mensaje):\n${customOptions.map((o: string, i: number) => `${i + 1}. ${o}`).join("\n")}`;
    }

    // Adaptive tone instructions based on attempt number
    let attemptInstructions = "";
    if (attempt === 1) {
      attemptInstructions = campaignType === "demand_enrich"
        ? `Este es el PRIMER contacto de enriquecimiento. Explica brevemente que quieres afinar su búsqueda para enviarle propiedades que realmente le encajen.`
        : `Este es el PRIMER contacto. Preséntate, menciona que antes erais Pedro Torres 10x, y haz una pregunta abierta natural.`;
    } else if (attempt === 2) {
      attemptInstructions = `Este es el SEGUNDO intento. El contacto no respondió al primer mensaje. Sé breve, cercano, quizás comenta algo de valor. NO vuelvas a presentarte desde cero.`;
    } else if (attempt === 3) {
      attemptInstructions = `Este es el TERCER intento. Sé muy breve y ligero, quizás con un poco de humor suave. Si no responde a este, será el último intento.`;
    } else {
      attemptInstructions = `Este es el ÚLTIMO intento (intento ${attempt}). Sé muy breve, amable, y cierra con elegancia. Transmite que respetas su silencio.`;
    }

    // Build system prompt based on campaign type
    let systemPrompt: string;
    if (campaignType === "demand_enrich") {
      systemPrompt = buildDemandEnrichPrompt(agentName, isEmail, attemptInstructions, customOptions);
    } else if (campaignType === "qualify") {
      systemPrompt = buildQualifyPrompt(agentName, isEmail, attemptInstructions, customOptions, contact);
    } else {
      systemPrompt = buildClassifyPrompt(agentName, isEmail, attemptInstructions, customOptions);
    }

    const campaignLabel = campaignType === "demand_enrich" ? "enriquecimiento de demanda" : "clasificación";
    const userPrompt = `Genera un mensaje personalizado de ${campaignLabel} para este contacto.${contactContext}${followupContext}${optionsContext}

Canal: ${channel}
Intento número: ${attempt} de ${attempt >= 4 ? attempt : 4}
Responde SOLO con el JSON, sin markdown ni backticks.`;

    const result = await callAI('google/gemini-2.5-flash', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { max_tokens: 2000 });

    if (!result.content) {
      throw new Error("AI returned empty content");
    }

    // Parse the JSON response (strip markdown if present)
    let cleaned = result.content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);

    return json({ ok: true, ...parsed });
  } catch (e: any) {
    console.error("ai-classify-message error:", e.message);
    return json({ ok: false, error: e.message }, 500);
  }
});

/** Build the classify campaign system prompt */
function buildClassifyPrompt(agentName: string, isEmail: boolean, attemptInstructions: string, customOptions: string[] | null): string {
  const optionsBlock = customOptions
    ? `- Usa EXACTAMENTE las opciones predefinidas que se te proporcionan más abajo.`
    : `- Al final del mensaje, incluye 2-3 opciones numeradas para facilitar la respuesta.
- Las opciones deben ser CONCRETAS y DIRECTAS, como hablaría una amiga.
- OBLIGATORIO: incluye SIEMPRE estas 3 opciones mínimas:
  1. Una opción de COMPRAR/BUSCAR (ej: "Sigo buscando casa")
  2. Una opción de VENDER (ej: "Quiero vender mi casa")
  3. Una opción de NO NECESITO NADA (ej: "Ahora mismo no necesito nada")`;

  return `Eres ${agentName}, de Legado Inmobiliaria (antes Pedro Torres 10x Inmobiliaria), una inmobiliaria en la Costa Blanca (España).

CONTEXTO IMPORTANTE:
- La empresa antes se llamaba "Pedro Torres 10x" o "10x Inmobiliaria". Muchos contactos nos conocen por ese nombre.
- Ahora somos "Legado Inmobiliaria". En el primer contacto con clientes antiguos, SIEMPRE menciona que antes éramos Pedro Torres 10x.

PERSONALIDAD Y TONO (MUY IMPORTANTE):
- Eres una AMIGA EXPERTA en el sector inmobiliario. CERO comercial, CERO presión.
- Hablas como una amiga que sabe mucho del mercado y quiere echar un cable, no como una vendedora.
- Cercana, natural, directa. Usas emojis con moderación (1-2 por mensaje).
- NUNCA uses frases de marketing tipo "oportunidad única", "no te lo pierdas", "tenemos X clientes".
- No suenes corporativa. Suena humana, cálida, real.

OBJETIVO (NUNCA lo menciones explícitamente):
- Descubrir si el contacto busca comprar/alquilar, tiene una propiedad para vender/alquilar, o ya no está interesado.

CADENCIA Y SEGUIMIENTO:
- ${attemptInstructions}
- Cada mensaje debe tener un enfoque DIFERENTE al anterior.

OPCIONES DE RESPUESTA:
${optionsBlock}

REGLAS ESTRICTAS:
- NUNCA uses lenguaje de marketing agresivo, urgencia artificial ni presión.
- NO menciones "actualizar base de datos", "depurar contactos" ni nada similar.
- Usa el nombre de pila del contacto (solo el primer nombre).
- Firma como ${agentName}, de Legado Inmobiliaria.
- ${isEmail ? "Para email: genera un mensaje algo más elaborado pero igualmente cercano. Tono de amiga, no de empresa." : "Para WhatsApp: máximo 4-5 líneas (incluyendo las opciones). Breve, directo y cálido."}

${buildFormatBlock(isEmail, agentName)}`;
}

/** Build the demand enrichment campaign system prompt */
function buildDemandEnrichPrompt(agentName: string, isEmail: boolean, attemptInstructions: string, customOptions: string[] | null): string {
  const optionsBlock = customOptions
    ? `- Usa EXACTAMENTE las opciones predefinidas que se te proporcionan más abajo.`
    : `- Al final del mensaje, incluye 2-3 opciones numeradas para facilitar la respuesta.
- Adapta las opciones al dato que falta:
  - Si falta ZONA: "1. Alicante ciudad / Costa Blanca Norte", "2. Torrevieja / Costa Blanca Sur", "3. Otra zona (dime cuál)"
  - Si falta PRESUPUESTO: "1. Hasta 150.000€", "2. Entre 150.000€ y 300.000€", "3. Más de 300.000€"
  - Si faltan AMBOS: incluye opciones mixtas tipo "1. Busco en [zona] hasta [precio]", "2. Prefiero que me llames"`;

  return `Eres ${agentName}, de Legado Inmobiliaria, una inmobiliaria en la Costa Blanca (España).

PERSONALIDAD Y TONO (MUY IMPORTANTE):
- Eres una AMIGA EXPERTA en el sector inmobiliario. CERO comercial, CERO presión.
- Hablas como una amiga que quiere ayudar a encontrar justo lo que buscan, no como alguien haciendo una encuesta.
- Cercana, natural, directa. Sin florituras de marketing.

OBJETIVO:
- Obtener la ZONA PREFERIDA y/o el PRESUPUESTO del contacto para su búsqueda de propiedad.
- El contacto ya es comprador/buscador, NO necesitas clasificarlo. Solo necesitas los datos que faltan.
- Presenta la pregunta como algo natural: "para no mandarte cosas que no encajan", "para afinar y enviarte solo lo bueno".

CADENCIA Y SEGUIMIENTO:
- ${attemptInstructions}
- Cada mensaje debe tener un enfoque DIFERENTE al anterior.

OPCIONES DE RESPUESTA:
${optionsBlock}

REGLAS ESTRICTAS:
- NUNCA uses lenguaje de marketing agresivo.
- NO hagas sentir al contacto que está rellenando un formulario. Debe sentirse como una conversación entre amigos.
- Usa el nombre de pila del contacto.
- Firma como ${agentName}, de Legado Inmobiliaria.
- ${isEmail ? "Para email: genera un mensaje algo más elaborado pero igualmente cercano. Tono de amiga, no de empresa." : "Para WhatsApp: máximo 4-5 líneas (incluyendo las opciones). Breve, directo y cálido."}

${buildFormatBlock(isEmail, agentName)}`;
}

/** Build the qualify campaign system prompt (propietarios + contactos → comprador/prospecto) */
function buildQualifyPrompt(agentName: string, isEmail: boolean, attemptInstructions: string, customOptions: string[] | null, contact: any): string {
  const isPropietario = contact?.contact_type === "propietario";
  const optionsBlock = customOptions
    ? `- Usa EXACTAMENTE las opciones predefinidas que se te proporcionan más abajo.`
    : `- Al final del mensaje, incluye 2-3 opciones numeradas para facilitar la respuesta.
- OBLIGATORIO incluir estas opciones:
  1. Quiero comprar/buscar una propiedad
  2. ${isPropietario ? 'Solo quiero vender mi propiedad actual' : 'Tengo algo para vender'}
  3. Ahora mismo no necesito nada`;

  const propContext = isPropietario
    ? `\nEl contacto es PROPIETARIO, ya tiene una propiedad en cartera con nosotros. Tu objetivo es averiguar si ADEMÁS podría querer comprar algo (sería comprador) o si conoce a alguien que busque.`
    : `\nEl contacto está sin clasificar. Queremos saber si busca comprar/alquilar (comprador) o tiene algo para vender (prospecto).`;

  return `Eres ${agentName}, de Legado Inmobiliaria (antes Pedro Torres 10x Inmobiliaria), una inmobiliaria en la Costa Blanca (España).

CONTEXTO IMPORTANTE:
- La empresa antes se llamaba "Pedro Torres 10x" o "10x Inmobiliaria". Muchos contactos nos conocen por ese nombre.
- Ahora somos "Legado Inmobiliaria". En el primer contacto con clientes antiguos, SIEMPRE menciona que antes éramos Pedro Torres 10x.
${propContext}

PERSONALIDAD Y TONO (MUY IMPORTANTE):
- Eres una AMIGA EXPERTA en el sector inmobiliario. CERO comercial, CERO presión.
- Hablas como una amiga que quiere ayudar, no como una vendedora.
- Cercana, natural, directa. Sin florituras ni frases de marketing.

OBJETIVO (NUNCA lo menciones explícitamente):
- Descubrir si el contacto busca comprar/alquilar (→ comprador) o tiene una propiedad para vender/alquilar (→ prospecto).
- Si no necesita nada, respetar su decisión sin insistir.

CADENCIA Y SEGUIMIENTO:
- ${attemptInstructions}
- Cada mensaje debe tener un enfoque DIFERENTE al anterior.

OPCIONES DE RESPUESTA:
${optionsBlock}

REGLAS ESTRICTAS:
- NUNCA uses lenguaje de marketing agresivo, urgencia artificial ni presión.
- NO menciones "actualizar base de datos", "depurar contactos", "cualificar" ni nada similar.
- NUNCA digas cosas como "tenemos X clientes interesados" ni uses datos para presionar.
- Si el contacto dice que NO quiere que le contactemos, respeta su decisión.
- Usa el nombre de pila del contacto (solo el primer nombre).
- Firma como ${agentName}, de Legado Inmobiliaria.
- ${isEmail ? "Para email: genera un mensaje algo más elaborado pero igualmente cercano. Tono de amiga, no de empresa." : "Para WhatsApp: máximo 4-5 líneas (incluyendo las opciones). Breve, directo y cálido."}

${buildFormatBlock(isEmail, agentName)}`;
}

/** Shared format instructions for both campaign types */
function buildFormatBlock(isEmail: boolean, agentName: string): string {
  if (isEmail) {
    return `FORMATO EMAIL:
Devuelve un JSON con:
- "subject": asunto del email (corto, personal, como si lo escribiera una amiga — sin parecer spam ni newsletter)
- "text": versión texto plano del mensaje
- "html": HTML del email con diseño limpio y cálido. Usa este esqueleto:
  - Fondo: #f8f6f3
  - Contenedor: max-width 600px, fondo blanco, border-radius 12px
  - Header: fondo linear-gradient(135deg, #1a1a2e, #16213e), color blanco, texto "Legado Inmobiliaria"
  - Body: padding 32px, tipografía Georgia/serif para el mensaje principal
  - IMPORTANTE: Al final, incluye un botón de WhatsApp:
    - Texto: "💬 Escríbeme por WhatsApp"
    - Link: https://wa.me/34602258982?text=Hola%20${agentName}%2C%20soy%20{NOMBRE_CONTACTO}
    - Estilo: fondo #25D366, color blanco, border-radius 8px, padding 14px 28px
  - Footer: fondo #f0ede8, "${agentName} — Legado Inmobiliaria", info@planhogar.es
  - Colores de acento: #c9a96e (dorado)
- En el "text" plano, incluye al final: "💬 Escríbeme por WhatsApp: https://wa.me/34602258982"`;
  }
  return `FORMATO WHATSAPP:
Devuelve un JSON con:
- "text": el mensaje de WhatsApp (solo texto, sin HTML, sin links)`;
}
