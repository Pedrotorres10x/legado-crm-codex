import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, AIError } from "../_shared/ai.ts";
import { json, handleCors } from "../_shared/cors.ts";
import { resolveAssignedAgentId } from "../_shared/agent-assignment.ts";

const PORTAL_HINTS = [
  "fotocasa",
  "todopisos",
  "pisos.com",
  "pisos",
  "1001portales",
  "kyero",
  "thinkspain",
  "spainhouses",
] as const;

const PROPERTY_TYPES = [
  "piso",
  "casa",
  "chalet",
  "adosado",
  "bungalow",
  "atico",
  "duplex",
  "estudio",
  "local",
  "terreno",
  "nave",
  "oficina",
  "garaje",
  "trastero",
] as const;

const OPERATION_TYPES = ["venta", "alquiler", "ambas"] as const;
const CITY_CANDIDATES = [
  "Alicante",
  "Altea",
  "Benidorm",
  "Calpe",
  "Denia",
  "Denia",
  "Elche",
  "Finestrat",
  "Guardamar",
  "Javea",
  "Jávea",
  "La Nucia",
  "Orihuela",
  "Santa Pola",
  "Torrevieja",
  "Villajoyosa",
];

const AI_PROMPT = `Eres un extractor de demandas inmobiliarias para el CRM de una inmobiliaria.

Analiza el email y responde SOLO con JSON válido:
{
  "is_demand": true,
  "confidence": 0.0,
  "full_name": "nombre completo o null",
  "email": "email o null",
  "phone": "telefono o null",
  "contact_notes": "contexto breve del remitente",
  "demand": {
    "operation": "venta|alquiler|ambas|null",
    "property_type": "piso|casa|chalet|adosado|bungalow|atico|duplex|estudio|local|terreno|nave|oficina|garaje|trastero|null",
    "property_types": ["piso","atico"],
    "cities": ["Benidorm"],
    "zones": ["Poniente"],
    "min_bedrooms": 2,
    "min_bathrooms": 1,
    "min_price": null,
    "max_price": 280000,
    "min_surface": 80,
    "features": ["terraza","garaje"],
    "urgency_months": 3,
    "financing_type": "hipoteca|contado|mixto|null",
    "notes": "resumen breve de la demanda"
  },
  "needs_review": false,
  "review_reason": null,
  "summary": "resumen de una linea"
}

Reglas:
- Si el email no es una demanda real, devuelve "is_demand": false.
- No inventes datos.
- Si el mensaje menciona varios tipos de inmueble, usa "property_types".
- Si la confianza es baja o faltan datos clave, marca "needs_review": true.
- Interpreta importes de lenguaje natural en euros si el contexto es claro.`;

type OutlookDemandPayload = {
  secret?: string;
  subject?: string;
  body?: string;
  html?: string;
  from?: string;
  from_name?: string;
  sender_email?: string;
  sender_name?: string;
  attachments?: Array<{
    name?: string;
    contentType?: string;
    size?: number;
  }>;
  metadata?: Record<string, unknown>;
};

type DemandExtraction = {
  is_demand: boolean;
  confidence?: number;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_notes?: string | null;
  demand?: {
    operation?: string | null;
    property_type?: string | null;
    property_types?: string[] | null;
    cities?: string[] | null;
    zones?: string[] | null;
    min_bedrooms?: number | null;
    min_bathrooms?: number | null;
    min_price?: number | null;
    max_price?: number | null;
    min_surface?: number | null;
    features?: string[] | null;
    urgency_months?: number | null;
    financing_type?: string | null;
    notes?: string | null;
  } | null;
  needs_review?: boolean;
  review_reason?: string | null;
  summary?: string | null;
};

interface RecentDemandRow {
  id: string;
  created_at: string;
  operation: string | null;
  property_type: string | null;
  property_types: string[] | null;
  cities: string[] | null;
  zones: string[] | null;
  min_price: number | null;
  max_price: number | null;
  min_bedrooms: number | null;
  notes: string | null;
  auto_match: boolean | null;
  is_active: boolean | null;
}

interface RecentInteractionRow {
  id: string;
  subject: string | null;
  created_at: string;
}

