import { corsHeaders, json, handleCors } from "../_shared/cors.ts";
import { callAI, AIError } from "../_shared/ai.ts";

const extractTool = {
  type: "function",
  function: {
    name: "extract_demand_from_email_screenshot",
    description: "Extrae una demanda inmobiliaria desde un pantallazo de un email o mensaje.",
    parameters: {
      type: "object",
      properties: {
        full_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        message: { type: "string" },
        property_type: {
          type: "string",
          enum: ["piso", "casa", "chalet", "adosado", "atico", "duplex", "estudio", "local", "oficina", "nave", "terreno", "garaje", "trastero", "otro"],
        },
        operation: {
          type: "string",
          enum: ["venta", "alquiler", "ambas"],
        },
        cities: { type: "array", items: { type: "string" } },
        zones: { type: "array", items: { type: "string" } },
        budget_reference: { type: "number" },
        min_price: { type: "number" },
        max_price: { type: "number" },
        min_surface: { type: "number" },
        min_bedrooms: { type: "number" },
        notes: { type: "string" },
        summary: { type: "string" },
      },
      required: ["summary"],
      additionalProperties: false,
    },
  },
};

interface DemandScreenshotRequestBody {
  image_base64?: string;
  mime_type?: string;
  file_name?: string;
  raw_text?: string;
}

interface DemandScreenshotExtracted {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  property_type?: string | null;
  operation?: string | null;
  cities?: string[];
  zones?: string[];
  budget_reference?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  min_surface?: number | null;
  min_bedrooms?: number | null;
  notes?: string | null;
  summary?: string | null;
}

type DemandScreenshotUserContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface DemandScreenshotToolCall {
  function: {
    arguments?: string;
  };
}

const cleanList = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

const PROPERTY_TYPES = [
  "piso",
  "casa",
  "chalet",
  "adosado",
  "atico",
  "duplex",
  "estudio",
  "local",
  "oficina",
  "nave",
  "terreno",
  "garaje",
  "trastero",
];

const CITY_CANDIDATES = [
  "Benidorm",
  "Finestrat",
  "La Nucia",
  "Altea",
  "Calpe",
  "Villajoyosa",
  "Alicante",
  "Torrevieja",
  "Jávea",
  "Javea",
  "Dénia",
  "Denia",
];

const LABEL_WORDS = [
  "NOMBRE",
  "NAME",
  "EMAIL",
  "E-MAIL",
  "CORREO",
  "CORREO ELECTRONICO",
  "CORREO ELECTRÓNICO",
  "TELÉFONO",
  "TELEFONO",
  "MÓVIL",
  "MOVIL",
  "PHONE",
  "TELEPHONE",
  "MENSAJE",
  "COMENTARIO",
  "OBSERVACIONES",
  "FECHA DE CONTACTO",
];

const REGEX_SPECIAL_CHARS = new Set(["\\", "^", "$", "*", "+", "?", ".", "(", ")", "|", "{", "}", "[", "]"]);

const normalizeLine = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const isLikelyLabelLine = (value?: string | null) => {
  const normalized = normalizeLine(String(value || ""));
  if (!normalized) return false;
  return LABEL_WORDS.some((label) => normalized === normalizeLine(label) || normalized.includes(normalizeLine(label)));
};

const sanitizeNameCandidate = (value?: string | null) => {
  const candidate = String(value || "").replace(/\s+/g, " ").trim();
  if (!candidate) return null;
  const normalized = normalizeLine(candidate);
  if (!normalized) return null;
  if (candidate.includes("@")) return null;
  if (/\d{3,}/.test(candidate)) return null;
  if (isLikelyLabelLine(candidate)) return null;

  const blockedWords = ["EMAIL", "TELEFONO", "TELÉFONO", "PHONE", "MOVIL", "MÓVIL", "MENSAJE", "DETECTADO"];
  if (blockedWords.some((word) => normalized.includes(normalizeLine(word)))) return null;

  return candidate;
};

