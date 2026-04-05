export type PortalLeadDemandSignature = {
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

export type PortalLeadPropertyContext = {
  title?: string | null;
  city?: string | null;
  province?: string | null;
  address?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  surface_area?: number | null;
};

export type PortalLeadDemandContext = {
  cities?: string[] | null;
  min_price?: number | null;
  max_price?: number | null;
  min_bedrooms?: number | null;
  min_surface?: number | null;
};

export function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function normalizeSignatureList(values?: string[] | null) {
  return unique((values || []).map((value) => value.trim().toLowerCase()).filter(Boolean)).sort();
}

export function sameDemandSignature(
  existing: PortalLeadDemandSignature,
  incoming: Omit<PortalLeadDemandSignature, "cities" | "zones"> & {
    cities: string[];
    zones: string[];
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
    (existing.min_bedrooms || null) === (incoming.min_bedrooms || null) &&
    (existing.min_surface || null) === (incoming.min_surface || null)
  );
}

export function normalizePhone(value?: string | null) {
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

  if (digits.length === 9 && /^[6789]/.test(digits)) return digits;
  if (digits.length === 11 && digits.startsWith("34")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;

  return digits;
}

export function sanitizeEmailCandidate(value?: string | null) {
  if (!value) return null;
  const match = String(value)
    .replace(/[[\]<>(),;]+/g, " ")
    .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() || null;
}

export function normalizeCity(value?: string | null) {
  const city = (value || "").trim();
  if (!city) return null;
  if (/^n[úu]cleo(?:\s+urbano)?$/i.test(city)) return null;
  if (/^denia$/i.test(city)) return "Dénia";
  if (/^javea$/i.test(city)) return "Jávea";
  return city;
}

export function normalizeZone(value?: string | null) {
  const zone = (value || "").trim();
  if (!zone) return null;
  if (/^n[úu]cleo(?:\s+urbano)?$/i.test(zone)) return null;
  return zone;
}

export function normalizeComparableText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function propertyContainsLocationSignal(property: PortalLeadPropertyContext, city: string) {
  const bucket = normalizeComparableText([
    property.title,
    property.city,
    property.province,
    property.address,
  ].filter(Boolean).join(" "));
  const needle = normalizeComparableText(city);
  return Boolean(bucket && needle && bucket.includes(needle));
}

export function propertyMatchesLeadContext(
  property: PortalLeadPropertyContext,
  demand: PortalLeadDemandContext,
) {
  const mismatches: string[] = [];
  const matches: string[] = [];

  const demandCities = unique((demand.cities || []).map((city) => normalizeCity(city) || "").filter(Boolean));
  if (demandCities.length) {
    const cityMatch = demandCities.some((city) => propertyContainsLocationSignal(property, city));
    if (cityMatch) {
      matches.push("city");
    } else {
      mismatches.push("city");
    }
  }

  if (Number.isFinite(demand.max_price) && Number.isFinite(property.price)) {
    const propertyPrice = Number(property.price);
    const minPrice = Number.isFinite(demand.min_price) ? Number(demand.min_price) : Math.round(Number(demand.max_price) * 0.75);
    const maxPrice = Number(demand.max_price);
    if (propertyPrice >= Math.round(minPrice * 0.9) && propertyPrice <= Math.round(maxPrice * 1.1)) {
      matches.push("price");
    } else {
      mismatches.push("price");
    }
  }

  if (Number.isFinite(demand.min_surface) && Number.isFinite(property.surface_area)) {
    if (Number(property.surface_area) >= Math.round(Number(demand.min_surface) * 0.8)) {
      matches.push("surface");
    } else {
      mismatches.push("surface");
    }
  }

  if (Number.isFinite(demand.min_bedrooms) && Number.isFinite(property.bedrooms)) {
    if (Number(property.bedrooms) >= Number(demand.min_bedrooms)) {
      matches.push("bedrooms");
    } else {
      mismatches.push("bedrooms");
    }
  }

  return {
    ok: mismatches.length === 0,
    matches,
    mismatches,
  };
}

export function buildDemandFromFields(fields: {
  operation?: string | null;
  property_type?: string | null;
  city?: string | null;
  zone?: string | null;
  base_price?: number | null;
  min_surface?: number | null;
}) {
  const price = fields.base_price && Number.isFinite(fields.base_price) ? fields.base_price : null;
  return {
    operation: fields.operation || "venta",
    property_type: fields.property_type || null,
    property_types: fields.property_type ? [fields.property_type] : [],
    cities: fields.city ? [fields.city] : [],
    zones: fields.zone ? [fields.zone] : [],
    min_bedrooms: null,
    min_bathrooms: null,
    min_price: price ? Math.round(price * 0.75) : null,
    max_price: price ? Math.round(price * 1.25) : null,
    min_surface: fields.min_surface || null,
    features: [],
  };
}
