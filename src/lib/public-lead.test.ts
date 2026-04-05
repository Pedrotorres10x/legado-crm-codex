import {
  buildPublicLeadNotes,
  buildPublicLeadTags,
  resolvePublicLeadContactSemantics,
  resolvePublicLeadKind,
  resolvePublicLeadSource,
} from "../../supabase/functions/_shared/public-lead";

describe("public lead shared helpers", () => {
  it("resolves source from source key or contract source", () => {
    expect(resolvePublicLeadSource("legado-coleccion", "", "")).toEqual({
      sourceTag: "legadocoleccion",
      sourceLabel: "Legado Colección",
    });

    expect(resolvePublicLeadSource("", "costablanca-news", "Marca manual")).toEqual({
      sourceTag: "alicanteconnectnews",
      sourceLabel: "Marca manual",
    });
  });

  it("normalizes legacy lead kinds and falls back based on property presence", () => {
    expect(resolvePublicLeadKind("valuation-request", false)).toBe("seller-inquiry");
    expect(resolvePublicLeadKind("unknown", true)).toBe("property-inquiry");
    expect(resolvePublicLeadKind("unknown", false)).toBe("general-inquiry");
  });

  it("resolves contact type and pipeline stage coherently", () => {
    expect(resolvePublicLeadContactSemantics("", "property-inquiry")).toEqual({
      contactType: "comprador",
      defaultPipelineStage: "nuevo",
    });

    expect(resolvePublicLeadContactSemantics("", "seller-inquiry")).toEqual({
      contactType: "prospecto",
      defaultPipelineStage: "prospecto",
    });

    expect(resolvePublicLeadContactSemantics("colaborador", "seller-inquiry")).toEqual({
      contactType: "colaborador",
      defaultPipelineStage: "nuevo",
    });
  });

  it("builds tags from source, contract and seller context", () => {
    expect(
      buildPublicLeadTags({
        sourceTag: "legadocoleccion",
        leadKind: "seller-inquiry",
        leadContract: {
          journey: "seller",
          lead_intent: "seller",
          persona: "owner",
          municipality: "La Nucia",
        },
        sellerContext: {
          ownerProfile: "inversor",
          propertyType: "Chalet / Villa",
        },
        hasProperty: false,
      }),
    ).toEqual([
      "web-lead",
      "legadocoleccion",
      "seller-inquiry",
      "journey:seller",
      "intent:seller",
      "persona:owner",
      "municipality:la-nucia",
      "owner-profile:inversor",
      "property-type:chalet---villa",
      "general-web-lead",
    ]);
  });

  it("builds notes with lead metadata and property context", () => {
    const notes = buildPublicLeadNotes({
      safeMessage: "Quiero vender mi vivienda",
      property: {
        id: "p1",
        title: "Villa en Altea",
        price: 950000,
        city: "Altea",
      },
      leadKind: "seller-inquiry",
      sourceLabel: "Legado Inmobiliaria",
      leadContract: {
        source_page: "valoracion",
        source_url: "https://legado.example/valoracion",
        journey: "seller",
        municipality: "Altea",
        language: "es",
        utm_campaign: "spring",
      },
      sellerContext: {
        ownerProfile: "particular",
        propertyLocation: "Altea Hills",
        propertyType: "villa",
      },
      nowIso: "2026-03-31T10:00:00.000Z",
    });

    expect(notes).toEqual(expect.arrayContaining([
      "Mensaje: Quiero vender mi vivienda",
      "Propiedad de interés: Villa en Altea (p1)",
      "Precio: 950.000 €",
      "Ciudad: Altea",
      "Perfil propietario: particular",
      "Ubicación vivienda: Altea Hills",
      "Tipo inmueble: villa",
      "Municipio objetivo: Altea",
      "Idioma: es",
      "Origen: Legado Inmobiliaria",
      "Tipo lead: seller-inquiry",
      "Página origen: valoracion",
      "URL origen: https://legado.example/valoracion",
      "Journey: seller",
      "UTM campaign: spring",
      "Fecha: 2026-03-31T10:00:00.000Z",
    ]));
  });
});
