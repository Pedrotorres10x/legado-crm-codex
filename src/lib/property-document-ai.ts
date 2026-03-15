import { supabase } from '@/integrations/supabase/client';
import { reconcilePropertyOwnersFromDocument } from '@/lib/document-onboarding';
import { buildLegalTrafficLight } from '@/lib/property-legal-risk';

type PropertySnapshot = {
  reference?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  zip_code?: string | null;
  surface_area?: number | null;
  built_area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floor_number?: string | null;
  property_type?: string | null;
  energy_cert?: string | null;
  description?: string | null;
};

type ExtractedDocumentData = {
  document_type?: string;
  summary?: string;
  cadastral_reference?: string;
  property_address?: string;
  property_city?: string;
  property_province?: string;
  property_zip_code?: string;
  property_type?: string;
  surface_area?: number;
  built_area?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: string;
  energy_cert?: string;
  property_description?: string;
  registro?: string;
  tomo?: string;
  libro?: string;
  folio?: string;
  finca?: string;
  titulares?: Array<{ name?: string; id_number?: string; percentage?: string }>;
  cargas?: string;
  legal_flags?: string[];
  legal_warnings?: string[];
  legal_notes?: string[];
  titularidad_tipo?: 'individual' | 'cotitularidad' | 'desconocida';
};

type DniCrmCrossCheck = {
  lines: string[];
  issues: string[];
};

const ANALYZABLE_DOC_TYPES = new Set(['catastro', 'nota_simple', 'escritura']);

