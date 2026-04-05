import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";
import { resolveAssignedAgentId } from "../_shared/agent-assignment.ts";
import { sendPropertyInterestOpener } from "../_shared/match-whatsapp.ts";
import { resolveContactLanguage } from "../_shared/contact-language.ts";
import {
  buildDemandFromFields,
  normalizeCity,
  normalizePhone,
  normalizeZone,
  propertyMatchesLeadContext,
  sameDemandSignature,
  sanitizeEmailCandidate,
  unique,
} from "../_shared/portal-lead.ts";

/**
 * Receives inbound emails from Brevo Inbound Parsing for portal lead notifications.
 * Parses the email with AI to extract lead data, deduplicates contacts, links to
 * properties, creates interactions/demands, and notifies agents.
 *
 * Setup: In Brevo, add inbound parsing rule for portal-lead@inbound.planhogar.es
 * pointing to this function's URL.
 */

const AI_PROMPT = `Eres un parser de emails de notificación de portales inmobiliarios españoles.
Analiza el subject y body del email y extrae los datos del lead interesado.
Responde SOLO con JSON válido, sin explicaciones:
{
  "portal": "fotocasa|todopisos|pisos.com|1001portales|kyero|thinkspain|otro",
  "full_name": "nombre completo" o null,
  "email": "email" o null,
  "phone": "telefono" o null,
  "message": "mensaje del interesado" o null,
  "property_reference": "referencia como LGD-XXXX" o null,
  "property_title": "titulo del anuncio si aparece" o null,
  "demand": {
    "operation": "venta|alquiler" o null,
    "property_type": "piso|casa|chalet|adosado|atico|duplex|estudio|local|oficina|nave|terreno|garaje|trastero" o null,
    "cities": ["ciudad mencionada"] o [],
    "zones": ["zona o barrio mencionado"] o [],
    "min_bedrooms": numero o null,
    "min_bathrooms": numero o null,
    "min_price": numero o null,
    "max_price": numero o null,
    "min_surface": numero o null,
    "features": ["piscina","garaje","terraza","ascensor","jardin","trastero"] o []
  }
}

REGLAS PARA DEMAND:
- Extrae lo que puedas del contexto del email: tipo de inmueble del anuncio, ciudad, precio, etc.
- Si el email menciona un inmueble concreto (por título o referencia), infiere el tipo, ciudad y rango de precio.
- Si el anuncio dice "Piso en Torrevieja 120.000€", pon operation=venta, property_type=piso, cities=["Torrevieja"], max_price con +10% margen.
- Si no puedes inferir un campo, déjalo null o vacío.`;

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
] as const;

const CITY_CANDIDATES = [
  "Alicante",
  "Altea",
  "Aspe",
  "Benidorm",
  "Calpe",
  "Dénia",
  "Denia",
  "Elche",
  "Finestrat",
  "Guardamar",
  "Jávea",
  "Javea",
  "La Nucia",
  "Orihuela",
  "Pilar de la Horadada",
  "Santa Pola",
  "Torrevieja",
  "Villajoyosa",
];

type PortalLeadDemand = {
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
};

type PortalLeadExtraction = {
  portal?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  property_reference?: string | null;
  property_title?: string | null;
  language?: string | null;
  demand?: PortalLeadDemand;
};

type PortalInboundBody = {
  Subject?: string;
  subject?: string;
  Sender?: { Email?: string | null } | null;
  from?: string;
  ExtractedMarkdownMessage?: string;
  RawTextBody?: string;
  TextBody?: string;
  body?: string;
  RawHtmlBody?: string;
  Items?: Array<{ RawTextBody?: string; TextBody?: string }>;
};

type PropertyLookupRow = {
  id: string;
  agent_id: string | null;
  title: string | null;
  city: string | null;
  province: string | null;
  address: string | null;
  price: number | null;
  bedrooms: number | null;
  surface_area: number | null;
};

type ExistingDemandRow = {
  id: string;
  operation: string | null;
  property_type: string | null;
  property_types?: string[] | null;
  cities: string[] | null;
  zones: string[] | null;
  min_price: number | null;
  max_price: number | null;
  min_bedrooms: number | null;
  min_surface?: number | null;
};

type AdminUserRow = {
  user_id: string;
};

