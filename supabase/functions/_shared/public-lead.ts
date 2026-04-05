export type PublicLeadSource = {
  label: string;
  tag: string;
};

export type PublicLeadSafeContract = {
  source_page?: string | null;
  source_url?: string | null;
  journey?: string | null;
  lead_intent?: string | null;
  persona?: string | null;
  municipality?: string | null;
  language?: string | null;
  utm_campaign?: string | null;
};

export type PublicLeadSafeSellerContext = {
  ownerProfile?: string | null;
  propertyLocation?: string | null;
  propertyType?: string | null;
  sourceSection?: string | null;
};

export type PublicLeadPropertySummary = {
  id: string;
  title: string | null;
  price: number | null;
  city: string | null;
};

const ALLOWED_SOURCES: Record<string, PublicLeadSource> = {
  legadocoleccion: { label: "Legado Colección", tag: "legadocoleccion" },
  alicanteconnectnews: { label: "Costa Blanca Chronicle", tag: "alicanteconnectnews" },
  legadoinmobiliaria: { label: "Legado Inmobiliaria", tag: "legado-inmobiliaria" },
  elfarodebenidorm: { label: "El Faro de Benidorm", tag: "el-faro" },
  "costablanca-news": { label: "Costa Blanca Chronicle", tag: "alicanteconnectnews" },
  "legado-coleccion": { label: "Legado Colección", tag: "legadocoleccion" },
  "legado-inmobiliaria": { label: "Legado Inmobiliaria", tag: "legado-inmobiliaria" },
  "el-faro": { label: "El Faro de Benidorm", tag: "el-faro" },
};

const LEGACY_LEAD_KIND_MAP: Record<string, string> = {
  "valuation-request": "seller-inquiry",
  valuation: "seller-inquiry",
  "property-review": "seller-inquiry",
  "owner-bulletin": "seller-inquiry",
  "local-support": "seller-inquiry",
  "owner-enquiry": "seller-inquiry",
};

const ALLOWED_LEAD_KINDS = new Set([
  "property-inquiry",
  "general-inquiry",
  "contact-message",
  "advertise-inquiry",
  "newsletter-signup",
  "seller-inquiry",
]);

const ALLOWED_CONTACT_TYPES = new Set(["comprador", "propietario", "prospecto", "contacto", "colaborador"]);

export function resolvePublicLeadSource(sourceKeyRaw: string, contractSourceRaw: string, sourceLabelRaw: string) {
  const resolvedSource =
    ALLOWED_SOURCES[sourceKeyRaw] ??
    ALLOWED_SOURCES[contractSourceRaw] ??
    ALLOWED_SOURCES.legadocoleccion;

  return {
    sourceTag: resolvedSource.tag,
    sourceLabel: sourceLabelRaw || resolvedSource.label,
  };
}

export function resolvePublicLeadKind(leadKindRaw: string, hasPropertyId: boolean) {
  const normalizedLeadKindRaw = LEGACY_LEAD_KIND_MAP[leadKindRaw] ?? leadKindRaw;

  if (ALLOWED_LEAD_KINDS.has(normalizedLeadKindRaw)) {
    return normalizedLeadKindRaw;
  }

  return hasPropertyId ? "property-inquiry" : "general-inquiry";
}

export function resolvePublicLeadContactSemantics(requestedContactType: string, leadKind: string) {
  const defaultContactType =
    leadKind === "advertise-inquiry"
      ? "colaborador"
      : leadKind === "seller-inquiry"
        ? "prospecto"
        : leadKind === "property-inquiry"
          ? "comprador"
          : "prospecto";

  const contactType = ALLOWED_CONTACT_TYPES.has(requestedContactType)
    ? requestedContactType
    : defaultContactType;

  return {
    contactType,
    defaultPipelineStage: contactType === "prospecto" ? "prospecto" : "nuevo",
  };
}