const normalizeText = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const areSimilar = (left?: string | null, right?: string | null) => {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseMetricNumber = (value?: string | null) => {
  if (!value) return null;
  const normalized = value
    .replace(/m2|m²/gi, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '')
    .trim();

  return toNumber(normalized);
};

const getSectionLines = (notes: string, header: string) => {
  const lines = notes.split('\n');
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

const parseExtractedDataFromNotes = (notes?: string | null): Partial<ExtractedDocumentData> | null => {
  if (!notes?.includes('[IA] Datos extraidos:')) return null;

  const extractedLines = getSectionLines(notes, '[IA] Datos extraidos:');
  if (extractedLines.length === 0) return null;

  const extracted: Partial<ExtractedDocumentData> = {};

  extractedLines.forEach((line) => {
    if (line.startsWith('Ref. catastral:')) extracted.cadastral_reference = line.replace('Ref. catastral:', '').trim();
    if (line.startsWith('Direccion:')) extracted.property_address = line.replace('Direccion:', '').trim();
    if (line.startsWith('Ciudad:')) extracted.property_city = line.replace('Ciudad:', '').trim();
    if (line.startsWith('Provincia:')) extracted.property_province = line.replace('Provincia:', '').trim();
    if (line.startsWith('CP:')) extracted.property_zip_code = line.replace('CP:', '').trim();
    if (line.startsWith('Superficie:')) extracted.surface_area = parseMetricNumber(line.replace('Superficie:', '').trim()) || undefined;
    if (line.startsWith('Sup. construida:')) extracted.built_area = parseMetricNumber(line.replace('Sup. construida:', '').trim()) || undefined;
    if (line.startsWith('Planta:')) extracted.floor = line.replace('Planta:', '').trim();
    if (line.startsWith('Tipo:')) extracted.property_type = line.replace('Tipo:', '').trim();
    if (line.startsWith('CEE:')) extracted.energy_cert = line.replace('CEE:', '').trim();
    if (line.startsWith('Cargas:')) extracted.cargas = line.replace('Cargas:', '').trim();
  });

  return extracted;
};

const compareNumericField = ({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue?: number | null;
  rightLabel: string;
  rightValue?: number | null;
}) => {
  if (!leftValue || !rightValue) return null;

  const difference = Math.abs(leftValue - rightValue);
  const maxValue = Math.max(leftValue, rightValue);
  const allowedDifference = Math.max(5, Math.round(maxValue * 0.05));

  if (difference <= allowedDifference) {
    return {
      ok: true,
      line: `${leftLabel} coherente con ${rightLabel}: ${leftValue} m2 vs ${rightValue} m2.`,
    };
  }

  return {
    ok: false,
    line: `${leftLabel} no coincide con ${rightLabel}: ${leftValue} m2 vs ${rightValue} m2.`,
  };
};

const buildLegalAnalysis = (extracted: ExtractedDocumentData) => {
  const highlights: string[] = [];
  const warnings: string[] = [];
  const legalText = [extracted.summary, extracted.cargas, extracted.property_description]
    .filter(Boolean)
    .join(' ');
  const normalizedLegalText = normalizeText(legalText);
  const normalizedCharges = normalizeText(extracted.cargas);
  const explicitFlags = new Set(extracted.legal_flags || []);
  const percentages = (extracted.titulares || [])
    .map((holder) => toNumber(holder.percentage?.replace('%', '').replace(',', '.')))
    .filter((value): value is number => value !== null);

  if (extracted.titularidad_tipo === 'individual' || extracted.titulares?.length === 1) {
    highlights.push(`Titularidad individual detectada a nombre de ${extracted.titulares[0].name || 'titular no identificado'}.`);
  } else if (extracted.titularidad_tipo === 'cotitularidad' || (extracted.titulares?.length || 0) > 1) {
    highlights.push(`Cotitularidad detectada entre ${extracted.titulares?.map((holder) => holder.name).filter(Boolean).join(', ')}.`);
  } else {
    warnings.push('No se ha podido identificar con claridad la titularidad registral.');
  }

  if (percentages.length === extracted.titulares?.length && percentages.length > 0) {
    const total = percentages.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) <= 2) {
      highlights.push(`Las cuotas de titularidad suman aproximadamente el 100% (${total.toFixed(0)}%).`);
    } else {
      warnings.push(`Las cuotas de titularidad no suman 100% (${total.toFixed(0)}%). Conviene revisar la distribución registral.`);
    }
  } else if ((extracted.titulares?.length || 0) > 1) {
    warnings.push('Hay varios titulares, pero no se han podido leer todas las cuotas de participación.');
  }

  if (normalizedCharges) {
    if (
      normalizedCharges.includes('sincargas') ||
      normalizedCharges.includes('libredecargas') ||
      normalizedCharges.includes('noconstancargas')
    ) {
      highlights.push('La nota simple aparenta estar libre de cargas o sin afecciones relevantes legibles.');
    } else {
      warnings.push(`Revisar cargas registrales: ${extracted.cargas}`);
    }
  } else {
    warnings.push('No se ha podido leer el apartado de cargas; conviene revisión manual.');
  }

  if (
    explicitFlags.has('vpo') ||
    explicitFlags.has('proteccion_publica') ||
    normalizedLegalText.includes('vpo') ||
    normalizedLegalText.includes('viviendadeproteccionoficial') ||
    normalizedLegalText.includes('proteccionpublica') ||
    normalizedLegalText.includes('regimendeproteccion')
  ) {
    warnings.push('Posible VPO o regimen de proteccion publica: revisar limitaciones de precio, transmision y plazos de descalificacion.');
  }

  if (
    explicitFlags.has('usufructo') ||
    explicitFlags.has('nuda_propiedad') ||
    normalizedLegalText.includes('usufruct')
  ) {
    warnings.push('Se detectan menciones a usufructo o nuda propiedad; revisar quien puede disponer y firmar la venta.');
  }

  if (explicitFlags.has('embargo') || normalizedLegalText.includes('embargo')) {
    warnings.push('Se detectan menciones a embargo; revisar cancelacion o impacto en la transmision.');
  }

  if (explicitFlags.has('hipoteca') || normalizedLegalText.includes('hipoteca')) {
    warnings.push('Se detectan menciones a hipoteca; confirmar saldo, cancelacion economica y registral.');
  }

  if (explicitFlags.has('servidumbre') || normalizedLegalText.includes('servidumbr')) {
    warnings.push('Se detectan menciones a servidumbres; revisar su alcance y si afectan al uso o valor del inmueble.');
  }

  if (explicitFlags.has('tanteo_retracto') || normalizedLegalText.includes('tanteo') || normalizedLegalText.includes('retracto')) {
    warnings.push('Se detectan posibles derechos de tanteo y retracto; revisar si existe obligacion de notificacion previa.');
  }

  if (explicitFlags.has('arrendamiento') || normalizedLegalText.includes('arrend')) {
    warnings.push('Se detectan menciones a arrendamiento; revisar ocupacion, derechos del inquilino y necesidad de preaviso.');
  }

  if (explicitFlags.has('afeccion_fiscal') || normalizedLegalText.includes('afeccionfiscal')) {
    warnings.push('Se detecta afeccion fiscal; conviene revisar alcance temporal y responsabilidad del adquirente.');
  }

  if (explicitFlags.has('condicion_resolutoria') || normalizedLegalText.includes('condicionresolutoria')) {
    warnings.push('Se detecta condicion resolutoria; revisar riesgo de resolucion y cancelacion registral.');
  }

  if (explicitFlags.has('opcion_compra') || normalizedLegalText.includes('opciondecompra')) {
    warnings.push('Se detecta opcion de compra inscrita o referenciada; revisar vigencia y oponibilidad.');
  }

  if (extracted.registro || extracted.finca || extracted.tomo || extracted.libro || extracted.folio) {
    const registryBits = [
      extracted.registro ? `Registro ${extracted.registro}` : null,
      extracted.finca ? `finca ${extracted.finca}` : null,
      extracted.tomo ? `tomo ${extracted.tomo}` : null,
      extracted.libro ? `libro ${extracted.libro}` : null,
      extracted.folio ? `folio ${extracted.folio}` : null,
    ].filter(Boolean);
    highlights.push(`Identificacion registral localizada: ${registryBits.join(', ')}.`);
  } else {
    warnings.push('No se ha identificado con claridad la finca/registro en la extracción automática.');
  }

  if (!extracted.cadastral_reference) {
    warnings.push('La nota simple no muestra referencia catastral legible; conviene contrastarla con Catastro.');
  }

  (extracted.legal_notes || []).forEach((note) => highlights.push(note));
  (extracted.legal_warnings || []).forEach((warning) => warnings.push(warning));

  return {
    highlights: Array.from(new Set(highlights)),
    warnings: Array.from(new Set(warnings)),
  };
};