function cleanText(value?: string | null) {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function inferPortalName(subject: string, fromEmail: string, text: string) {
  const bucket = `${subject} ${fromEmail} ${text}`.toLowerCase();
  if (bucket.includes("fotocasa")) return "fotocasa";
  if (bucket.includes("todopisos")) return "todopisos";
  if (bucket.includes("pisos.com")) return "pisos.com";
  if (bucket.includes("1001portales")) return "1001portales";
  if (bucket.includes("kyero")) return "kyero";
  if (bucket.includes("thinkspain")) return "thinkspain";
  return "otro";
}

function inferEmail(text: string, fromEmail: string) {
  const labeled = extractLabeledValue(text, [
    "Email",
    "E-mail",
    "Correo",
    "Correo electrónico",
    "Correo electronico",
    "Email address",
  ]);
  const candidateBucket = [labeled, text].filter(Boolean).join("\n");
  const matches = Array.from(candidateBucket.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map((item) => item[0]);
  const filtered = matches.filter((email) => {
    const normalized = email.toLowerCase();
    return !fromEmail || normalized !== fromEmail.toLowerCase();
  });
  return filtered[0]?.toLowerCase() || null;
}

function inferPhone(text: string) {
  const match = text.match(/(?:tel[eé]fono|m[oó]vil|phone)[:\s]*([+()\d][\d\s().-]{7,}\d)/i) ||
    text.match(/(?:^|\s)([+()\d][\d\s().-]{7,}\d)(?:\s|$)/);
  return normalizePhone(match?.[1] || null);
}

function inferName(text: string, email: string | null) {
  const direct = extractFirstMatch(text, [
    /(?:nombre|name|contacto|interesado(?:\/a)?|solicitante)[:\s]*([^\n|]+?)(?:\s{2,}|email:|tel[eé]fono:|phone:|$)/i,
  ]);
  if (direct) return direct.replace(/\s+/g, " ").trim();
  if (email) {
    return email.split("@")[0].replace(/[._-]+/g, " ").trim();
  }
  return "Lead portal";
}

function inferOperation(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("alquiler") || lower.includes("alquilar")) return "alquiler";
  if (lower.includes("comprar") || lower.includes("compra") || lower.includes("venta")) return "venta";
  return "venta";
}

function inferPropertyType(text: string) {
  const lower = text.toLowerCase();
  for (const type of PROPERTY_TYPES) {
    if (lower.includes(type)) return type;
  }
  if (lower.includes("apartamento")) return "piso";
  return null;
}

function inferCities(text: string) {
  return unique(
    CITY_CANDIDATES
      .filter((city) => new RegExp(`\\b${city.replace(/\s+/g, "\\s+")}\\b`, "i").test(text))
      .map((city) => (city === "Denia" ? "Dénia" : city === "Javea" ? "Jávea" : city)),
  );
}

function inferZone(text: string) {
  return extractFirstMatch(text, [
    /(?:zona|barrio|area|área)[:\s]*([^\n|]+?)(?:\s{2,}|precio:|superficie:|operaci[oó]n:|$)/i,
  ]);
}

function inferSurface(text: string) {
  const match = text.match(/(?:superficie|metros|m2|m²)[:\s]*([\d.,]+)/i) || text.match(/([\d.,]+)\s*(?:m2|m²)/i);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) ? Math.round(value) : null;
}

function inferReferencePrice(text: string) {
  const match = text.match(/(?:precio|importe|presupuesto)[:\s]*([\d.]{2,})(?:,\d+)?\s*(?:€|euros?)?/i) ||
    text.match(/([\d.]{2,})(?:,\d+)?\s*(?:€|euros?)/i);
  if (!match?.[1]) return null;
  const raw = Number(match[1].replace(/\./g, ""));
  if (!Number.isFinite(raw)) return null;
  return raw < 1000 ? raw * 1000 : raw;
}

function inferBudgetRange(text: string) {
  const reference = inferReferencePrice(text);
  if (!reference) return { min_price: null, max_price: null };
  return {
    min_price: Math.round(reference * 0.75),
    max_price: Math.round(reference * 1.25),
  };
}

function extractLabeledValue(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sameLinePattern = new RegExp(`${escaped}\\s*:?\\s*([^\\n|]+?)(?=\\s{2,}|\\n|$)`, "i");
    const sameLineMatch = text.match(sameLinePattern);
    if (sameLineMatch?.[1]) return sameLineMatch[1].trim();

    const nextLinePattern = new RegExp(`${escaped}\\s*:?\\s*(?:\\n|\\r\\n)\\s*([^\\n|]+?)(?=\\s{2,}|\\n|$)`, "i");
    const nextLineMatch = text.match(nextLinePattern);
    if (nextLineMatch?.[1]) return nextLineMatch[1].trim();
  }
  return null;
}

function mergePortalLeadExtraction(
  primary: PortalLeadExtraction,
  portalSpecific: PortalLeadExtraction,
  fallback: PortalLeadExtraction,
) {
  return {
    ...fallback,
    ...portalSpecific,
    ...primary,
    portal: primary?.portal || portalSpecific?.portal || fallback?.portal || "otro",
    full_name: primary?.full_name || portalSpecific?.full_name || fallback?.full_name || null,
    email: sanitizeEmailCandidate(primary?.email) || sanitizeEmailCandidate(portalSpecific?.email) || sanitizeEmailCandidate(fallback?.email),
    phone: normalizePhone(primary?.phone) || normalizePhone(portalSpecific?.phone) || normalizePhone(fallback?.phone),
    message: primary?.message || portalSpecific?.message || fallback?.message || null,
    property_reference: primary?.property_reference || portalSpecific?.property_reference || fallback?.property_reference || null,
    property_title: primary?.property_title || portalSpecific?.property_title || fallback?.property_title || null,
    demand: {
      ...(fallback?.demand || {}),
      ...(portalSpecific?.demand || {}),
      ...(primary?.demand || {}),
      property_types: Array.isArray(primary?.demand?.property_types) && primary.demand.property_types.length
        ? primary.demand.property_types
        : Array.isArray(portalSpecific?.demand?.property_types) && portalSpecific.demand.property_types.length
          ? portalSpecific.demand.property_types
          : (fallback?.demand?.property_types || []),
      cities: Array.isArray(primary?.demand?.cities) && primary.demand.cities.length
        ? primary.demand.cities
        : Array.isArray(portalSpecific?.demand?.cities) && portalSpecific.demand.cities.length
          ? portalSpecific.demand.cities
          : (fallback?.demand?.cities || []),
      zones: Array.isArray(primary?.demand?.zones) && primary.demand.zones.length
        ? primary.demand.zones
        : Array.isArray(portalSpecific?.demand?.zones) && portalSpecific.demand.zones.length
          ? portalSpecific.demand.zones
          : (fallback?.demand?.zones || []),
      features: Array.isArray(primary?.demand?.features) && primary.demand.features.length
        ? primary.demand.features
        : Array.isArray(portalSpecific?.demand?.features) && portalSpecific.demand.features.length
          ? portalSpecific.demand.features
          : (fallback?.demand?.features || []),
    },
  };
}