const sanitizeMessageCandidate = (value?: string | null) => {
  const candidate = String(value || "").replace(/\s+/g, " ").trim();
  if (!candidate) return null;
  const normalized = normalizeLine(candidate);
  if (!normalized || isLikelyLabelLine(candidate)) return null;
  if (normalized === "DETECTADO") return null;
  return candidate;
};

const extractValueNearLabel = (text: string, labels: string[]) => {
  const lines = String(text || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const normalizedCurrent = normalizeLine(current);
    const matchingLabel = labels.find((label) => normalizedCurrent === normalizeLine(label));

    if (!matchingLabel) continue;

    for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 4); nextIndex += 1) {
      const candidate = lines[nextIndex]?.trim();
      if (!candidate) continue;
      if (isLikelyLabelLine(candidate)) continue;
      return candidate;
    }
  }

  return null;
};

const extractFirstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

const extractLabeledValue = (text: string, labels: string[]) => {
  for (const label of labels) {
    const escaped = Array.from(label)
      .map((char) => (REGEX_SPECIAL_CHARS.has(char) ? `\\${char}` : char))
      .join("");
    const sameLinePattern = new RegExp(`${escaped}\\s*:?\\s*([^\\n]+?)(?=\\s{2,}|\\n|$)`, "i");
    const sameLineMatch = text.match(sameLinePattern);
    if (sameLineMatch?.[1]) return sameLineMatch[1].trim();

    const nextLinePattern = new RegExp(`${escaped}\\s*:?\\s*(?:\\n|\\r\\n)\\s*([^\\n]+?)(?=\\s{2,}|\\n|$)`, "i");
    const nextLineMatch = text.match(nextLinePattern);
    if (nextLineMatch?.[1]) return nextLineMatch[1].trim();
  }
  return extractValueNearLabel(text, labels);
};

const sanitizeEmailCandidate = (value?: string | null) => {
  if (!value) return null;
  const match = String(value)
    .replaceAll("<", " ")
    .replaceAll(">", " ")
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .replaceAll(",", " ")
    .replaceAll(";", " ")
    .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() || null;
};

const unique = (items: Array<string | null | undefined>) =>
  [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const normalizePhone = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  let phone = raw.replace(/[^\d+]/g, "");
  if (!phone) return null;

  if (phone.startsWith("00")) {
    phone = `+${phone.slice(2)}`;
  }

  if (phone.startsWith("+")) {
    const digits = phone.replace(/[^\d]/g, "");
    return digits ? `+${digits}` : null;
  }

  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;

  if (digits.length === 9 && /^[6789]/.test(digits)) {
    return digits;
  }

  if (digits.length === 11 && digits.startsWith("34")) {
    return `+${digits}`;
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  return digits;
};

const inferEmail = (text: string) => {
  const labeled = extractLabeledValue(text, ["EMAIL", "E-MAIL", "CORREO", "CORREO ELECTRONICO", "CORREO ELECTRÓNICO"]);
  const candidateBucket = [labeled, text].filter(Boolean).join("\n");
  const matches = Array.from(candidateBucket.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map((item) => item[0]);
  return sanitizeEmailCandidate(matches[0] || labeled || null);
};

const inferPhone = (text: string) => {
  const labeled = extractLabeledValue(text, ["TELÉFONO", "TELEFONO", "MÓVIL", "MOVIL", "PHONE", "TELEPHONE"]);
  if (labeled) return normalizePhone(labeled);

  const match = text.match(/(?:tel[eé]fono|m[oó]vil|phone)[:\s]*([+()\d][\d\s().-]{7,}\d)/i) ||
    text.match(/(?:^|\s)([+()\d][\d\s().-]{7,}\d)(?:\s|$)/);
  return normalizePhone(match?.[1] || null);
};

const inferName = (text: string, email: string | null) => {
  const labeled = extractLabeledValue(text, ["NOMBRE", "NAME", "CONTACTO", "INTERESADO", "INTERESADO/A", "SOLICITANTE"]);
  if (labeled && !isLikelyLabelLine(labeled)) return labeled.replace(/\s+/g, " ").trim();

  const direct = extractFirstMatch(text, [
    /(?:nombre|name|contacto|interesado(?:\/a)?|solicitante)[:\s]*([^\n|]+?)(?:\s{2,}|email:|tel[eé]fono:|phone:|$)/i,
  ]);
  if (direct && !isLikelyLabelLine(direct)) return direct.replace(/\s+/g, " ").trim();
  if (email) return email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return null;
};

const inferMessage = (text: string) => {
  const labeled = extractLabeledValue(text, ["MENSAJE", "COMENTARIO", "OBSERVACIONES"]);
  if (labeled && !isLikelyLabelLine(labeled) && normalizeLine(labeled) !== "DETECTADO") return labeled;

  const direct = extractFirstMatch(text, [
    /(?:mensaje|comentario|observaciones)[:\s]*([^\n]+(?:\n(?![A-ZÁÉÍÓÚÑ ]{3,}:).+)*)/i,
  ]);

  if (direct && !isLikelyLabelLine(direct) && normalizeLine(direct) !== "DETECTADO") return direct;
  return null;
};

const inferOperation = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes("alquiler") || lower.includes("alquilar")) return "alquiler";
  if (lower.includes("comprar") || lower.includes("compra") || lower.includes("venta")) return "venta";
  return "venta";
};