const buildDniCrmCrossCheck = async ({
  extracted,
  propertyId,
}: {
  extracted: ExtractedDocumentData;
  propertyId: string;
}): Promise<DniCrmCrossCheck> => {
  const holders = (extracted.titulares || []).filter((holder) => holder.name || holder.id_number);
  if (holders.length === 0) {
    return {
      lines: ['No se han identificado titulares suficientes para cruzar con DNI/CRM.'],
      issues: [],
    };
  }

  const { data: ownerRows } = await supabase
    .from('property_owners')
    .select('contact_id')
    .eq('property_id', propertyId);

  const ownerContactIds = Array.from(new Set((ownerRows || []).map((row) => row.contact_id).filter(Boolean)));

  const { data: linkedContacts } = ownerContactIds.length > 0
    ? await supabase
        .from('contacts')
        .select('id, full_name, id_number')
        .in('id', ownerContactIds)
    : { data: [] as Array<{ id: string; full_name: string | null; id_number: string | null }> };

  const contactsByDocumentId = await Promise.all(
    holders
      .filter((holder) => holder.id_number)
      .map(async (holder) => {
        const { data } = await supabase
          .from('contacts')
          .select('id, full_name, id_number')
          .ilike('id_number', `%${holder.id_number}%`)
          .limit(5);
        return data || [];
      }),
  );

  const crmContactsById = contactsByDocumentId.flat();

  const lines: string[] = [];
  const issues: string[] = [];

  holders.forEach((holder) => {
    const normalizedHolderId = normalizeText(holder.id_number);
    const normalizedHolderName = normalizeText(holder.name);
    const linkedOwner = (linkedContacts || []).find((contact) =>
      (normalizedHolderId && normalizeText(contact.id_number) === normalizedHolderId) ||
      (normalizedHolderName && normalizeText(contact.full_name) === normalizedHolderName),
    );

    const crmIdMatch = normalizedHolderId
      ? (crmContactsById || []).find((contact) => normalizeText(contact.id_number) === normalizedHolderId)
      : null;

    if (normalizedHolderId && crmIdMatch) {
      lines.push(`DNI/NIF ${holder.id_number} localizado en CRM: ${crmIdMatch.full_name || 'contacto sin nombre'}.`);
    } else if (normalizedHolderId) {
      const issue = `El DNI/NIF ${holder.id_number} del titular ${holder.name || ''} no existe todavia en CRM.`;
      lines.push(issue);
      issues.push(issue);
    }

    if (linkedOwner) {
      if (normalizedHolderId && linkedOwner.id_number && normalizeText(linkedOwner.id_number) !== normalizedHolderId) {
        const issue = `El titular ${holder.name || holder.id_number} esta vinculado al inmueble, pero su DNI en CRM (${linkedOwner.id_number}) no coincide con el documento (${holder.id_number}).`;
        lines.push(issue);
        issues.push(issue);
      } else {
        lines.push(`Titular ${holder.name || holder.id_number} coherente con propietario vinculado en CRM.`);
      }
    } else {
      const issue = `El titular ${holder.name || holder.id_number} no esta vinculado todavia como propietario del inmueble en CRM.`;
      lines.push(issue);
      issues.push(issue);
    }
  });

  if (lines.length === 0) {
    lines.push('No se han encontrado coincidencias suficientes para el cruce con DNI/CRM.');
  }

  return { lines, issues };
};