function normalizePropertyTypeLabel(value?: string | null) {
  const lower = (value || "").trim().toLowerCase();
  if (!lower) return null;
  if (lower.includes("apartamento")) return "piso";
  for (const type of PROPERTY_TYPES) {
    if (lower.includes(type)) return type;
  }
  return null;
}


function parseTodopisosEmail(subject: string, fromEmail: string, text: string) {
  const clean = cleanText(text);
  const leadEmail = sanitizeEmailCandidate(extractLabeledValue(clean, ["Email", "E-mail"])) || inferEmail(clean, fromEmail);
  const leadPhone = normalizePhone(extractLabeledValue(clean, ["Teléfono", "Telefono", "Móvil", "Movil"])) || inferPhone(clean);
  const city = normalizeCity(extractLabeledValue(clean, ["Localidad", "Población", "Poblacion"])) || inferCities(clean)[0] || null;
  const zone = normalizeZone(extractLabeledValue(clean, ["Zona", "Barrio", "Área", "Area"]) || inferZone(clean));
  const propertyType = normalizePropertyTypeLabel(extractLabeledValue(clean, ["Tipo de inmueble", "Inmueble", "Tipo"])) || inferPropertyType(clean);
  const operation = inferOperation(extractLabeledValue(clean, ["Operación", "Operacion"]) || clean);
  const surfaceText = extractLabeledValue(clean, ["Superficie", "Superficie mínima", "Superficie minima"]);
  const minSurface = surfaceText ? inferSurface(surfaceText) : inferSurface(clean);
  const priceText = extractLabeledValue(clean, ["Precio", "Precio máximo", "Precio maximo", "Presupuesto"]);
  const basePrice = priceText ? inferReferencePrice(priceText) : inferReferencePrice(clean);
  const fullName = extractLabeledValue(clean, ["Nombre", "Nombre y apellidos", "Interesado"]) || inferName(clean, leadEmail);

  return {
    portal: "todopisos",
    full_name: fullName || "Lead portal",
    email: leadEmail,
    phone: leadPhone,
    message: null,
    property_reference: null,
    property_title: null,
    demand: buildDemandFromFields({
      operation,
      property_type: propertyType,
      city,
      zone,
      base_price: basePrice,
      min_surface: minSurface,
    }),
  };
}

function parseFotocasaEmail(subject: string, fromEmail: string, text: string) {
  const clean = cleanText(text);
  const leadEmail = sanitizeEmailCandidate(extractLabeledValue(clean, ["Email", "E-mail", "Correo electrónico", "Correo electronico"])) || inferEmail(clean, fromEmail);
  const leadPhone = normalizePhone(extractLabeledValue(clean, ["Teléfono", "Telefono", "Móvil", "Movil"])) || inferPhone(clean);
  const city = normalizeCity(extractLabeledValue(clean, ["Población", "Poblacion", "Localidad", "Ciudad"])) || inferCities(clean)[0] || null;
  const zone = normalizeZone(extractLabeledValue(clean, ["Zona", "Barrio", "Distrito"]) || inferZone(clean));
  const propertyType = normalizePropertyTypeLabel(extractLabeledValue(clean, ["Tipo de inmueble", "Tipo", "Inmueble"])) || inferPropertyType(clean);
  const operation = inferOperation(extractLabeledValue(clean, ["Operación", "Operacion"]) || clean);
  const surfaceText = extractLabeledValue(clean, ["Superficie", "Superficie útil", "Superficie util"]);
  const minSurface = surfaceText ? inferSurface(surfaceText) : inferSurface(clean);
  const priceText = extractLabeledValue(clean, ["Precio", "Presupuesto", "Precio máximo", "Precio maximo"]);
  const basePrice = priceText ? inferReferencePrice(priceText) : inferReferencePrice(clean);
  const fullName = extractLabeledValue(clean, ["Nombre", "Nombre y apellidos", "Contacto", "Interesado"]) || inferName(clean, leadEmail);

  return {
    portal: "fotocasa",
    full_name: fullName || "Lead portal",
    email: leadEmail,
    phone: leadPhone,
    message: null,
    property_reference: null,
    property_title: null,
    demand: buildDemandFromFields({
      operation,
      property_type: propertyType,
      city,
      zone,
      base_price: basePrice,
      min_surface: minSurface,
    }),
  };
}

