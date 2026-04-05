const TYPE_FAMILIES: Record<string, string[]> = {
  piso: ["piso", "atico", "duplex", "estudio"],
  atico: ["piso", "atico", "duplex"],
  duplex: ["piso", "atico", "duplex"],
  estudio: ["piso", "estudio"],
  casa: ["casa", "chalet", "adosado"],
  chalet: ["casa", "chalet", "adosado"],
  adosado: ["casa", "chalet", "adosado"],
  bungalow: ["bungalow", "casa", "chalet", "adosado"],
  local: ["local"],
  oficina: ["oficina"],
  nave: ["nave"],
  terreno: ["terreno"],
  garaje: ["garaje"],
  trastero: ["trastero"],
  otro: ["otro"],
};

export const MATCHING_PILLARS = {
  geography: 28,
  operation: 18,
  propertyFamily: 20,
  budget: 22,
  bedrooms: 7,
  surface: 5,
} as const;

function normalizeType(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export function getAllowedPropertyTypes(
  propertyType?: string | null,
  propertyTypes?: string[] | null,
) {
  const normalized = [
    ...(propertyType ? [propertyType] : []),
    ...(propertyTypes || []),
  ]
    .map((value) => normalizeType(value))
    .filter((value): value is string => Boolean(value));

  if (!normalized.length) return [];

  return Array.from(
    new Set(
      normalized.flatMap((value) => TYPE_FAMILIES[value] || [value]),
    ),
  );
}

export function propertyTypeMatches(
  demandPropertyType?: string | null,
  demandPropertyTypes?: string[] | null,
  propertyType?: string | null,
) {
  const propType = normalizeType(propertyType);
  if (!propType) return true;

  const allowed = getAllowedPropertyTypes(demandPropertyType, demandPropertyTypes);
  if (!allowed.length) return true;

  return allowed.includes(propType);
}

export function bedroomMatches(
  requestedBedrooms?: number | null,
  propertyBedrooms?: number | null,
) {
  if (!requestedBedrooms || !propertyBedrooms) return true;

  if (requestedBedrooms <= 2) {
    return propertyBedrooms >= requestedBedrooms - 1 && propertyBedrooms <= requestedBedrooms + 1;
  }

  if (requestedBedrooms === 3) {
    return propertyBedrooms >= 2 && propertyBedrooms <= 4;
  }

  return propertyBedrooms >= requestedBedrooms - 1;
}

export function budgetMatches(
  minPrice: number | null | undefined,
  maxPrice: number | null | undefined,
  propertyPrice: number | null | undefined,
  priceMarginPct: number,
) {
  if (!propertyPrice) {
    return { ok: true, insideTarget: false, nearTarget: false };
  }

  const price = Number(propertyPrice);
  const min = minPrice ? Number(minPrice) : null;
  const max = maxPrice ? Number(maxPrice) : null;

  if (max && price > max * (1 + priceMarginPct)) {
    return { ok: false, insideTarget: false, nearTarget: false };
  }

  if (min && price < min * (1 - priceMarginPct)) {
    return { ok: false, insideTarget: false, nearTarget: false };
  }

  const insideTarget = (!min || price >= min) && (!max || price <= max);
  const nearTarget = !insideTarget && (
    (Boolean(max) && price <= (max as number) * (1 + priceMarginPct)) ||
    (Boolean(min) && price >= (min as number) * (1 - priceMarginPct))
  );

  return { ok: true, insideTarget, nearTarget };
}

export function operationMatches(
  demandOperation?: string | null,
  propertyOperation?: string | null,
) {
  if (!demandOperation || !propertyOperation) return true;
  return (
    demandOperation === propertyOperation ||
    demandOperation === "ambas" ||
    propertyOperation === "ambas"
  );
}

export function scoreBedroomFit(
  requestedBedrooms?: number | null,
  propertyBedrooms?: number | null,
) {
  if (!requestedBedrooms || !propertyBedrooms) return 0;
  const gap = Math.abs(Number(propertyBedrooms) - Number(requestedBedrooms));
  if (gap === 0) return 1;
  if (gap === 1 && bedroomMatches(requestedBedrooms, propertyBedrooms)) return 0.85;
  if (bedroomMatches(requestedBedrooms, propertyBedrooms)) return 0.55;
  return 0;
}

export function scoreBudgetFit(
  minPrice: number | null | undefined,
  maxPrice: number | null | undefined,
  propertyPrice: number | null | undefined,
  priceMarginPct: number,
) {
  const budget = budgetMatches(minPrice, maxPrice, propertyPrice, priceMarginPct);
  if (!budget.ok) return { ok: false, score: 0 };
  if (budget.insideTarget) return { ok: true, score: 1 };
  if (budget.nearTarget) return { ok: true, score: 0.65 };
  return { ok: true, score: 0.35 };
}
