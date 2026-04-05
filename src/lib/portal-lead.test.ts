import {
  buildDemandFromFields,
  normalizeCity,
  normalizePhone,
  normalizeZone,
  propertyMatchesLeadContext,
  sameDemandSignature,
  sanitizeEmailCandidate,
} from "../../supabase/functions/_shared/portal-lead";

describe("portal lead shared helpers", () => {
  it("normalizes Spanish phone numbers consistently", () => {
    expect(normalizePhone(" 600 123 123 ")).toBe("600123123");
    expect(normalizePhone("0034 600 123 123")).toBe("+34600123123");
    expect(normalizePhone("+34 (600) 123-123")).toBe("+34600123123");
  });

  it("extracts and sanitizes email candidates", () => {
    expect(sanitizeEmailCandidate("Juan <JUAN@example.com>;")).toBe("juan@example.com");
    expect(sanitizeEmailCandidate("sin correo")).toBeNull();
  });

  it("normalizes noisy city and zone labels", () => {
    expect(normalizeCity("Denia")).toBe("Dénia");
    expect(normalizeCity("Núcleo urbano")).toBeNull();
    expect(normalizeZone(" Núcleo urbano ")).toBeNull();
    expect(normalizeZone("Playa Poniente")).toBe("Playa Poniente");
  });

  it("matches duplicate demands even if list casing and order differ", () => {
    const existing = {
      operation: "venta",
      property_type: "piso",
      property_types: ["Piso", "atico"],
      cities: ["Benidorm", "Altea"],
      zones: ["Poniente"],
      min_price: 100000,
      max_price: 250000,
      min_bedrooms: 2,
      min_surface: 80,
    };

    const incoming = {
      operation: "venta",
      property_type: "piso",
      property_types: ["atico", "piso"],
      cities: ["altea", "benidorm"],
      zones: ["poniente"],
      min_price: 100000,
      max_price: 250000,
      min_bedrooms: 2,
      min_surface: 80,
    };

    expect(sameDemandSignature(existing, incoming)).toBe(true);
  });

  it("flags contextual mismatches when property and demand do not align", () => {
    const result = propertyMatchesLeadContext(
      {
        title: "Piso en Benidorm",
        city: "Benidorm",
        province: "Alicante",
        address: "Playa de Poniente",
        price: 320000,
        bedrooms: 3,
        surface_area: 110,
      },
      {
        cities: ["Torrevieja"],
        min_price: 150000,
        max_price: 220000,
        min_bedrooms: 4,
        min_surface: 150,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.mismatches).toEqual(expect.arrayContaining(["city", "price", "bedrooms", "surface"]));
  });

  it("builds a demand candidate with default budget margins", () => {
    expect(
      buildDemandFromFields({
        operation: "venta",
        property_type: "piso",
        city: "Benidorm",
        zone: "Poniente",
        base_price: 200000,
        min_surface: 90,
      }),
    ).toEqual({
      operation: "venta",
      property_type: "piso",
      property_types: ["piso"],
      cities: ["Benidorm"],
      zones: ["Poniente"],
      min_bedrooms: null,
      min_bathrooms: null,
      min_price: 150000,
      max_price: 250000,
      min_surface: 90,
      features: [],
    });
  });
});
