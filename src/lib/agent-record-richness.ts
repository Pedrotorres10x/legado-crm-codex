type PropertyRichnessRow = {
  id: string;
  title?: string | null;
  price?: number | null;
  address?: string | null;
  city?: string | null;
  description?: string | null;
  images?: string[] | null;
  videos?: string[] | null;
  virtual_tour_url?: string | null;
  reference?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  surface_area?: number | null;
  mandate_type?: string | null;
  status?: string | null;
};

type RichnessIssue =
  | 'base'
  | 'description'
  | 'photos'
  | 'audiovisual'
  | 'reference'
  | 'features'
  | 'mandate';

const issueLabels: Record<RichnessIssue, string> = {
  base: 'datos base',
  description: 'descripcion comercial',
  photos: 'fotos',
  audiovisual: 'material audiovisual',
  reference: 'referencia/catastro',
  features: 'caracteristicas',
  mandate: 'mandato',
};

const scorePropertyRichness = (property: PropertyRichnessRow) => {
  let score = 0;
  const issues: RichnessIssue[] = [];

  if (property.title?.trim()) score += 10;
  if (property.price) score += 10;
  if (property.address?.trim() && property.city?.trim()) score += 10;
  if (!property.title?.trim() || !property.price || !property.address?.trim() || !property.city?.trim()) {
    issues.push('base');
  }

  if ((property.description || '').trim().length >= 80) score += 15;
  else issues.push('description');

  if ((property.images?.length || 0) >= 8) score += 20;
  else if ((property.images?.length || 0) >= 4) score += 10;
  else issues.push('photos');

  if ((property.videos?.length || 0) > 0 || property.virtual_tour_url) score += 10;
  else issues.push('audiovisual');

  if (property.reference?.trim()) score += 5;
  else issues.push('reference');

  if (property.bedrooms || property.bathrooms || property.surface_area) score += 10;
  else issues.push('features');

  if (property.mandate_type && property.mandate_type !== 'sin_mandato') score += 10;
  else issues.push('mandate');

  return {
    score: Math.min(score, 100),
    issues,
  };
};

export const getAgentRecordRichness = (properties: PropertyRichnessRow[]) => {
  const active = properties.filter((property) => property.status === 'disponible');
  const scored = active.map((property) => ({
    id: property.id,
    title: property.title || 'Sin titulo',
    ...scorePropertyRichness(property),
  }));

  const rich = scored.filter((property) => property.score >= 80);
  const fragile = scored.filter((property) => property.score >= 50 && property.score < 80);
  const poor = scored.filter((property) => property.score < 50);
  const averageScore = scored.length > 0 ? Math.round(scored.reduce((sum, property) => sum + property.score, 0) / scored.length) : 0;

  const issueCounts = scored.reduce<Record<RichnessIssue, number>>(
    (acc, property) => {
      property.issues.forEach((issue) => {
        acc[issue] += 1;
      });
      return acc;
    },
    {
      base: 0,
      description: 0,
      photos: 0,
      audiovisual: 0,
      reference: 0,
      features: 0,
      mandate: 0,
    },
  );

  const topGapEntries = Object.entries(issueCounts)
    .sort(([, a], [, b]) => b - a)
    .filter(([, count]) => count > 0)
    .slice(0, 3) as Array<[RichnessIssue, number]>;

  const health =
    poor.length > 0
      ? 'poor'
      : fragile.length > 0
        ? 'fragile'
        : 'rich';

  const label =
    health === 'rich'
      ? 'Dashboard rico'
      : health === 'fragile'
        ? 'Dashboard incompleto'
        : 'Dashboard pobre';

  const detail =
    health === 'rich'
      ? 'Tus fichas tienen base comercial sólida para captar mejor, enseñar mejor y vender mejor.'
      : health === 'fragile'
        ? 'Hay producto aprovechable, pero todavía faltan piezas que mejoran captación y conversión.'
        : 'Te faltan datos, fotos o material audiovisual en varias fichas. Eso frena captación y ventas.';

  const action =
    health === 'rich'
      ? 'Mantén el estándar: producto bien presentado, mejor confianza del propietario y mejor conversión con comprador.'
      : health === 'fragile'
        ? 'Completa primero fotos, descripción y material audiovisual. Es lo que más rápido mejora captación y visitas útiles.'
        : 'Tu prioridad no es administrativa: si la ficha sale pobre, captarás peor y venderás peor. Sube material y completa datos clave.';

  const topPoor = poor.slice(0, 3).map((property) => ({
    ...property,
    issueLabels: property.issues.slice(0, 3).map((issue) => issueLabels[issue]),
  }));

  return {
    total: active.length,
    richCount: rich.length,
    fragileCount: fragile.length,
    poorCount: poor.length,
    averageScore,
    health,
    label,
    detail,
    action,
    topGaps: topGapEntries.map(([issue, count]) => ({
      issue,
      label: issueLabels[issue],
      count,
    })),
    topPoor,
  };
};

export type AgentRecordRichnessSummary = ReturnType<typeof getAgentRecordRichness>;