function parsePisosComEmail(subject: string, fromEmail: string, text: string) {
  const clean = cleanText(text);
  const leadEmail = sanitizeEmailCandidate(extractLabeledValue(clean, ["Email", "E-mail", "Correo"])) || inferEmail(clean, fromEmail);
  const leadPhone = normalizePhone(extractLabeledValue(clean, ["Teléfono", "Telefono", "Móvil", "Movil"])) || inferPhone(clean);
  const city = normalizeCity(extractLabeledValue(clean, ["Localidad", "Población", "Poblacion", "Ciudad"])) || inferCities(clean)[0] || null;
  const zone = normalizeZone(extractLabeledValue(clean, ["Zona", "Barrio", "Distrito"]) || inferZone(clean));
  const propertyType = normalizePropertyTypeLabel(extractLabeledValue(clean, ["Tipo de inmueble", "Tipo", "Inmueble"])) || inferPropertyType(clean);
  const operation = inferOperation(extractLabeledValue(clean, ["Operación", "Operacion", "Demanda"]) || clean);
  const surfaceText = extractLabeledValue(clean, ["Superficie", "Superficie mínima", "Superficie minima"]);
  const minSurface = surfaceText ? inferSurface(surfaceText) : inferSurface(clean);
  const priceText = extractLabeledValue(clean, ["Precio", "Precio máximo", "Precio maximo", "Presupuesto"]);
  const basePrice = priceText ? inferReferencePrice(priceText) : inferReferencePrice(clean);
  const fullName = extractLabeledValue(clean, ["Nombre", "Nombre y apellidos", "Contacto", "Interesado"]) || inferName(clean, leadEmail);

  return {
    portal: "pisos.com",
    full_name: fullName || "Lead portal",
    email: leadEmail,
    phone: leadPhone,
    message: null,
    property_reference: null,
    property_title: null,
    demand: buildDemandFromFields({
      operation,
      property_type: propertyType,
      city,
      zone,
      base_price: basePrice,
      min_surface: minSurface,
    }),
  };
}

function parse1001PortalesEmail(subject: string, fromEmail: string, text: string) {
  const clean = cleanText(text);
  const leadEmail = sanitizeEmailCandidate(extractLabeledValue(clean, ["Email", "E-mail", "Correo", "Correo electrónico"])) || inferEmail(clean, fromEmail);
  const leadPhone = normalizePhone(extractLabeledValue(clean, ["Teléfono", "Telefono", "Móvil", "Movil", "Tel"])) || inferPhone(clean);
  const city = normalizeCity(extractLabeledValue(clean, ["Localidad", "Ciudad", "Población", "Poblacion"])) || inferCities(clean)[0] || null;
  const zone = normalizeZone(extractLabeledValue(clean, ["Zona", "Barrio", "Distrito", "Área", "Area"]) || inferZone(clean));
  const propertyType = normalizePropertyTypeLabel(extractLabeledValue(clean, ["Tipo de inmueble", "Tipo", "Inmueble"])) || inferPropertyType(clean);
  const operation = inferOperation(extractLabeledValue(clean, ["Operación", "Operacion", "Demanda"]) || clean);
  const surfaceText = extractLabeledValue(clean, ["Superficie", "Metros", "m2", "m²"]);
  const minSurface = surfaceText ? inferSurface(surfaceText) : inferSurface(clean);
  const priceText = extractLabeledValue(clean, ["Precio", "Precio máximo", "Precio maximo", "Presupuesto", "Importe"]);
  const basePrice = priceText ? inferReferencePrice(priceText) : inferReferencePrice(clean);
  const fullName = extractLabeledValue(clean, ["Nombre", "Nombre y apellidos", "Contacto", "Interesado", "Solicitante"]) || inferName(clean, leadEmail);

  return {
    portal: "1001portales",
    full_name: fullName || "Lead portal",
    email: leadEmail,
    phone: leadPhone,
    message: null,
    property_reference: null,
    property_title: null,
    demand: buildDemandFromFields({
      operation,
      property_type: propertyType,
      city,
      zone,
      base_price: basePrice,
      min_surface: minSurface,
    }),
  };
}

function parseKyeroEmail(subject: string, fromEmail: string, text: string) {
  const clean = cleanText(text);
  const leadEmail = sanitizeEmailCandidate(extractLabeledValue(clean, ["Email", "E-mail", "Correo", "Email address"])) || inferEmail(clean, fromEmail);
  const leadPhone = normalizePhone(extractLabeledValue(clean, ["Phone", "Telephone", "Teléfono", "Telefono"])) || inferPhone(clean);
  const city = normalizeCity(extractLabeledValue(clean, ["Town", "City", "Localidad", "Ciudad"])) || inferCities(clean)[0] || null;
  const zone = normalizeZone(extractLabeledValue(clean, ["Area", "Zone", "Zona", "Barrio"]) || inferZone(clean));
  const propertyType = normalizePropertyTypeLabel(extractLabeledValue(clean, ["Property type", "Type", "Tipo de inmueble"])) || inferPropertyType(clean);
  const operation = inferOperation(extractLabeledValue(clean, ["Operation", "Operación", "Operacion"]) || clean);
  const surfaceText = extractLabeledValue(clean, ["Surface", "Size", "Superficie"]);
  const minSurface = surfaceText ? inferSurface(surfaceText) : inferSurface(clean);
  const priceText = extractLabeledValue(clean, ["Price", "Budget", "Precio", "Presupuesto"]);
  const basePrice = priceText ? inferReferencePrice(priceText) : inferReferencePrice(clean);
  const fullName = extractLabeledValue(clean, ["Name", "Nombre", "Contact", "Interesado"]) || inferName(clean, leadEmail);

  return {
    portal: "kyero",
    full_name: fullName || "Lead portal",
    email: leadEmail,
    phone: leadPhone,
    message: null,
    property_reference: null,
    property_title: null,
    demand: buildDemandFromFields({
      operation,
      property_type: propertyType,
      city,
      zone,
      base_price: basePrice,
      min_surface: minSurface,
    }),
  };
}