const inferPropertyType = (text: string) => {
  const lower = text.toLowerCase();
  for (const type of PROPERTY_TYPES) {
    if (lower.includes(type)) return type;
  }
  if (lower.includes("apartamento")) return "piso";
  return null;
};

const inferCities = (text: string) =>
  unique(
    CITY_CANDIDATES
      .filter((city) => new RegExp(`\\b${city.replace(/\s+/g, "\\s+")}\\b`, "i").test(text))
      .map((city) => (city === "Denia" ? "Dénia" : city === "Javea" ? "Jávea" : city)),
  );

const inferZone = (text: string) =>
  extractFirstMatch(text, [
    /(?:zona|barrio|area|área)[:\s]*([^\n|]+?)(?:\s{2,}|precio:|superficie:|operaci[oó]n:|$)/i,
  ]);

const inferSurface = (text: string) => {
  const match = text.match(/(?:superficie|metros|m2|m²)[:\s]*([\d.,]+)/i) || text.match(/([\d.,]+)\s*(?:m2|m²)/i);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? Math.round(value) : null;
};

const inferBedrooms = (text: string) => {
  const match = text.match(/(?:habitaciones|dormitorios|hab\.)[:\s]*([\d]+)/i) || text.match(/([\d]+)\s*hab/i);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
};

const inferReferencePrice = (text: string) => {
  const match = text.match(/(?:precio|importe|presupuesto)[:\s]*([\d.]{2,})(?:,\d+)?\s*(?:€|euros?)?/i) ||
    text.match(/([\d.]{2,})(?:,\d+)?\s*(?:€|euros?)/i);
  if (!match?.[1]) return null;
  const raw = Number(match[1].replace(/\./g, ""));
  if (!Number.isFinite(raw)) return null;
  return raw < 1000 ? raw * 1000 : raw;
};

const parseRawScreenshotText = (rawText: string) => {
  const text = String(rawText || "").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
  const email = inferEmail(text);
  const phone = inferPhone(text);
  const full_name = sanitizeNameCandidate(inferName(text, email));
  const message = sanitizeMessageCandidate(inferMessage(text));
  const property_type = inferPropertyType(text);
  const operation = inferOperation(text);
  const cities = inferCities(text);
  const zone = inferZone(text);
  const budget_reference = inferReferencePrice(text);
  const summaryParts = [operation, property_type, cities[0] || zone || null, budget_reference ? `hasta ${budget_reference}€` : null]
    .filter(Boolean);

  return {
    full_name,
    email,
    phone,
    message,
    property_type: property_type || "",
    operation,
    cities,
    zones: zone ? [zone] : [],
    min_price: budget_reference ? Math.round(budget_reference * 0.75) : null,
    max_price: budget_reference ? Math.round(budget_reference * 1.25) : null,
    min_surface: inferSurface(text),
    min_bedrooms: inferBedrooms(text),
    notes: text.slice(0, 2000),
    summary: summaryParts.length ? summaryParts.join(" · ") : "Demanda extraida desde pantallazo",
    budget_reference,
  };
};