function isPortalDemandEmail(input: {
  subject?: string | null;
  senderEmail?: string | null;
  from?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
}) {
  const bucket = [
    input.subject,
    input.senderEmail,
    input.from,
    input.textBody,
    input.htmlBody,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!bucket) return false;

  const hasPortalBrand = PORTAL_HINTS.some((hint) => bucket.includes(hint));
  const hasLeadSignals = [
    "posible cliente en tu zona",
    "interesado en",
    "ha contactado",
    "nuevo lead",
    "posible comprador",
    "quiere comprar",
    "solicitud",
  ].some((hint) => bucket.includes(hint));

  return hasPortalBrand || hasLeadSignals;
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase() || null;
  return email || null;
}

function normalizePhone(value?: string | null) {
  const phone = value?.trim() || null;
  if (!phone) return null;
  return phone.replace(/[^\d+]/g, "").slice(0, 20) || null;
}

function parseFromAddress(raw?: string | null) {
  if (!raw) return { name: null, email: null };
  const match = raw.match(/(.*)<([^>]+)>/);
  if (match) {
    return {
      name: match[1].replace(/["']/g, "").trim() || null,
      email: normalizeEmail(match[2]),
    };
  }
  if (raw.includes("@")) {
    return { name: null, email: normalizeEmail(raw) };
  }
  return { name: raw.trim() || null, email: null };
}

function normalizeStringArray(values?: string[] | null) {
  return (values || [])
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function normalizePropertyType(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return PROPERTY_TYPES.includes(normalized as typeof PROPERTY_TYPES[number]) ? normalized : null;
}

function normalizeOperation(value?: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return OPERATION_TYPES.includes(normalized as typeof OPERATION_TYPES[number]) ? normalized : null;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function addUniqueParagraph(base: string | null | undefined, incoming: string | null | undefined) {
  const existing = (base || "")
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const next = (incoming || "").trim();
  if (!next) return existing.join("\n\n") || null;
  if (!existing.includes(next)) existing.push(next);
  return existing.join("\n\n") || null;
}

function normalizeSignatureList(values?: string[] | null) {
  return unique((values || []).map((value) => value.trim().toLowerCase()).filter(Boolean)).sort();
}

function sameDemandSignature(
  existing: {
    operation: string | null;
    property_type: string | null;
    property_types: string[] | null;
    cities: string[] | null;
    zones: string[] | null;
    min_price: number | null;
    max_price: number | null;
    min_bedrooms: number | null;
  },
  incoming: {
    operation: string | null;
    property_type: string | null;
    property_types: string[];
    cities: string[];
    zones: string[];
    min_price: number | null;
    max_price: number | null;
    min_bedrooms: number | null;
  },
) {
  return (
    (existing.operation || null) === (incoming.operation || null) &&
    (existing.property_type || null) === (incoming.property_type || null) &&
    JSON.stringify(normalizeSignatureList(existing.property_types)) === JSON.stringify(normalizeSignatureList(incoming.property_types)) &&
    JSON.stringify(normalizeSignatureList(existing.cities)) === JSON.stringify(normalizeSignatureList(incoming.cities)) &&
    JSON.stringify(normalizeSignatureList(existing.zones)) === JSON.stringify(normalizeSignatureList(incoming.zones)) &&
    (existing.min_price || null) === (incoming.min_price || null) &&
    (existing.max_price || null) === (incoming.max_price || null) &&
    (existing.min_bedrooms || null) === (incoming.min_bedrooms || null)
  );
}

function findBudget(text: string) {
  const sanitized = text.replace(/(?:\+34\s*)?\d[\d\s-]{7,}\d/g, " ");
  const matches = [
    ...sanitized.matchAll(/(?:hasta|max(?:imo)?|presupuesto(?: máximo)?|por|sobre|menos de)\s*(\d{2,6})(?:\s?(k|mil))?\s*(?:€|euros?)?/gi),
    ...sanitized.matchAll(/(\d{2,6})(?:\s?(k|mil))\s*(?:€|euros?)?/gi),
    ...sanitized.matchAll(/(\d{2,6})\s*(?:€|euros?)/gi),
  ];
  const normalized = matches
    .map((match) => {
      const base = Number(match[1]);
      if (!Number.isFinite(base)) return null;
      if (match[2]) return base * 1000;
      if (base < 1000) return base * 1000;
      if (base > 20000000) return null;
      return base;
    })
    .filter((value): value is number => Boolean(value));

  if (!normalized.length) return { min_price: null, max_price: null };
  return { min_price: null, max_price: Math.max(...normalized) };
}

function findBedrooms(text: string) {
  const match = text.match(/(\d+)\s*(?:habitaciones|habitación|dormitorios|dormitorio)/i);
  return match ? Number(match[1]) : null;
}

function findBathrooms(text: string) {
  const match = text.match(/(\d+)\s*(?:baños|baño)/i);
  return match ? Number(match[1]) : null;
}

function findSurface(text: string) {
  const match = text.match(/(\d+)\s*(?:m2|m²|metros)/i);
  return match ? Number(match[1]) : null;
}

function findUrgencyMonths(text: string) {
  const monthMatch = text.match(/(\d+)\s*(?:meses|mes|months?)/i);
  if (monthMatch) return Number(monthMatch[1]);

  if (/urgente|cuanto antes|inmediato|ya/i.test(text)) return 1;
  if (/este verano|pronto/i.test(text)) return 3;
  return null;
}

function inferFinancingType(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("hipoteca")) return "hipoteca";
  if (lower.includes("contado")) return "contado";
  if (lower.includes("financi")) return "mixto";
  return null;
}

function inferZones(text: string) {
  const lower = text.toLowerCase();
  const catalog = [
    "poniente",
    "levante",
    "rincon de loix",
    "rincón de loix",
    "playa de san juan",
    "centro",
    "casco antiguo",
    "cala de finestrat",
  ];

  return unique(
    catalog.filter((zone) => lower.includes(zone)).map((zone) =>
      zone === "rincón de loix" ? "Rincón de Loix" :
      zone === "rincon de loix" ? "Rincón de Loix" :
      zone === "playa de san juan" ? "Playa de San Juan" :
      zone === "cala de finestrat" ? "Cala de Finestrat" :
      zone.charAt(0).toUpperCase() + zone.slice(1),
    ),
  );
}

function inferFullName(text: string, senderName: string | null, senderEmail: string | null) {
  const signatureMatch = text.match(/(?:soy|me llamo)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+)/i);
  if (signatureMatch) return signatureMatch[1].trim();
  if (senderName) return senderName;
  if (senderEmail) return senderEmail.split("@")[0].replace(/[._-]+/g, " ");
  return null;
}

function inferOperation(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("alquiler") || lower.includes("alquilar")) return "alquiler";
  if (lower.includes("comprar") || lower.includes("compra") || lower.includes("invert")) return "venta";
  return null;
}

function inferPropertyTypes(text: string) {
  const lower = text.toLowerCase();
  const found = PROPERTY_TYPES.filter((type) => lower.includes(type));
  return unique(found);
}

function inferFeatures(text: string) {
  const lower = text.toLowerCase();
  const catalog = ["terraza", "garaje", "piscina", "ascensor", "jardin", "jardín", "trastero", "vistas al mar"];
  return unique(catalog.filter((feature) => lower.includes(feature))).map((feature) =>
    feature === "jardín" ? "jardin" : feature,
  );
}

function inferCities(text: string) {
  const found = CITY_CANDIDATES.filter((city) => new RegExp(`\\b${city.replace(/\s+/g, "\\s+")}\\b`, "i").test(text));
  return unique(found.map((city) => city === "Denia" ? "Dénia" : city === "Javea" ? "Jávea" : city));
}

const ZONE_CITY_MAP: Record<string, string> = {
  "Poniente": "Benidorm",
  "Levante": "Benidorm",
  "Rincón de Loix": "Benidorm",
  "Playa de San Juan": "Alicante",
  "Cala de Finestrat": "Finestrat",
};

function titleCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeLocationArray(values?: string[] | null) {
  return unique(
    normalizeStringArray(values).map((value) => {
      const normalized = value
        .replace(/\s+/g, " ")
        .replace(/\bdenia\b/i, "Dénia")
        .replace(/\bjavea\b/i, "Jávea")
        .replace(/\brincon de loix\b/i, "Rincón de Loix");
      return titleCase(normalized);
    }),
  );
}

function roundBudget(value: number, operation: string | null) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const step = operation === "alquiler"
    ? (value >= 1500 ? 100 : 50)
    : (value >= 500000 ? 10000 : 5000);
  return Math.round(value / step) * step;
}