function parseThinkSpainEmail(subject: string, fromEmail: string, text: string) {
  const clean = cleanText(text);
  const leadEmail = sanitizeEmailCandidate(extractLabeledValue(clean, ["Email", "E-mail", "Correo", "Email address"])) || inferEmail(clean, fromEmail);
  const leadPhone = normalizePhone(extractLabeledValue(clean, ["Phone", "Telephone", "Teléfono", "Telefono"])) || inferPhone(clean);
  const city = normalizeCity(extractLabeledValue(clean, ["Town", "City", "Localidad", "Ciudad"])) || inferCities(clean)[0] || null;
  const zone = normalizeZone(extractLabeledValue(clean, ["Area", "Zone", "Zona", "Barrio"]) || inferZone(clean));
  const propertyType = normalizePropertyTypeLabel(extractLabeledValue(clean, ["Property type", "Type", "Tipo de inmueble"])) || inferPropertyType(clean);
  const operation = inferOperation(extractLabeledValue(clean, ["Operation", "Operación", "Operacion"]) || clean);
  const surfaceText = extractLabeledValue(clean, ["Surface", "Size", "Superficie"]);
  const minSurface = surfaceText ? inferSurface(surfaceText) : inferSurface(clean);
  const priceText = extractLabeledValue(clean, ["Price", "Budget", "Precio", "Presupuesto"]);
  const basePrice = priceText ? inferReferencePrice(priceText) : inferReferencePrice(clean);
  const fullName = extractLabeledValue(clean, ["Name", "Nombre", "Contact", "Interesado"]) || inferName(clean, leadEmail);

  return {
    portal: "thinkspain",
    full_name: fullName || "Lead portal",
    email: leadEmail,
    phone: leadPhone,
    message: null,
    property_reference: null,
    property_title: null,
    demand: buildDemandFromFields({
      operation,
      property_type: propertyType,
      city,
      zone,
      base_price: basePrice,
      min_surface: minSurface,
    }),
  };
}

function extractLeadByPortal(subject: string, fromEmail: string, text: string) {
  const portal = inferPortalName(subject, fromEmail, text);
  if (portal === "todopisos") return parseTodopisosEmail(subject, fromEmail, text);
  if (portal === "fotocasa") return parseFotocasaEmail(subject, fromEmail, text);
  if (portal === "pisos.com") return parsePisosComEmail(subject, fromEmail, text);
  if (portal === "1001portales") return parse1001PortalesEmail(subject, fromEmail, text);
  if (portal === "kyero") return parseKyeroEmail(subject, fromEmail, text);
  if (portal === "thinkspain") return parseThinkSpainEmail(subject, fromEmail, text);
  return fallbackExtractLead(subject, fromEmail, text);
}