const buildCatastroCrossCheck = ({
  extracted,
  catastroExtracted,
}: {
  extracted: ExtractedDocumentData;
  catastroExtracted?: Partial<ExtractedDocumentData> | null;
}) => {
  if (!catastroExtracted) {
    return {
      lines: ['No hay documento de catastro analizado en el expediente para hacer el contraste automatico.'],
      issues: [],
    };
  }

  const lines: string[] = [];
  const issues: string[] = [];

  if (extracted.cadastral_reference && catastroExtracted.cadastral_reference) {
    if (normalizeText(extracted.cadastral_reference) === normalizeText(catastroExtracted.cadastral_reference)) {
      lines.push(`Referencia catastral coherente: ${extracted.cadastral_reference}.`);
    } else {
      const issue = `La referencia catastral registral (${extracted.cadastral_reference}) no coincide con la del documento catastral (${catastroExtracted.cadastral_reference}).`;
      lines.push(issue);
      issues.push(issue);
    }
  }

  if (extracted.property_address && catastroExtracted.property_address) {
    if (areSimilar(extracted.property_address, catastroExtracted.property_address)) {
      lines.push('La direccion registral es coherente con la direccion del catastro.');
    } else {
      const issue = `La direccion registral (${extracted.property_address}) no coincide con la catastral (${catastroExtracted.property_address}).`;
      lines.push(issue);
      issues.push(issue);
    }
  }

  const surfaceComparison = compareNumericField({
    leftLabel: 'La superficie registral',
    leftValue: toNumber(extracted.surface_area),
    rightLabel: 'la catastral',
    rightValue: toNumber(catastroExtracted.surface_area),
  });
  if (surfaceComparison) {
    lines.push(surfaceComparison.line);
    if (!surfaceComparison.ok) issues.push(surfaceComparison.line);
  }

  const builtAreaComparison = compareNumericField({
    leftLabel: 'La superficie construida registral',
    leftValue: toNumber(extracted.built_area),
    rightLabel: 'la catastral',
    rightValue: toNumber(catastroExtracted.built_area),
  });
  if (builtAreaComparison) {
    lines.push(builtAreaComparison.line);
    if (!builtAreaComparison.ok) issues.push(builtAreaComparison.line);
  }

  if (extracted.property_type && catastroExtracted.property_type) {
    if (areSimilar(extracted.property_type, catastroExtracted.property_type)) {
      lines.push(`Tipologia coherente entre Registro y Catastro: ${extracted.property_type}.`);
    } else {
      const issue = `La tipologia registral (${extracted.property_type}) no coincide con la catastral (${catastroExtracted.property_type}).`;
      lines.push(issue);
      issues.push(issue);
    }
  }

  if (lines.length === 0) {
    lines.push('No se han encontrado suficientes datos legibles para cruzar la nota simple con el catastro.');
  }

  return { lines, issues };
};

