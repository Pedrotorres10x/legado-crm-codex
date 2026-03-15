export type ParsedAiSummary = {
  summary: string;
  hasIssues: boolean;
  inconsistencyCount: number;
  pendingOwnersCount: number;
  pendingOwners: string[];
  autofillCount: number;
  legalHighlights: string[];
  legalWarnings: string[];
  catastroCrossCheck: string[];
  dniCrmCrossCheck: string[];
  isValidated: boolean;
};

export type LegalTrafficLight = {
  level: 'alto' | 'medio' | 'bajo' | 'sin_datos';
  label: string;
  description: string;
  affectedDocs: number;
};

const getSectionLines = (lines: string[], header: string) => {
  const start = lines.findIndex((line) => line.startsWith(header));
  if (start < 0) return [];

  const items: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('[IA] ')) break;
    if (line.startsWith('- ')) items.push(line.replace(/^- /, '').trim());
  }

  return items;
};

export const parseAiSummaryFromNotes = (notes?: string | null): ParsedAiSummary | null => {
  if (!notes?.includes('[IA]')) return null;

  const lines = notes.split('\n');
  const summaryLine = lines.find((line) => line.startsWith('[IA] Resumen:'));
  const inconsistencyHeaderIndex = lines.findIndex((line) => line.startsWith('[IA] Inconsistencias detectadas:'));
  const autofillHeaderIndex = lines.findIndex((line) => line.startsWith('[IA] Campos autofill aplicados en ficha:'));
  const ownerHeaderIndex = lines.findIndex((line) => line.startsWith('[IA] Titulares cruzados con CRM:'));
  const inconsistencyCount = inconsistencyHeaderIndex >= 0
    ? lines.slice(inconsistencyHeaderIndex + 1).filter((line) => line.startsWith('- ')).length
    : 0;
  const autofillCount = autofillHeaderIndex >= 0
    ? lines.slice(autofillHeaderIndex + 1).filter((line) => line.startsWith('- ')).length
    : 0;
  const pendingOwnersCount = ownerHeaderIndex >= 0
    ? lines.slice(ownerHeaderIndex + 1).filter((line) => line.startsWith('- Falta alta en CRM:')).length
    : 0;
  const pendingOwners = ownerHeaderIndex >= 0
    ? lines
        .slice(ownerHeaderIndex + 1)
        .filter((line) => line.startsWith('- Falta alta en CRM:'))
        .map((line) => line.replace('- Falta alta en CRM:', '').trim())
    : [];
  const legalLines = getSectionLines(lines, '[IA] Informe legal:');
  const catastroCrossCheck = getSectionLines(lines, '[IA] Cruce con catastro:');
  const dniCrmCrossCheck = getSectionLines(lines, '[IA] Cruce con DNI/CRM:');

  return {
    summary: summaryLine?.replace('[IA] Resumen:', '').trim() || 'Documento analizado con IA.',
    hasIssues: inconsistencyHeaderIndex >= 0,
    inconsistencyCount,
    pendingOwnersCount,
    pendingOwners,
    autofillCount,
    legalHighlights: legalLines
      .filter((line) => line.startsWith('Particularidad:'))
      .map((line) => line.replace('Particularidad:', '').trim()),
    legalWarnings: legalLines
      .filter((line) => line.startsWith('Warning:'))
      .map((line) => line.replace('Warning:', '').trim()),
    catastroCrossCheck,
    dniCrmCrossCheck,
    isValidated: inconsistencyHeaderIndex < 0 && pendingOwnersCount === 0,
  };
};

export const buildLegalTrafficLight = (
  docs: Array<{ label: string; notes?: string | null }>,
): LegalTrafficLight => {
  const analyzedDocs = docs
    .map((doc) => ({ doc, ai: parseAiSummaryFromNotes(doc.notes) }))
    .filter((item) => item.ai);

  if (analyzedDocs.length === 0) {
    return {
      level: 'sin_datos',
      label: 'Sin análisis',
      description: 'Todavía no hay documentos jurídicos analizados con IA en este inmueble.',
      affectedDocs: 0,
    };
  }

  const highRiskTerms = [
    'vpo',
    'proteccion publica',
    'usufructo',
    'nuda propiedad',
    'embargo',
    'hipoteca',
    'condicion resolutoria',
    'opcion de compra',
    'tanteo',
    'retracto',
  ];

  const highRiskDocs = analyzedDocs.filter(({ ai }) => {
    const warningText = [
      ...(ai?.legalWarnings || []),
      ...(ai?.catastroCrossCheck || []),
      ...(ai?.dniCrmCrossCheck || []),
    ].join(' ').toLowerCase();

    return (
      (ai?.pendingOwnersCount || 0) > 0 ||
      (ai?.inconsistencyCount || 0) >= 3 ||
      highRiskTerms.some((term) => warningText.includes(term))
    );
  });

  if (highRiskDocs.length > 0) {
    const topDoc = highRiskDocs[0];
    return {
      level: 'alto',
      label: 'Riesgo alto',
      description: `${topDoc.doc.label}: ${topDoc.ai?.legalWarnings[0] || topDoc.ai?.dniCrmCrossCheck[0] || topDoc.ai?.catastroCrossCheck[0] || 'hay alertas jurídicas relevantes que conviene revisar.'}`,
      affectedDocs: highRiskDocs.length,
    };
  }

  const mediumRiskDocs = analyzedDocs.filter(({ ai }) =>
    (ai?.hasIssues || false) ||
    (ai?.legalWarnings.length || 0) > 0 ||
    (ai?.catastroCrossCheck.some((line) => line.toLowerCase().includes('no coincide')) || false) ||
    (ai?.dniCrmCrossCheck.some((line) => line.toLowerCase().includes('no existe') || line.toLowerCase().includes('no esta vinculado')) || false),
  );

  if (mediumRiskDocs.length > 0) {
    const topDoc = mediumRiskDocs[0];
    return {
      level: 'medio',
      label: 'Riesgo medio',
      description: `${topDoc.doc.label}: ${topDoc.ai?.summary || 'hay discrepancias o revisiones pendientes en el expediente.'}`,
      affectedDocs: mediumRiskDocs.length,
    };
  }

  return {
    level: 'bajo',
    label: 'Riesgo bajo',
    description: 'Los documentos analizados no muestran incidencias jurídicas relevantes por ahora.',
    affectedDocs: analyzedDocs.length,
  };
};