export function buildPublicLeadTags(params: {
  sourceTag: string;
  leadKind: string;
  leadContract?: PublicLeadSafeContract | null;
  sellerContext?: PublicLeadSafeSellerContext | null;
  hasProperty: boolean;
}) {
  const { sourceTag, leadKind, leadContract, sellerContext, hasProperty } = params;
  const tags = ["web-lead", sourceTag, leadKind];

  if (leadContract?.journey) tags.push(`journey:${leadContract.journey}`);
  if (leadContract?.lead_intent) tags.push(`intent:${leadContract.lead_intent}`);
  if (leadContract?.persona) tags.push(`persona:${leadContract.persona}`);
  if (leadContract?.municipality) tags.push(`municipality:${leadContract.municipality.toLowerCase().replace(/\s+/g, "-")}`);
  if (sellerContext?.ownerProfile) tags.push(`owner-profile:${sellerContext.ownerProfile}`);
  if (sellerContext?.propertyType) {
    tags.push(`property-type:${sellerContext.propertyType.toLowerCase().replace(/\s+/g, "-").replace(/[/]+/g, "-")}`);
  }
  if (!hasProperty) tags.push("general-web-lead");

  return tags;
}

export function buildPublicLeadNotes(params: {
  safeMessage: string | null;
  property: PublicLeadPropertySummary | null;
  leadKind: string;
  sourceLabel: string;
  leadContract?: PublicLeadSafeContract | null;
  sellerContext?: PublicLeadSafeSellerContext | null;
  nowIso: string;
}) {
  const { safeMessage, property, leadKind, sourceLabel, leadContract, sellerContext, nowIso } = params;
  const notesParts: string[] = [];

  if (safeMessage) notesParts.push(`Mensaje: ${safeMessage}`);

  if (property) {
    notesParts.push(`Propiedad de interés: ${property.title} (${property.id})`);
    if (property.price) notesParts.push(`Precio: ${property.price.toLocaleString("es-ES")} €`);
    if (property.city) notesParts.push(`Ciudad: ${property.city}`);
  } else {
    const leadKindNotes: Record<string, string> = {
      "general-inquiry": `Consulta general desde ${sourceLabel}`,
      "contact-message": `Mensaje de contacto desde ${sourceLabel}`,
      "advertise-inquiry": `Consulta comercial/publicitaria desde ${sourceLabel}`,
      "newsletter-signup": `Alta en newsletter desde ${sourceLabel}`,
      "property-inquiry": `Consulta inmobiliaria desde ${sourceLabel}`,
      "seller-inquiry": `Captación de propietario desde ${sourceLabel}`,
    };
    notesParts.push(leadKindNotes[leadKind] || `Consulta general desde ${sourceLabel}`);
  }

  if (sellerContext?.ownerProfile) notesParts.push(`Perfil propietario: ${sellerContext.ownerProfile}`);
  if (sellerContext?.propertyLocation) notesParts.push(`Ubicación vivienda: ${sellerContext.propertyLocation}`);
  if (sellerContext?.propertyType) notesParts.push(`Tipo inmueble: ${sellerContext.propertyType}`);
  if (leadContract?.municipality) notesParts.push(`Municipio objetivo: ${leadContract.municipality}`);
  if (leadContract?.language) notesParts.push(`Idioma: ${leadContract.language}`);
  notesParts.push(`Origen: ${sourceLabel}`);
  notesParts.push(`Tipo lead: ${leadKind}`);
  if (leadContract?.source_page) notesParts.push(`Página origen: ${leadContract.source_page}`);
  if (leadContract?.source_url) notesParts.push(`URL origen: ${leadContract.source_url}`);
  if (leadContract?.journey) notesParts.push(`Journey: ${leadContract.journey}`);
  if (leadContract?.utm_campaign) notesParts.push(`UTM campaign: ${leadContract.utm_campaign}`);
  notesParts.push(`Fecha: ${nowIso}`);

  return notesParts;
}