const mergeMissingContactFields = (primary: Record<string, unknown>, fallback: ReturnType<typeof parseRawScreenshotText>) => ({
  ...primary,
  full_name: sanitizeNameCandidate(String(primary.full_name || "")) || fallback.full_name || null,
  email: sanitizeEmailCandidate(String(primary.email || "")) || fallback.email || null,
  phone: normalizePhone(String(primary.phone || "")) || fallback.phone || null,
  message: sanitizeMessageCandidate(String(primary.message || "")) || fallback.message || null,
  property_type: primary.property_type || fallback.property_type || "",
  operation: primary.operation || fallback.operation || "venta",
  cities: cleanList(primary.cities).length ? primary.cities : fallback.cities,
  zones: cleanList(primary.zones).length ? primary.zones : fallback.zones,
  min_surface: primary.min_surface ?? fallback.min_surface ?? null,
  min_bedrooms: primary.min_bedrooms ?? fallback.min_bedrooms ?? null,
  budget_reference: primary.budget_reference ?? fallback.budget_reference ?? null,
  notes: primary.notes || fallback.notes || null,
  summary: primary.summary || fallback.summary || "Demanda extraida desde pantallazo",
});

const OCR_NOISE_PATTERNS = [
  "archivo",
  "inicio",
  "vista",
  "ayuda",
  "copilot",
  "favoritos",
  "bandeja de entrada",
  "elementos enviados",
  "correo no deseado",
  "pasos rápidos",
  "responder a todos",
  "reenviar",
  "rss",
  "open in app",
];