const linesFromExtracted = (extracted: ExtractedDocumentData) => {
  const lines: string[] = [];

  if (extracted.cadastral_reference) lines.push(`Ref. catastral: ${extracted.cadastral_reference}`);
  if (extracted.property_address) lines.push(`Direccion: ${extracted.property_address}`);
  if (extracted.property_city) lines.push(`Ciudad: ${extracted.property_city}`);
  if (extracted.property_province) lines.push(`Provincia: ${extracted.property_province}`);
  if (extracted.property_zip_code) lines.push(`CP: ${extracted.property_zip_code}`);
  if (toNumber(extracted.surface_area)) lines.push(`Superficie: ${toNumber(extracted.surface_area)} m2`);
  if (toNumber(extracted.built_area)) lines.push(`Sup. construida: ${toNumber(extracted.built_area)} m2`);
  if (toNumber(extracted.bedrooms)) lines.push(`Dormitorios: ${toNumber(extracted.bedrooms)}`);
  if (toNumber(extracted.bathrooms)) lines.push(`Banos: ${toNumber(extracted.bathrooms)}`);
  if (extracted.floor) lines.push(`Planta: ${extracted.floor}`);
  if (extracted.property_type) lines.push(`Tipo: ${extracted.property_type}`);
  if (extracted.energy_cert) lines.push(`CEE: ${extracted.energy_cert}`);
  if (extracted.titulares?.length) {
    lines.push(`Titulares: ${extracted.titulares.map((holder) => holder.name).filter(Boolean).join(', ')}`);
  }
  if (extracted.cargas) lines.push(`Cargas: ${extracted.cargas}`);
  if (extracted.legal_flags?.length) lines.push(`Flags legales: ${extracted.legal_flags.join(', ')}`);
  if (extracted.registro) lines.push(`Registro: ${extracted.registro}`);
  if (extracted.finca) lines.push(`Finca: ${extracted.finca}`);
  if (extracted.tomo) lines.push(`Tomo: ${extracted.tomo}`);
  if (extracted.libro) lines.push(`Libro: ${extracted.libro}`);
  if (extracted.folio) lines.push(`Folio: ${extracted.folio}`);

  return lines;
};

export const isAiAnalyzablePropertyDocument = (docType: string) => ANALYZABLE_DOC_TYPES.has(docType);