function fallbackExtractLead(subject: string, fromEmail: string, text: string) {
  const clean = cleanText(text);
  const leadEmail = inferEmail(clean, fromEmail);
  const leadPhone = inferPhone(clean);
  const fullName = inferName(clean, leadEmail);
  const cities = inferCities(clean);
  const zone = normalizeZone(inferZone(clean));
  const propertyType = inferPropertyType(clean);
  const operation = inferOperation(clean);
  const { min_price, max_price } = inferBudgetRange(clean);
  const min_surface = inferSurface(clean);

  return {
    portal: inferPortalName(subject, fromEmail, clean),
    full_name: fullName || "Lead portal",
    email: leadEmail,
    phone: leadPhone,
    message: null,
    property_reference: null,
    property_title: null,
    demand: {
      operation,
      property_type: propertyType,
      property_types: propertyType ? [propertyType] : [],
      cities,
      zones: zone ? [zone] : [],
      min_bedrooms: null,
      min_bathrooms: null,
      min_price,
      max_price,
      min_surface,
      features: [],
    },
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const secret = Deno.env.get("PORTAL_LEAD_SECRET");
    if (!secret) {
      console.error("[portal-lead-inbound] PORTAL_LEAD_SECRET not configured");
      return json({ ok: false, error: "webhook_not_configured" }, 500);
    }
    if (req.headers.get("x-portal-key") !== secret) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    // ── Parse inbound payload ──────────────────────────────────────────────
    let body: PortalInboundBody;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json() as PortalInboundBody;
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const itemsRaw = formData.get("items");
      if (itemsRaw) {
        const parsed = JSON.parse(itemsRaw as string) as PortalInboundBody | PortalInboundBody[];
        body = Array.isArray(parsed) ? parsed[0] : parsed;
      } else {
        body = {
          Sender: { Email: formData.get("Sender") },
          Subject: formData.get("Subject"),
          RawTextBody: formData.get("RawTextBody") || formData.get("TextBody"),
          ExtractedMarkdownMessage: formData.get("ExtractedMarkdownMessage"),
          RawHtmlBody: formData.get("RawHtmlBody"),
        };
      }
    } else {
      body = await req.json() as PortalInboundBody;
    }

    // ── Normalize: accept simplified format { subject, from, body } ───────
    const subject = body?.Subject || body?.subject || "";
    const fromEmail = body?.Sender?.Email || body?.from || "";
    const text =
      body?.ExtractedMarkdownMessage?.trim() ||
      body?.RawTextBody?.trim() ||
      body?.TextBody?.trim() ||
      body?.body?.trim() ||
      body?.Items?.[0]?.RawTextBody?.trim() ||
      body?.Items?.[0]?.TextBody?.trim() ||
      body?.RawHtmlBody?.replace(/<[^>]*>/g, " ").trim() ||
      "";

    console.log(`[portal-lead-inbound] Email from: ${fromEmail}, subject: ${subject}`);

    if (!text && !subject) {
      return json({ ok: false, error: "empty_email" }, 400);
    }

    // ── AI extraction (first), deterministic fallback if needed ───────────
    let extracted: PortalLeadExtraction;
    let extractionMeta: Record<string, unknown> = {
      primary: "openai",
      model: "gpt-4.1-mini",
      ai_attempted: true,
      ai_used: false,
      fallback_used: false,
      ai_error: null,
    };

    try {
      const aiResult = await callAI("openai/gpt-4.1-mini", [
        { role: "system", content: AI_PROMPT },
        { role: "user", content: `Subject: ${subject}\n\nBody:\n${text.slice(0, 12000)}` },
      ], { max_tokens: 700 });

      const raw = (aiResult.content || "").replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      extracted = JSON.parse(raw);
      extractionMeta = {
        ...extractionMeta,
        ai_used: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[portal-lead-inbound] AI unavailable, using fallback extraction:", message);
      extracted = extractLeadByPortal(subject, fromEmail, text);
      extractionMeta = {
        ...extractionMeta,
        fallback_used: true,
        ai_error: message,
      };
    }

    const portalSpecific = extractLeadByPortal(subject, fromEmail, text);
    const fallback = fallbackExtractLead(subject, fromEmail, text);
    extracted = mergePortalLeadExtraction(extracted || {}, portalSpecific, fallback);

    const mergedDemand = {
      ...fallback.demand,
      ...portalSpecific.demand,
      ...(extracted.demand || {}),
      property_types: extracted.demand?.property_types?.length
        ? extracted.demand.property_types
        : (portalSpecific.demand.property_types?.length ? portalSpecific.demand.property_types : fallback.demand.property_types),
      cities: extracted.demand?.cities?.length ? extracted.demand.cities : (portalSpecific.demand.cities?.length ? portalSpecific.demand.cities : fallback.demand.cities),
      zones: extracted.demand?.zones?.length ? extracted.demand.zones : (portalSpecific.demand.zones?.length ? portalSpecific.demand.zones : fallback.demand.zones),
      features: extracted.demand?.features?.length
        ? extracted.demand.features
        : (portalSpecific.demand.features?.length ? portalSpecific.demand.features : fallback.demand.features),
      property_type: extracted.demand?.property_type || portalSpecific.demand.property_type || fallback.demand.property_type,
      operation: extracted.demand?.operation || portalSpecific.demand.operation || fallback.demand.operation,
      min_price: extracted.demand?.min_price ?? portalSpecific.demand.min_price ?? fallback.demand.min_price,
      max_price: extracted.demand?.max_price ?? portalSpecific.demand.max_price ?? fallback.demand.max_price,
      min_surface: extracted.demand?.min_surface ?? portalSpecific.demand.min_surface ?? fallback.demand.min_surface,
      min_bedrooms: extracted.demand?.min_bedrooms ?? portalSpecific.demand.min_bedrooms ?? fallback.demand.min_bedrooms,
      min_bathrooms: extracted.demand?.min_bathrooms ?? portalSpecific.demand.min_bathrooms ?? fallback.demand.min_bathrooms,
    };

    const portalName = (extracted.portal || "otro").toLowerCase();
    const leadEmail = sanitizeEmailCandidate(extracted.email?.trim() || null);
    const leadPhone = normalizePhone(extracted.phone?.trim() || null);
    const leadName = extracted.full_name?.trim() || "Lead portal";
    const leadMessage = extracted.message || null;
    const propertyRef = extracted.property_reference || null;

    // ── Supabase client ────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Find property by reference ─────────────────────────────────────────
    let propertyId: string | null = null;
    let propertyAgentId: string | null = null;
    let propertyMatchMeta: { matched_by_reference: boolean; accepted: boolean; matches?: string[]; mismatches?: string[] } | null = null;

    if (propertyRef) {
      let prop: PropertyLookupRow | null = null;
      const propertySelect = "id, agent_id, title, city, province, address, price, bedrooms, surface_area";

      const { data: byCrmRef } = await supabase
        .from("properties")
        .select(propertySelect)
        .ilike("crm_reference", propertyRef)
        .limit(1)
        .maybeSingle();
      prop = byCrmRef || null;

      if (!prop) {
        const { data: byXmlId } = await supabase
          .from("properties")
          .select(propertySelect)
          .eq("xml_id", propertyRef)
          .limit(1)
          .maybeSingle();
        prop = byXmlId || null;
      }

      if (prop) {
        const propertyContextCheck = propertyMatchesLeadContext(prop, mergedDemand || {});
        propertyMatchMeta = {
          matched_by_reference: true,
          accepted: propertyContextCheck.ok,
          matches: propertyContextCheck.matches,
          mismatches: propertyContextCheck.mismatches,
        };

        if (propertyContextCheck.ok) {
          propertyId = prop.id;
          propertyAgentId = prop.agent_id;
        } else {
          console.warn(
            `[portal-lead-inbound] Property ref ${propertyRef} rejected by context check: ${propertyContextCheck.mismatches.join(",")}`,
          );
        }
      }
    }

    // ── Deduplicate contact ────────────────────────────────────────────────
    let contactId: string | null = null;
    let isDuplicate = false;
    let existingPreferredLanguage: string | null = null;

    if (leadEmail) {
      const { data } = await supabase
        .from("contacts")
        .select("id, agent_id, preferred_language")
        .ilike("email", leadEmail)
        .limit(1)
        .maybeSingle();
      if (data) {
        contactId = data.id;
        isDuplicate = true;
        if (!propertyAgentId) propertyAgentId = data.agent_id;
        existingPreferredLanguage = data.preferred_language || null;
      }
    }

    if (!contactId && leadPhone) {
      const cleanPhone = leadPhone.replace(/[\s\-().]/g, "");
      const { data } = await supabase
        .from("contacts")
        .select("id, agent_id, preferred_language")
        .or(`phone.eq.${cleanPhone},phone2.eq.${cleanPhone}`)
        .limit(1)
        .maybeSingle();
      if (data) {
        contactId = data.id;
        isDuplicate = true;
        if (!propertyAgentId) propertyAgentId = data.agent_id;
        existingPreferredLanguage = data.preferred_language || null;
      }
    }

    const assignedAgentId = await resolveAssignedAgentId(supabase, propertyAgentId || null);
    const preferredLanguage = resolveContactLanguage(extracted.language || existingPreferredLanguage || null, leadMessage, subject, text, extracted.property_title || null, leadName);

    // ── Create new contact if needed ───────────────────────────────────────
    if (!contactId) {
      const tags = ["portal-lead", `portal:${portalName}`];
      const { data: newContact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          full_name: leadName.substring(0, 100),
          email: leadEmail?.substring(0, 255) || null,
          phone: leadPhone?.substring(0, 20) || null,
          contact_type: "comprador",
          status: "nuevo",
          pipeline_stage: "nuevo",
          preferred_language: preferredLanguage,
          tags,
          agent_id: assignedAgentId,
          notes: `Lead desde portal: ${portalName}`,
          gdpr_consent: true,
          gdpr_consent_at: new Date().toISOString(),
          gdpr_legal_basis: "explicit_consent",
        })
        .select("id")
        .single();
      if (contactErr) {
        console.error("[portal-lead-inbound] Contact creation error:", contactErr);
        throw contactErr;
      }
      contactId = newContact.id;
    } else {
      await supabase
        .from("contacts")
        .update({
          agent_id: assignedAgentId,
          preferred_language: preferredLanguage,
          gdpr_consent: true,
          gdpr_consent_at: new Date().toISOString(),
          gdpr_legal_basis: "explicit_consent",
        })
        .eq("id", contactId);
    }

    // ── Create interaction ─────────────────────────────────────────────────
    // ── Create demand ────────────────────────────────────────────────────
    const aiDemand = mergedDemand || {};
    let demandCreated = false;
    let duplicateDemandId: string | null = null;

    const normalizedPropertyTypes = unique(
      [
        ...(Array.isArray(aiDemand.property_types) ? aiDemand.property_types : []),
        ...(aiDemand.property_type ? [aiDemand.property_type] : []),
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    );

    const demandCandidate = {
      operation: aiDemand.operation || "venta",
      property_type: aiDemand.property_type || normalizedPropertyTypes[0] || null,
      property_types: normalizedPropertyTypes,
      cities: Array.isArray(aiDemand.cities) ? aiDemand.cities : [],
      zones: Array.isArray(aiDemand.zones) ? aiDemand.zones : [],
      min_price: aiDemand.min_price || null,
      max_price: aiDemand.max_price || null,
      min_bedrooms: aiDemand.min_bedrooms || null,
      min_surface: aiDemand.min_surface || null,
    };

    const hasDemandPayload = Boolean(
      demandCandidate.cities.length ||
      demandCandidate.zones.length ||
      demandCandidate.property_type ||
      demandCandidate.max_price ||
      demandCandidate.min_price ||
      demandCandidate.min_surface ||
      demandCandidate.min_bedrooms,
    );

    if (hasDemandPayload) {
      const { data: existingDemands, error: existingDemandsError } = await supabase
        .from("demands")
        .select("id, operation, property_type, property_types, cities, zones, min_price, max_price, min_bedrooms, min_surface")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (existingDemandsError) {
        console.error("[portal-lead-inbound] Existing demand lookup error:", existingDemandsError.message);
        throw existingDemandsError;
      }

      const duplicateDemand = ((existingDemands || []) as ExistingDemandRow[]).find((item) =>
        sameDemandSignature(item, demandCandidate),
      );

      if (duplicateDemand) {
        duplicateDemandId = duplicateDemand.id;
      }
    }

    if (duplicateDemandId) {
      await supabase.from("portal_leads").insert({
        portal_name: portalName,
        contact_id: contactId,
        property_id: propertyId,
        raw_email_subject: subject.substring(0, 500),
        raw_email_from: fromEmail.substring(0, 255),
        extracted_data: {
          ...extracted,
          extraction_meta: extractionMeta,
          property_match: propertyMatchMeta,
          dedupe: {
            duplicate_demand: true,
            duplicate_demand_id: duplicateDemandId,
          },
        },
        status: "duplicate_demand",
      });

      console.log(`[portal-lead-inbound] Skipping duplicate demand for contact ${contactId}: ${duplicateDemandId}`);
      return json({
        ok: true,
        contact_id: contactId,
        portal: portalName,
        duplicate: isDuplicate,
        duplicate_demand: true,
        demand_id: duplicateDemandId,
        property_id: propertyId,
      });
    }

    const description = [
      `Portal: ${portalName}`,
      leadMessage ? `Mensaje: ${leadMessage.substring(0, 500)}` : null,
      propertyRef ? `Ref. inmueble: ${propertyRef}` : null,
      extracted.property_title ? `Anuncio: ${extracted.property_title}` : null,
      propertyMatchMeta && propertyMatchMeta.accepted === false
        ? `Ref. no vinculada automáticamente por incoherencia: ${propertyMatchMeta.mismatches?.join(", ")}`
        : null,
    ].filter(Boolean).join("\n");

    await supabase.from("interactions").insert({
      contact_id: contactId,
      interaction_type: "nota",
      subject: `Lead desde ${portalName}`,
      description,
      property_id: propertyId || null,
      agent_id: assignedAgentId,
    });

    let demandId: string | null = null;
    let propertyForOpener: { id: string; title?: string | null; city?: string | null; province?: string | null } | null = null;

    if (propertyId) {
      const { data: prop } = await supabase
        .from("properties")
        .select("id, title, city, province, property_type, operation, price")
        .eq("id", propertyId)
        .maybeSingle();

      if (prop) {
        const { data: insertedDemand, error: insertDemandError } = await supabase.from("demands").insert({
          contact_id: contactId,
          cities: prop.city ? [prop.city] : (aiDemand.cities?.length ? aiDemand.cities : []),
          zones: aiDemand.zones?.length ? aiDemand.zones : [],
          property_type: prop.property_type || aiDemand.property_type || null,
          property_types: normalizedPropertyTypes,
          operation: prop.operation || aiDemand.operation || "venta",
          max_price: prop.price ? Math.round(prop.price * 1.1) : (aiDemand.max_price || null),
          min_price: aiDemand.min_price || null,
          min_bedrooms: aiDemand.min_bedrooms || null,
          min_bathrooms: aiDemand.min_bathrooms || null,
          min_surface: aiDemand.min_surface || null,
          features: aiDemand.features?.length ? aiDemand.features : [],
          auto_match: true,
        }).select("id").single();
        if (insertDemandError) throw insertDemandError;
        demandId = insertedDemand.id;
        propertyForOpener = prop;
        demandCreated = true;
      }
    } else if (aiDemand.cities?.length || aiDemand.property_type || aiDemand.max_price) {
      const { data: insertedDemand, error: insertDemandError } = await supabase.from("demands").insert({
        contact_id: contactId,
        cities: aiDemand.cities || [],
        zones: aiDemand.zones || [],
        property_type: aiDemand.property_type || null,
        property_types: normalizedPropertyTypes,
        operation: aiDemand.operation || "venta",
        max_price: aiDemand.max_price || null,
        min_price: aiDemand.min_price || null,
        min_bedrooms: aiDemand.min_bedrooms || null,
        min_bathrooms: aiDemand.min_bathrooms || null,
        min_surface: aiDemand.min_surface || null,
        features: aiDemand.features?.length ? aiDemand.features : [],
        auto_match: true,
      }).select("id").single();
      if (insertDemandError) throw insertDemandError;
      demandId = insertedDemand.id;
      demandCreated = true;
    }

    if (propertyForOpener && contactId) {
      await sendPropertyInterestOpener({
        supabase,
        contact: {
          id: contactId,
          full_name: leadName,
          phone: leadPhone,
          agent_id: assignedAgentId,
          gdpr_consent: true,
        },
        property: propertyForOpener,
        demandId,
        source: "portal-lead-inbound",
        preferredLanguage,
        languageSamples: [leadMessage, subject, text, extracted.property_title || null],
      });
    }

    // ── Insert portal_leads record ─────────────────────────────────────────
    await supabase.from("portal_leads").insert({
      portal_name: portalName,
      contact_id: contactId,
      property_id: propertyId,
      raw_email_subject: subject.substring(0, 500),
      raw_email_from: fromEmail.substring(0, 255),
      extracted_data: {
        ...extracted,
        extraction_meta: extractionMeta,
        property_match: propertyMatchMeta,
      },
      status: isDuplicate ? "duplicado" : "nuevo",
    });

    // ── Push notification ──────────────────────────────────────────────────
    try {
      const targetAgents: string[] = [];
      if (assignedAgentId) {
        targetAgents.push(assignedAgentId);
      } else {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        if (admins) targetAgents.push(...(admins as AdminUserRow[]).map((a) => a.user_id));
      }

      for (const agentId of targetAgents) {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            agent_id: agentId,
            title: `🏠 Lead desde ${portalName}`,
            body: `${leadName}${propertyRef ? ` · ${propertyRef}` : ""}`,
            data: { table: "contacts", id: contactId },
          }),
        });
      }
    } catch (pushErr) {
      console.warn("[portal-lead-inbound] Push failed:", pushErr);
    }

    console.log(`[portal-lead-inbound] Lead processed: ${contactId} from ${portalName} (${isDuplicate ? "duplicado" : "nuevo"})`);

    return json({
      ok: true,
      contact_id: contactId,
      portal: portalName,
      duplicate: isDuplicate,
      demand_created: demandCreated,
      demand_id: demandId,
      property_id: propertyId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[portal-lead-inbound] Error:", message);
    return json({ ok: false, error: "Error al procesar el lead del portal" }, 500);
  }
});