const validateParsedScreenshotFallback = (parsed: {
  email: string | null;
  phone: string | null;
  property_type: string | null;
  cities: string[];
  zones: string[];
  budget_reference: number | null;
  min_surface: number | null;
  min_bedrooms: number | null;
  notes: string | null;
}) => {
  const contactSignals = [parsed.email, parsed.phone].filter(Boolean).length;
  const demandSignals = [
    parsed.property_type,
    parsed.cities?.length ? "cities" : null,
    parsed.zones?.length ? "zones" : null,
    parsed.budget_reference,
    parsed.min_surface,
    parsed.min_bedrooms,
  ].filter(Boolean).length;

  const noteBucket = (parsed.notes || "").toLowerCase();
  const noiseHits = OCR_NOISE_PATTERNS.filter((token) => noteBucket.includes(token)).length;

  if (contactSignals < 1) {
    return { ok: false, error: "La captura no tiene datos claros de contacto. Recorta solo el cuerpo del email y vuelve a pegarla." };
  }

  if (demandSignals < 2) {
    return { ok: false, error: "La captura no tiene contexto suficiente de demanda. Recorta mejor el cuerpo del email y vuelve a pegarla." };
  }

  if (noiseHits >= 4 && demandSignals <= 3) {
    return { ok: false, error: "La captura incluye demasiado texto de la interfaz. Recorta solo el contenido del email antes de pegarla." };
  }

  return { ok: true };
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { image_base64, mime_type, file_name, raw_text } = await req.json() as DemandScreenshotRequestBody;
    if (!image_base64 && !raw_text) return json({ ok: false, error: "no_image" }, 400);

    const systemPrompt = `Eres un extractor de demandas inmobiliarias.
Analiza este pantallazo de un email, WhatsApp o mensaje y extrae:
- los datos del contacto interesado
- y lo que el cliente esta buscando comprar o alquilar.

REGLAS:
- No inventes datos.
- Si ves nombre, email o telefono, devuelvelos.
- Si aparece un solo precio de referencia, devuelvelo en budget_reference.
- Si aparece ya un rango explicito, usa min_price y max_price.
- cities debe contener ciudades claras; zones solo barrios o zonas.
- notes debe resumir lo relevante con tono neutro y util para CRM.
- operation por defecto venta si se ve compra de vivienda y no hay alquiler.
- summary debe ser una frase corta de lo detectado.

MUY IMPORTANTE:
- Si solo hay un precio objetivo o el precio de una vivienda que pide el cliente, NO calcules el rango. Solo devuelve budget_reference.
- El CRM calculara luego la banda de -25% / +25%.
- Usa la funcion extract_demand_from_email_screenshot. ${file_name ? `Archivo: ${file_name}.` : ""}`;

    let extracted: DemandScreenshotExtracted;

    try {
      const aiResult = await callAI("openai/gpt-4.1-mini", [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrae la demanda inmobiliaria de este pantallazo." },
            ...(image_base64 ? [{ type: "image_url", image_url: { url: `data:${mime_type || "image/png"};base64,${image_base64}` } }] : []),
            ...(raw_text ? [{ type: "text", text: `Texto OCR de apoyo:\n${raw_text}` }] : []),
          ] as DemandScreenshotUserContent[],
        },
      ], {
        tools: [extractTool],
        tool_choice: { type: "function", function: { name: "extract_demand_from_email_screenshot" } },
        max_tokens: 700,
      });

      const toolCall = aiResult.tool_calls?.[0] as DemandScreenshotToolCall | undefined;
      if (!toolCall) throw new Error("No se pudo extraer la demanda del pantallazo");
      extracted = JSON.parse(toolCall.function.arguments || "{}") as DemandScreenshotExtracted;
    } catch (error) {
      if (error instanceof AIError && error.status === 429 && raw_text) {
        extracted = parseRawScreenshotText(raw_text);
        const validation = validateParsedScreenshotFallback(extracted);
        if (!validation.ok) {
          return json({ ok: false, error: validation.error }, 422);
        }
        extracted.notes = extracted.summary || "Extracción OCR de respaldo. Revisar antes de guardar.";
      } else {
        throw error;
      }
    }

    if (raw_text) {
      extracted = mergeMissingContactFields(extracted || {}, parseRawScreenshotText(raw_text));
    }

    const budgetReference = extracted.budget_reference ? Number(extracted.budget_reference) : null;
    const minPrice = extracted.min_price ? Number(extracted.min_price) : null;
    const maxPrice = extracted.max_price ? Number(extracted.max_price) : null;

    const normalized = {
      full_name: sanitizeNameCandidate(extracted.full_name ? String(extracted.full_name) : null),
      email: sanitizeEmailCandidate(extracted.email ? String(extracted.email) : null),
      phone: extracted.phone ? normalizePhone(String(extracted.phone)) : null,
      message: sanitizeMessageCandidate(extracted.message ? String(extracted.message) : null),
      property_type: extracted.property_type || "",
      operation: extracted.operation || "venta",
      cities: cleanList(extracted.cities),
      zones: cleanList(extracted.zones),
      min_price: minPrice ?? (budgetReference ? Math.round(budgetReference * 0.75) : null),
      max_price: maxPrice ?? (budgetReference ? Math.round(budgetReference * 1.25) : null),
      min_surface: extracted.min_surface ? Number(extracted.min_surface) : null,
      min_bedrooms: extracted.min_bedrooms ? Number(extracted.min_bedrooms) : null,
      notes: extracted.notes || extracted.summary || null,
      summary: extracted.summary || "Demanda extraida desde pantallazo",
      budget_reference: budgetReference,
    };

    return json({ ok: true, extracted: normalized });
  } catch (error) {
    if (error instanceof AIError) return json({ ok: false, error: error.message }, error.status);
    console.error("[ai-demand-screenshot-extract]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Error extrayendo demanda" }, 500);
  }
});