export const analyzePropertyDocumentUpload = async ({
  fileUrl,
  fileName,
  docType,
  property,
  propertyId,
}: {
  fileUrl: string;
  fileName: string;
  docType: string;
  property: PropertySnapshot;
  propertyId: string;
}) => {
  if (!isAiAnalyzablePropertyDocument(docType)) {
    return null;
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-document-extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ image_url: fileUrl, file_name: fileName }),
  });

  const payload = await response.json();
  if (!response.ok || payload.error || !payload.extracted) {
    throw new Error(payload.error || 'No se pudo analizar el documento con IA');
  }

  const extracted = payload.extracted as ExtractedDocumentData;
  const inconsistencies: string[] = [];
  const suggestedUpdates: Record<string, string | number> = {};
  let legalAnalysis: ReturnType<typeof buildLegalAnalysis> | null = null;
  let catastroCrossCheck: ReturnType<typeof buildCatastroCrossCheck> | null = null;
  let dniCrmCrossCheck: DniCrmCrossCheck | null = null;

  if (extracted.cadastral_reference) {
    if (property.reference && normalizeText(property.reference) !== normalizeText(extracted.cadastral_reference)) {
      inconsistencies.push(`La referencia catastral del documento (${extracted.cadastral_reference}) no coincide con la ficha (${property.reference}).`);
    } else if (!property.reference) {
      suggestedUpdates.reference = extracted.cadastral_reference;
    }
  }

  if (extracted.property_address) {
    if (property.address && !areSimilar(property.address, extracted.property_address)) {
      inconsistencies.push(`La direccion del documento (${extracted.property_address}) no coincide con la ficha (${property.address}).`);
    } else if (!property.address) {
      suggestedUpdates.address = extracted.property_address;
    }
  }

  if (extracted.property_city) {
    if (property.city && !areSimilar(property.city, extracted.property_city)) {
      inconsistencies.push(`La ciudad del documento (${extracted.property_city}) no coincide con la ficha (${property.city}).`);
    } else if (!property.city) {
      suggestedUpdates.city = extracted.property_city;
    }
  }

  if (extracted.property_province) {
    if (property.province && !areSimilar(property.province, extracted.property_province)) {
      inconsistencies.push(`La provincia del documento (${extracted.property_province}) no coincide con la ficha (${property.province}).`);
    } else if (!property.province) {
      suggestedUpdates.province = extracted.property_province;
    }
  }

  if (extracted.property_zip_code) {
    if (property.zip_code && normalizeText(property.zip_code) !== normalizeText(extracted.property_zip_code)) {
      inconsistencies.push(`El codigo postal del documento (${extracted.property_zip_code}) no coincide con la ficha (${property.zip_code}).`);
    } else if (!property.zip_code) {
      suggestedUpdates.zip_code = extracted.property_zip_code;
    }
  }

  const extractedSurface = toNumber(extracted.surface_area);
  if (extractedSurface) {
    const currentSurface = toNumber(property.surface_area);
    if (currentSurface && Math.abs(currentSurface - extractedSurface) > 5) {
      inconsistencies.push(`La superficie del documento (${extractedSurface} m2) no coincide con la ficha (${currentSurface} m2).`);
    } else if (!currentSurface) {
      suggestedUpdates.surface_area = extractedSurface;
    }
  }

  const extractedBuiltArea = toNumber(extracted.built_area);
  if (extractedBuiltArea && !toNumber(property.built_area)) suggestedUpdates.built_area = extractedBuiltArea;
  if (toNumber(extracted.bedrooms) && !toNumber(property.bedrooms)) suggestedUpdates.bedrooms = toNumber(extracted.bedrooms)!;
  if (toNumber(extracted.bathrooms) && !toNumber(property.bathrooms)) suggestedUpdates.bathrooms = toNumber(extracted.bathrooms)!;
  if (extracted.floor && !property.floor_number) suggestedUpdates.floor_number = extracted.floor;
  if (extracted.property_type && !property.property_type) suggestedUpdates.property_type = extracted.property_type;
  if (extracted.energy_cert && !property.energy_cert) suggestedUpdates.energy_cert = extracted.energy_cert;
  if (extracted.property_description && !property.description) suggestedUpdates.description = extracted.property_description;

  const noteLines: string[] = [];
  noteLines.push(`[IA] Resumen: ${extracted.summary || 'Documento analizado correctamente.'}`);

  const extractedLines = linesFromExtracted(extracted);
  if (extractedLines.length > 0) {
    noteLines.push('[IA] Datos extraidos:');
    extractedLines.forEach((line) => noteLines.push(`- ${line}`));
  }

  let ownerReconciliation = null;
  if ((docType === 'nota_simple' || docType === 'escritura') && extracted.titulares?.length) {
    ownerReconciliation = await reconcilePropertyOwnersFromDocument({
      propertyId,
      titulares: extracted.titulares,
    });

    noteLines.push('[IA] Titulares cruzados con CRM:');
    if (ownerReconciliation.matched.length > 0) {
      ownerReconciliation.matched.forEach((holder) => noteLines.push(`- Vinculado: ${holder.label}`));
    }
    if (ownerReconciliation.missing.length > 0) {
      ownerReconciliation.missing.forEach((holder) => noteLines.push(`- Falta alta en CRM: ${holder}`));
      inconsistencies.push(...ownerReconciliation.missing.map((holder) => `Falta dar de alta al titular "${holder}" en CRM.`));
    }
  }

  if (docType === 'nota_simple' || docType === 'escritura') {
    legalAnalysis = buildLegalAnalysis(extracted);
    noteLines.push('[IA] Informe legal:');
    legalAnalysis.highlights.forEach((line) => noteLines.push(`- Particularidad: ${line}`));
    legalAnalysis.warnings.forEach((line) => noteLines.push(`- Warning: ${line}`));
    inconsistencies.push(...legalAnalysis.warnings);

    dniCrmCrossCheck = await buildDniCrmCrossCheck({
      extracted,
      propertyId,
    });

    noteLines.push('[IA] Cruce con DNI/CRM:');
    dniCrmCrossCheck.lines.forEach((line) => noteLines.push(`- ${line}`));
    inconsistencies.push(...dniCrmCrossCheck.issues);
  }

  if (docType === 'nota_simple' || docType === 'escritura') {
    const { data: catastroDoc } = await supabase
      .from('property_documents')
      .select('notes')
      .eq('property_id', propertyId)
      .eq('doc_type', 'catastro')
      .not('notes', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    catastroCrossCheck = buildCatastroCrossCheck({
      extracted,
      catastroExtracted: parseExtractedDataFromNotes(catastroDoc?.notes),
    });

    noteLines.push('[IA] Cruce con catastro:');
    catastroCrossCheck.lines.forEach((line) => noteLines.push(`- ${line}`));
    inconsistencies.push(...catastroCrossCheck.issues);
  }

  if (Object.keys(suggestedUpdates).length > 0) {
    noteLines.push('[IA] Campos autofill aplicados en ficha:');
    Object.entries(suggestedUpdates).forEach(([key, value]) => noteLines.push(`- ${key}: ${value}`));
  }

  if (inconsistencies.length > 0) {
    noteLines.push('[IA] Inconsistencias detectadas:');
    Array.from(new Set(inconsistencies)).forEach((issue) => noteLines.push(`- ${issue}`));
  }

  return {
    extracted,
    suggestedUpdates,
    inconsistencies: Array.from(new Set(inconsistencies)),
    ownerReconciliation,
    legalAnalysis,
    catastroCrossCheck,
    dniCrmCrossCheck,
    notes: noteLines.join('\n'),
  };
};