function deriveLogicalBudgetRange(
  operation: string | null,
  minPrice: number | null | undefined,
  maxPrice: number | null | undefined,
) {
  let min = typeof minPrice === "number" && Number.isFinite(minPrice) ? minPrice : null;
  let max = typeof maxPrice === "number" && Number.isFinite(maxPrice) ? maxPrice : null;

  if (min && max && min > max) {
    [min, max] = [max, min];
  }

  // If only one budget signal exists, treat it as the reference price the buyer asked for
  // and build a symmetric commercial band around it.
  if (!min && max) {
    const base = max;
    min = Math.round(base * 0.75);
    max = Math.round(base * 1.25);
  }

  if (min && !max) {
    const base = min;
    min = Math.round(base * 0.75);
    max = Math.round(base * 1.25);
  }

  min = min ? roundBudget(min, operation) : null;
  max = max ? roundBudget(max, operation) : null;

  if (min && max && min > max) {
    [min, max] = [max, min];
  }

  return { min_price: min, max_price: max };
}

function buildLogicalDemand(extracted: DemandExtraction) {
  const rawPropertyTypes = normalizeStringArray(extracted.demand?.property_types)
    .map((type) => normalizePropertyType(type))
    .filter(Boolean) as string[];
  const rawPrimaryType = normalizePropertyType(extracted.demand?.property_type);
  const propertyTypes = unique([
    ...(rawPrimaryType ? [rawPrimaryType] : []),
    ...rawPropertyTypes,
  ]);
  const propertyType = propertyTypes[0] || null;

  const operation = normalizeOperation(extracted.demand?.operation) || "venta";
  const zones = normalizeLocationArray(extracted.demand?.zones);
  const cities = unique([
    ...normalizeLocationArray(extracted.demand?.cities),
    ...zones.map((zone) => ZONE_CITY_MAP[zone]).filter(Boolean) as string[],
  ]);
  const features = unique(
    normalizeStringArray(extracted.demand?.features).map((feature) =>
      feature.toLowerCase() === "jardín" ? "jardin" : feature.toLowerCase(),
    ),
  );
  const budget = deriveLogicalBudgetRange(
    operation,
    extracted.demand?.min_price ?? null,
    extracted.demand?.max_price ?? null,
  );

  const minBedrooms = extracted.demand?.min_bedrooms || null;
  const minBathrooms = extracted.demand?.min_bathrooms || (minBedrooms && minBedrooms >= 3 ? 2 : null);
  const minSurface = extracted.demand?.min_surface || (minBedrooms && minBedrooms >= 3 ? 80 : null);
  const financingType = extracted.demand?.financing_type?.trim() || null;
  const needsMortgage = financingType === "hipoteca" || financingType === "mixto";

  const scoringSignals = [
    zones.length ? "zones" : null,
    cities.length ? "cities" : null,
    propertyType ? "propertyType" : null,
    budget.max_price ? "budget" : null,
  ].filter(Boolean).length;

  const logicalNotes = [
    extracted.demand?.notes?.trim() || null,
    zones.length ? `Zona prioritaria: ${zones.join(", ")}` : null,
    propertyTypes.length ? `Tipología: ${propertyTypes.join(", ")}` : null,
    budget.max_price ? `Banda presupuesto generada: ${budget.min_price || "?"}€-${budget.max_price}€` : null,
  ].filter(Boolean).join(" | ");

  return {
    operation,
    property_type: propertyType,
    property_types: propertyTypes,
    cities,
    zones,
    min_bedrooms: minBedrooms,
    min_bathrooms: minBathrooms,
    min_surface: minSurface,
    min_price: budget.min_price,
    max_price: budget.max_price,
    features,
    urgency_months: extracted.demand?.urgency_months || null,
    financing_type: financingType,
    needs_mortgage: needsMortgage,
    notes: logicalNotes || null,
    scoringSignals,
  };
}

