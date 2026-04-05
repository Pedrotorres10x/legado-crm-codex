import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from "../_shared/cors.ts";
import { callAI, AIError } from "../_shared/ai.ts";
import { resolveAssignedAgentId } from "../_shared/agent-assignment.ts";

const extractTool = {
  type: "function",
  function: {
    name: "extract_contact_and_demand_from_email_screenshot",
    description: "Extrae contacto y demanda desde un pantallazo de email o mensaje inmobiliario.",
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

interface DemandScreenshotIntakeBody {
  image_base64?: string;
  mime_type?: string;
  file_name?: string;
  raw_text?: string;
}

interface DemandScreenshotIntakeExtracted {
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

type DemandScreenshotIntakeUserContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface DemandScreenshotIntakeToolCall {
  function: {
    arguments?: string;
  };
}

const cleanList = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

const cleanString = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

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

const extractFirstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
};

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

const unique = (items: Array<string | null | undefined>) =>
  [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const inferEmail = (text: string) => {
  const matches = Array.from(text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map((item) => item[0]);
  return matches[0]?.toLowerCase() || null;
};

const inferPhone = (text: string) => {
  const match = text.match(/(?:tel[eé]fono|m[oó]vil|phone)[:\s]*([+()\d][\d\s().-]{7,}\d)/i) ||
    text.match(/(?:^|\s)([+()\d][\d\s().-]{7,}\d)(?:\s|$)/);
  return normalizePhone(match?.[1] || null);
};

const inferName = (text: string, email: string | null) => {
  const direct = extractFirstMatch(text, [
    /(?:nombre|name|contacto|interesado(?:\/a)?|solicitante)[:\s]*([^\n|]+?)(?:\s{2,}|email:|tel[eé]fono:|phone:|$)/i,
  ]);
  if (direct) return direct.replace(/\s+/g, " ").trim();
  if (email) return email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return "Lead desde pantallazo";
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
  const full_name = inferName(text, email);
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
    message: null,
    property_type,
    operation,
    cities,
    zones: zone ? [zone] : [],
    budget_reference,
    min_price: null,
    max_price: null,
    min_surface: inferSurface(text),
    min_bedrooms: inferBedrooms(text),
    notes: text.slice(0, 2000),
    summary: summaryParts.length ? summaryParts.join(" · ") : "Demanda detectada desde pantallazo",
  };
};

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
    return { ok: false, error: "La captura no tiene contexto suficiente de demanda. Recorta mejor el anuncio o el cuerpo del email y vuelve a pegarla." };
  }

  if (noiseHits >= 4 && demandSignals <= 3) {
    return { ok: false, error: "La captura incluye demasiado texto de la interfaz. Recorta solo el contenido del email antes de pegarla." };
  }

  return { ok: true };
};

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const sameList = (left: string[], right: string[]) => {
  const a = [...left].map((item) => item.trim().toLowerCase()).filter(Boolean).sort();
  const b = [...right].map((item) => item.trim().toLowerCase()).filter(Boolean).sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    let user: { id: string } | null = null;

    if (authHeader) {
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error: authErr } = await anonClient.auth.getUser();
      if (!authErr && data?.user?.id) {
        user = { id: data.user.id };
      }
    }

    const { image_base64, mime_type, file_name, raw_text } = await req.json() as DemandScreenshotIntakeBody;
    if (!image_base64 && !raw_text) return json({ ok: false, error: "no_image" }, 400);

    const systemPrompt = `Eres un extractor de leads y demandas inmobiliarias.
Analiza este pantallazo de un email o mensaje y extrae:
- datos del contacto interesado
- lo que esta buscando comprar o alquilar

REGLAS:
- No inventes nada.
- Si ves un solo precio de referencia, devuelve budget_reference y no calcules el rango.
- Si aparece un rango claro, usa min_price y max_price.
- Si no aparece nombre pero si hay email o telefono, deja full_name vacio.
- cities solo ciudades claras; zones solo zonas o barrios claros.
- summary debe resumir la peticion en una frase corta para CRM.
- notes debe ser util para seguimiento y puede incluir el mensaje original resumido.
- Usa la funcion extract_contact_and_demand_from_email_screenshot. ${file_name ? `Archivo: ${file_name}.` : ""}`;

    let extracted: DemandScreenshotIntakeExtracted;

    try {
      const aiResult = await callAI("google/gemini-2.5-flash", [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrae contacto y demanda de este pantallazo." },
            ...(image_base64 ? [{ type: "image_url", image_url: { url: `data:${mime_type || "image/png"};base64,${image_base64}` } }] : []),
            ...(raw_text ? [{ type: "text", text: `Texto OCR de apoyo:\n${raw_text}` }] : []),
          ] as DemandScreenshotIntakeUserContent[],
        },
      ], {
        tools: [extractTool],
        tool_choice: { type: "function", function: { name: "extract_contact_and_demand_from_email_screenshot" } },
        max_tokens: 900,
      });

      const toolCall = aiResult.tool_calls?.[0] as DemandScreenshotIntakeToolCall | undefined;
      if (!toolCall) throw new Error("No se pudo extraer contacto y demanda del pantallazo");
      extracted = JSON.parse(toolCall.function.arguments || "{}") as DemandScreenshotIntakeExtracted;
    } catch (error) {
      if (error instanceof AIError && error.status === 429 && raw_text) {
        extracted = parseRawScreenshotText(raw_text);
        const validation = validateParsedScreenshotFallback(extracted);
        if (!validation.ok) {
          return json({ ok: false, error: validation.error }, 422);
        }
        extracted.notes = extracted.summary || "Extracción OCR de respaldo. Revisar antes de trabajar la ficha.";
      } else {
        throw error;
      }
    }

    const fullName = cleanString(extracted.full_name) || "Lead desde pantallazo";
    const email = cleanString(extracted.email);
    const phone = cleanString(extracted.phone);
    const message = cleanString(extracted.message);
    const notes = cleanString(extracted.notes) || cleanString(extracted.summary);
    const cities = cleanList(extracted.cities);
    const zones = cleanList(extracted.zones);
    const budgetReference = extracted.budget_reference ? Number(extracted.budget_reference) : null;
    const minPrice = extracted.min_price ? Number(extracted.min_price) : null;
    const maxPrice = extracted.max_price ? Number(extracted.max_price) : null;

    const supabase = createClient(supabaseUrl, serviceKey);

    let contactId: string | null = null;
    let duplicate = false;

    if (email) {
      const { data } = await supabase
        .from("contacts")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        contactId = data.id;
        duplicate = true;
      }
    }

    if (!contactId && phone) {
      const cleanPhone = phone.replace(/[\s\-().]/g, "");
      const { data } = await supabase
        .from("contacts")
        .select("id")
        .or(`phone.eq.${cleanPhone},phone2.eq.${cleanPhone}`)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        contactId = data.id;
        duplicate = true;
      }
    }

    const assignedAgentId = await resolveAssignedAgentId(supabase, user?.id || null);

    if (!contactId) {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          full_name: fullName.substring(0, 100),
          email,
          phone,
          contact_type: "comprador",
          status: "nuevo",
          pipeline_stage: "nuevo",
          notes: notes || null,
          tags: ["manual-demand-screenshot", "demanda-pendiente-revision"],
          agent_id: assignedAgentId,
          gdpr_consent: true,
          gdpr_consent_at: new Date().toISOString(),
          gdpr_legal_basis: "explicit_consent",
        })
        .select("id")
        .single();

      if (contactError) throw contactError;
      contactId = newContact.id;
    } else {
      await supabase
        .from("contacts")
        .update({
          agent_id: assignedAgentId,
          gdpr_consent: true,
          gdpr_consent_at: new Date().toISOString(),
          gdpr_legal_basis: "explicit_consent",
        })
        .eq("id", contactId);
    }

    const demandPayload = {
      contact_id: contactId,
      property_type: extracted.property_type || null,
      operation: extracted.operation || "venta",
      cities,
      zones,
      min_price: minPrice ?? (budgetReference ? Math.round(budgetReference * 0.75) : null),
      max_price: maxPrice ?? (budgetReference ? Math.round(budgetReference * 1.25) : null),
      min_surface: extracted.min_surface ? Number(extracted.min_surface) : null,
      min_bedrooms: extracted.min_bedrooms ? Number(extracted.min_bedrooms) : null,
      notes: [
        "[PANTALLAZO EMAIL - REVISAR]",
        notes,
        message ? `Mensaje detectado: ${message}` : null,
      ].filter(Boolean).join("\n"),
      auto_match: true,
      is_active: true,
    };

    const { data: existingDemands, error: existingDemandError } = await supabase
      .from("demands")
      .select("id, operation, property_type, cities, zones, min_price, max_price, min_surface, min_bedrooms, is_active")
      .eq("contact_id", contactId)
      .limit(50);

    if (existingDemandError) throw existingDemandError;

    const duplicateDemand = (existingDemands || []).find((item) =>
      (item.operation || "venta") === demandPayload.operation &&
      (item.property_type || null) === demandPayload.property_type &&
      sameList(item.cities || [], demandPayload.cities || []) &&
      sameList(item.zones || [], demandPayload.zones || []) &&
      (item.min_price || null) === (demandPayload.min_price || null) &&
      (item.max_price || null) === (demandPayload.max_price || null) &&
      (item.min_surface || null) === (demandPayload.min_surface || null) &&
      (item.min_bedrooms || null) === (demandPayload.min_bedrooms || null)
    );

    let demandId: string;

    if (duplicateDemand?.id) {
      demandId = duplicateDemand.id;
    } else {
      const { data: demandData, error: demandError } = await supabase
        .from("demands")
        .insert(demandPayload)
        .select("id")
        .single();

      if (demandError) throw demandError;
      demandId = demandData.id;
    }
    const warnings: string[] = [];

    try {
      const screenshotPath = `contacts/${contactId}/${Date.now()}_${file_name || "pantallazo-demanda.png"}`;
      const screenshotBytes = decodeBase64(image_base64);
      const { error: uploadError } = await supabase.storage
        .from("property-documents")
        .upload(screenshotPath, screenshotBytes, {
          contentType: mime_type || "image/png",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: documentData, error: documentError } = await supabase
        .from("documents")
        .upsert({
          bucket_id: "property-documents",
          storage_path: screenshotPath,
          file_name: file_name || "pantallazo-demanda.png",
          title: "Pantallazo de email de demanda",
          document_kind: "contact_file",
          source_context: "contact",
          notes: extracted.summary || "Pantallazo usado para crear demanda y contacto",
          mime_type: mime_type || "image/png",
          size_bytes: screenshotBytes.byteLength,
          uploaded_by: user?.id ?? null,
        }, { onConflict: "bucket_id,storage_path" })
        .select("id")
        .single();

      if (documentError) throw documentError;

      const { error: documentContactError } = await supabase
        .from("document_contacts")
        .upsert({
          document_id: documentData.id,
          contact_id: contactId,
          link_role: "primary",
        }, { onConflict: "document_id,contact_id" });

      if (documentContactError) throw documentContactError;
    } catch (error) {
      console.error("[ai-demand-screenshot-intake] document warning", error);
      warnings.push("No se pudo guardar el pantallazo en documentos");
    }

    try {
      const { error: interactionError } = await supabase.from("interactions").insert({
        contact_id: contactId,
        interaction_type: "nota",
        subject: "Demanda creada desde pantallazo",
        description: [
          extracted.summary || "Entrada manual desde pantallazo de email",
          message ? `Mensaje: ${message}` : null,
        ].filter(Boolean).join("\n"),
        agent_id: assignedAgentId,
      });

      if (interactionError) throw interactionError;
    } catch (error) {
      console.error("[ai-demand-screenshot-intake] interaction warning", error);
      warnings.push("No se pudo registrar la nota automatica");
    }

    return json({
      ok: true,
      contact_id: contactId,
      demand_id: demandId,
      duplicate,
      duplicate_demand: Boolean(duplicateDemand?.id),
      warnings,
      extracted: {
        full_name: fullName,
        email,
        phone,
        property_type: extracted.property_type || null,
        operation: extracted.operation || "venta",
        cities,
        zones,
        min_price: demandPayload.min_price,
        max_price: demandPayload.max_price,
        min_surface: demandPayload.min_surface,
        min_bedrooms: demandPayload.min_bedrooms,
        summary: extracted.summary || null,
      },
    });
  } catch (error) {
    if (error instanceof AIError) return json({ ok: false, error: error.message }, error.status);
    console.error("[ai-demand-screenshot-intake]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Error creando demanda desde pantallazo" }, 500);
  }
});