export const applySafePropertyUpdates = async (propertyId: string, updates: Record<string, string | number>) => {
  if (Object.keys(updates).length === 0) return;
  await supabase.from('properties').update(updates).eq('id', propertyId);
};

export const reanalyzePropertyLegalDocuments = async (propertyId: string) => {
  const { data: property } = await supabase
    .from('properties')
    .select('reference, address, city, province, zip_code, surface_area, built_area, bedrooms, bathrooms, floor_number, property_type, energy_cert, description')
    .eq('id', propertyId)
    .single();

  if (!property) {
    throw new Error('No se ha podido cargar la ficha del inmueble.');
  }

  const { data: docs } = await supabase
    .from('property_documents')
    .select('id, label, doc_type, file_url, file_name, notes')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: true });

  const analyzableDocs = (docs || []).filter((doc) => doc.file_url && isAiAnalyzablePropertyDocument(doc.doc_type));

  for (const doc of analyzableDocs) {
    const analysis = await analyzePropertyDocumentUpload({
      fileUrl: doc.file_url as string,
      fileName: doc.file_name || doc.label || doc.doc_type,
      docType: doc.doc_type,
      property,
      propertyId,
    });

    if (analysis) {
      await supabase
        .from('property_documents')
        .update({ notes: analysis.notes })
        .eq('id', doc.id);

      await applySafePropertyUpdates(propertyId, analysis.suggestedUpdates);
    }
  }

  const { data: refreshedDocs } = await supabase
    .from('property_documents')
    .select('label, notes')
    .eq('property_id', propertyId);

  const legalTrafficLight = buildLegalTrafficLight(
    (refreshedDocs || []).map((doc) => ({
      label: doc.label,
      notes: doc.notes,
    })),
  );

  await supabase
    .from('properties')
    .update({
      legal_risk_level: legalTrafficLight.level,
      legal_risk_summary: legalTrafficLight.description,
      legal_risk_docs_count: legalTrafficLight.affectedDocs,
      legal_risk_updated_at: new Date().toISOString(),
    })
    .eq('id', propertyId);

  return {
    analyzableCount: analyzableDocs.length,
    legalTrafficLight,
  };
};