function parseAiJson(content: string | null): DemandExtraction {
  const cleaned = (content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  return JSON.parse(cleaned);
}

function fallbackExtraction(subject: string, body: string, senderName: string | null, senderEmail: string | null): DemandExtraction {
  const combined = `${subject}\n${body}`;
  const propertyTypes = inferPropertyTypes(combined);
  const cities = inferCities(combined);
  const zones = inferZones(combined);
  const features = inferFeatures(combined);
  const operation = inferOperation(combined);
  const { min_price, max_price } = findBudget(combined);
  const min_bedrooms = findBedrooms(combined);
  const min_bathrooms = findBathrooms(combined);
  const min_surface = findSurface(combined);
  const urgency_months = findUrgencyMonths(combined);
  const financing_type = inferFinancingType(combined);
  const full_name = inferFullName(combined, senderName, senderEmail);

  const looksLikeDemand =
    /busco|buscamos|quiero|necesito|interesad[oa]|comprar|alquilar|invers/i.test(combined) &&
    (propertyTypes.length > 0 || cities.length > 0 || zones.length > 0 || max_price !== null);

  const enoughData = Boolean(operation || propertyTypes.length || cities.length || zones.length || max_price !== null);
  const completenessScore = [
    operation,
    propertyTypes.length ? "propertyTypes" : null,
    cities.length ? "cities" : null,
    zones.length ? "zones" : null,
    max_price !== null ? "budget" : null,
    min_bedrooms !== null ? "bedrooms" : null,
  ].filter(Boolean).length;
  const confidence = enoughData ? Math.min(0.55 + completenessScore * 0.07, 0.86) : 0.35;
  const needsReview = confidence < 0.8 || !operation || (!cities.length && !zones.length);

  return {
    is_demand: looksLikeDemand,
    confidence,
    full_name,
    email: senderEmail,
    phone: normalizePhone(combined.match(/(?:\+34\s*)?(\d{9})/)?.[1] || null),
    contact_notes: "Extracción automática propia del CRM, sin proveedores externos.",
    demand: {
      operation,
      property_type: propertyTypes[0] || null,
      property_types: propertyTypes,
      cities,
      zones,
      min_bedrooms,
      min_bathrooms,
      min_price,
      max_price,
      min_surface,
      features,
      urgency_months,
      financing_type,
      notes: "Borrador generado por extracción propia del CRM.",
    },
    needs_review: needsReview,
    review_reason: needsReview ? "Revisar antes de activar la demanda automáticamente." : null,
    summary: enoughData
      ? `Demanda detectada${cities.length ? ` en ${cities.join(", ")}` : zones.length ? ` en ${zones.join(", ")}` : ""}${max_price ? ` hasta ${max_price}€` : ""}.`
      : "Correo con intención poco clara; revisar manualmente.",
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const expectedSecret = Deno.env.get("OUTLOOK_DEMAND_SECRET");
    if (!expectedSecret) {
      console.error("[outlook-demand-inbound] OUTLOOK_DEMAND_SECRET not configured");
      return json({ ok: false, error: "webhook_not_configured" }, 500);
    }

    const body = (await req.json()) as OutlookDemandPayload;
    const providedSecret =
      req.headers.get("x-outlook-key") ||
      req.headers.get("x-webhook-secret") ||
      body.secret;

    if (providedSecret !== expectedSecret) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const parsedFrom = parseFromAddress(body.from);
    const senderEmail = normalizeEmail(body.sender_email || parsedFrom.email);
    const senderName = body.sender_name?.trim() || body.from_name?.trim() || parsedFrom.name;
    const subject = body.subject?.trim() || "(sin asunto)";
    const textBody = body.body?.trim() || "";
    const htmlBody = body.html?.trim() || "";
    const bodyForAi = textBody || htmlBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const routeToPortal = isPortalDemandEmail({
      subject,
      senderEmail: senderEmail,
      from: body.from || null,
      textBody,
      htmlBody,
    });

    if (!bodyForAi) {
      return json({ ok: false, error: "empty_body" }, 400);
    }

    if (routeToPortal) {
      const portalSecret = Deno.env.get("PORTAL_LEAD_SECRET");
      if (!portalSecret) {
        console.warn("[outlook-demand-inbound] Portal lead detected but PORTAL_LEAD_SECRET is not configured; continuing with legacy parser.");
      } else {
        const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/portal-lead-inbound`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-portal-key": portalSecret,
          },
          body: JSON.stringify({
            subject,
            body: textBody,
            html: htmlBody,
            from: body.from || null,
            from_name: senderName,
            sender_email: senderEmail,
            attachments: body.attachments || [],
            metadata: {
              ...(body.metadata || {}),
              source_mailbox: (body.metadata as Record<string, unknown> | undefined)?.source_mailbox || "power-automate",
              route_detected: "portal-lead-inbound",
              route_source: "outlook-demand-inbound",
            },
          }),
        });

        const result = await response.json();
        return json({
          ok: response.ok,
          routed_to: "portal-lead-inbound",
          result,
        }, response.status);
      }
    }

    let extracted: DemandExtraction;
    try {
      const aiResult = await callAI(
        "openai/gpt-4.1-mini",
        [
          { role: "system", content: AI_PROMPT },
          {
            role: "user",
            content: [
              `From name: ${senderName || "desconocido"}`,
              `From email: ${senderEmail || "desconocido"}`,
              `Subject: ${subject}`,
              "",
              "Body:",
              bodyForAi.slice(0, 5000),
            ].join("\n"),
          },
        ],
        { max_tokens: 900 },
      );

      extracted = parseAiJson(aiResult.content);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error || "");
      console.warn("[outlook-demand-inbound] AI legacy unavailable, using fallback extraction:", message);
      if (error instanceof AIError || /AI|OPENAI_API_KEY|gateway/i.test(message)) {
        extracted = fallbackExtraction(subject, bodyForAi, senderName, senderEmail);
      } else {
        throw error;
      }
    }
    if (!extracted.is_demand) {
      return json({
        ok: true,
        skipped: true,
        reason: "not_a_demand",
        summary: extracted.summary || null,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const extractedEmail = normalizeEmail(extracted.email || senderEmail);
    const extractedPhone = normalizePhone(extracted.phone);
    const extractedName =
      extracted.full_name?.trim() ||
      senderName ||
      (extractedEmail ? extractedEmail.split("@")[0].replace(/[._-]+/g, " ") : "Demanda Outlook");

    let existingContact: {
      id: string;
      full_name: string;
      tags: string[] | null;
      notes: string | null;
      agent_id: string | null;
    } | null = null;

    if (extractedEmail) {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, tags, notes, agent_id")
        .ilike("email", extractedEmail)
        .limit(1)
        .maybeSingle();
      if (data) existingContact = data;
    }

    if (!existingContact && extractedPhone) {
      const { data } = await supabase
        .from("contacts")
        .select("id, full_name, tags, notes, agent_id")
        .or(`phone.eq.${extractedPhone},phone2.eq.${extractedPhone}`)
        .limit(1)
        .maybeSingle();
      if (data) existingContact = data;
    }

    const logicalDemand = buildLogicalDemand(extracted);
    const hasWhatsapp = Boolean(extractedPhone);
    const contactChannels = [
      extractedEmail ? "email" : null,
      extractedPhone ? "telefono" : null,
      hasWhatsapp ? "whatsapp" : null,
    ].filter(Boolean);

    const baseTags = new Set(existingContact?.tags || []);
    baseTags.add("outlook-demanda");
    if (hasWhatsapp) baseTags.add("canal-whatsapp");
    if (extractedEmail) baseTags.add("canal-email");

    const demandConfidence = typeof extracted.confidence === "number" ? extracted.confidence : 0;
    const needsReview = false;
    baseTags.delete("demanda-pendiente-revision");
    baseTags.add("demanda-outlook-procesada");

    const reviewReason = null;

    const demandNotesParts = [
      "[OUTLOOK AUTOIMPORT]",
      extracted.demand?.notes?.trim() || null,
      extracted.summary?.trim() || null,
      `Email origen: ${subject}`,
    ].filter(Boolean);

    let contactId = existingContact?.id || null;
    const assignedAgentId = await resolveAssignedAgentId(supabase, existingContact?.agent_id || null);

    if (!contactId) {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          full_name: extractedName.slice(0, 100),
          email: extractedEmail,
          phone: extractedPhone,
          contact_type: "comprador",
          status: "nuevo",
          pipeline_stage: "nuevo",
          tags: Array.from(baseTags),
          buyer_intent: {
            source: "outlook_demand_inbound",
            channels: contactChannels,
            operation: logicalDemand.operation,
            property_type: logicalDemand.property_type,
            property_types: logicalDemand.property_types,
            cities: logicalDemand.cities,
            zones: logicalDemand.zones,
            budget: {
              min_price: logicalDemand.min_price,
              max_price: logicalDemand.max_price,
            },
          },
          needs_mortgage: logicalDemand.needs_mortgage,
          agent_id: assignedAgentId,
          notes: [extracted.contact_notes?.trim(), "Creado automáticamente desde Outlook."]
            .filter(Boolean)
            .join("\n\n") || null,
          gdpr_consent: true,
          gdpr_consent_at: new Date().toISOString(),
          gdpr_legal_basis: "explicit_consent",
        })
        .select("id, agent_id")
        .single();

      if (contactError) {
        console.error("[outlook-demand-inbound] Contact creation error:", contactError.message);
        throw contactError;
      }

      contactId = newContact.id;
      existingContact = {
        id: newContact.id,
        full_name: extractedName.slice(0, 100),
        tags: Array.from(baseTags),
        notes: null,
        agent_id: newContact.agent_id,
      };
    } else {
      const mergedNotes = addUniqueParagraph(existingContact?.notes, extracted.contact_notes?.trim());

      await supabase
        .from("contacts")
        .update({
          full_name: (extracted.full_name?.trim() || senderName || existingContact.full_name).slice(0, 100),
          email: extractedEmail || undefined,
          phone: extractedPhone || undefined,
          contact_type: "comprador",
          tags: Array.from(baseTags),
          buyer_intent: {
            source: "outlook_demand_inbound",
            channels: contactChannels,
            operation: logicalDemand.operation,
            property_type: logicalDemand.property_type,
            property_types: logicalDemand.property_types,
            cities: logicalDemand.cities,
            zones: logicalDemand.zones,
            budget: {
              min_price: logicalDemand.min_price,
              max_price: logicalDemand.max_price,
            },
          },
          needs_mortgage: logicalDemand.needs_mortgage,
          agent_id: assignedAgentId,
          notes: mergedNotes,
          pipeline_stage: "nuevo",
          gdpr_consent: true,
          gdpr_consent_at: new Date().toISOString(),
          gdpr_legal_basis: "explicit_consent",
        })
        .eq("id", contactId);

      existingContact = {
        ...existingContact,
        agent_id: assignedAgentId,
        notes: mergedNotes,
      };
    }

    const recentWindowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const recentDemandNotes = [demandNotesParts.join(" | "), logicalDemand.notes].filter(Boolean).join(" | ");

    const { data: recentDemands, error: recentDemandsError } = await supabase
      .from("demands")
      .select("id, created_at, operation, property_type, property_types, cities, zones, min_price, max_price, min_bedrooms, notes, auto_match, is_active")
      .eq("contact_id", contactId)
      .gte("created_at", recentWindowStart)
      .order("created_at", { ascending: false });

    if (recentDemandsError) {
      console.error("[outlook-demand-inbound] Recent demand lookup error:", recentDemandsError.message);
      throw recentDemandsError;
    }

    const duplicateDemand = ((recentDemands || []) as RecentDemandRow[]).find((item) =>
      sameDemandSignature(item, {
        operation: logicalDemand.operation,
        property_type: logicalDemand.property_type,
        property_types: logicalDemand.property_types,
        cities: logicalDemand.cities,
        zones: logicalDemand.zones,
        min_price: logicalDemand.min_price,
        max_price: logicalDemand.max_price,
        min_bedrooms: logicalDemand.min_bedrooms,
      }),
    );

    let demand: { id: string };

    if (duplicateDemand) {
      const { data: updatedDemand, error: updatedDemandError } = await supabase
        .from("demands")
        .update({
          min_bathrooms: logicalDemand.min_bathrooms,
          min_surface: logicalDemand.min_surface,
          features: logicalDemand.features,
          urgency_months: logicalDemand.urgency_months,
          financing_type: logicalDemand.financing_type,
          notes: duplicateDemand.notes?.includes(recentDemandNotes)
            ? duplicateDemand.notes
            : [duplicateDemand.notes, recentDemandNotes].filter(Boolean).join(" | "),
          auto_match: true,
          is_active: true,
        })
        .eq("id", duplicateDemand.id)
        .select("id")
        .single();

      if (updatedDemandError) {
        console.error("[outlook-demand-inbound] Demand dedupe update error:", updatedDemandError.message);
        throw updatedDemandError;
      }

      demand = updatedDemand;
    } else {
      const { data: insertedDemand, error: demandError } = await supabase
        .from("demands")
        .insert({
          contact_id: contactId,
          operation: logicalDemand.operation,
          property_type: logicalDemand.property_type,
          property_types: logicalDemand.property_types,
          cities: logicalDemand.cities,
          zones: logicalDemand.zones,
          min_bedrooms: logicalDemand.min_bedrooms,
          min_bathrooms: logicalDemand.min_bathrooms,
          min_price: logicalDemand.min_price,
          max_price: logicalDemand.max_price,
          min_surface: logicalDemand.min_surface,
          features: logicalDemand.features,
          urgency_months: logicalDemand.urgency_months,
          financing_type: logicalDemand.financing_type,
          notes: recentDemandNotes,
          auto_match: true,
          is_active: true,
        })
        .select("id")
        .single();

      if (demandError) {
        console.error("[outlook-demand-inbound] Demand creation error:", demandError.message);
        throw demandError;
      }

      demand = insertedDemand;
    }

    const attachmentNames = (body.attachments || [])
      .map((attachment) => attachment.name?.trim())
      .filter((value): value is string => Boolean(value));

    const interactionSubject = `Outlook demanda: ${subject}`.slice(0, 255);
    const interactionDescription = [
      extracted.summary?.trim() || null,
      attachmentNames.length ? `Adjuntos: ${attachmentNames.join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const { data: recentInteractions, error: recentInteractionsError } = await supabase
      .from("interactions")
      .select("id, subject, created_at")
      .eq("contact_id", contactId)
      .eq("interaction_type", "email")
      .gte("created_at", recentWindowStart)
      .order("created_at", { ascending: false });

    if (recentInteractionsError) {
      console.error("[outlook-demand-inbound] Recent interaction lookup error:", recentInteractionsError.message);
      throw recentInteractionsError;
    }

    const hasRecentInteraction = ((recentInteractions || []) as RecentInteractionRow[]).some((item) => item.subject === interactionSubject);

    const communicationLogPayload = {
      contact_id: contactId,
      demand_id: demand.id,
      channel: "email",
      direction: "inbound",
      source: "outlook_demand_inbound",
      subject: subject.slice(0, 500),
      body_preview: bodyForAi.slice(0, 2000),
      html_preview: htmlBody ? htmlBody.slice(0, 4000) : null,
      status: "enviado",
      metadata: {
        source: "outlook",
        sender_email: senderEmail,
        sender_name: senderName,
        confidence: demandConfidence,
        needs_review: false,
        review_reason: null,
        processing_status: "clasificado",
        attachments: attachmentNames,
        extraction: extracted,
        custom_metadata: body.metadata || {},
      },
    };

    const communicationLogResult = await supabase.from("communication_logs").insert(communicationLogPayload);
    if (communicationLogResult.error) {
      console.warn("[outlook-demand-inbound] Communication log insert warning:", communicationLogResult.error.message);
    }

    if (!hasRecentInteraction) {
      const interactionResult = await supabase.from("interactions").insert({
        contact_id: contactId,
        interaction_type: "email",
        subject: interactionSubject,
        description: interactionDescription,
      });

      if (interactionResult.error) {
        console.warn("[outlook-demand-inbound] Interaction insert warning:", interactionResult.error.message);
      }
    }

    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "coordinadora"]);

    if (admins?.length) {
      const eventType = "outlook_demand_created";
      const title = `📥 Demanda Outlook creada: ${extractedName}`;
      const description = extracted.summary?.trim()
        || subject;

      await supabase.from("notifications").insert(
        admins.map((admin) => ({
          event_type: eventType,
          entity_type: "demand",
          entity_id: demand.id,
          title,
          description,
          agent_id: admin.user_id,
        })),
      );
    }

    return json({
      ok: true,
      contact_id: contactId,
      demand_id: demand.id,
      needs_review: false,
      confidence: demandConfidence,
      summary: extracted.summary || null,
      tags: Array.from(baseTags).sort(),
      power_automate_hint: {
        endpoint: `${Deno.env.get("SUPABASE_URL")}/functions/v1/outlook-demand-inbound`,
        header: "x-outlook-key",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("[outlook-demand-inbound] Error:", message);
    return json({ ok: false, error: message }, 500);
  }
});
