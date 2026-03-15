export type ClosingStepKey = 'reserva' | 'arras' | 'escritura';

export const CLOSING_DOC_LABELS: Record<string, string> = {
  nota_simple: 'Nota simple',
  catastro: 'Catastro',
  escritura: 'Escritura',
  mandato: 'Mandato',
  comunidad: 'Certificado de comunidad',
  ibi: 'IBI',
  cee: 'CEE',
};

export const CLOSING_REQUIRED_DOCS: Record<ClosingStepKey, string[]> = {
  reserva: ['mandato', 'nota_simple', 'catastro'],
  arras: ['mandato', 'nota_simple', 'catastro', 'escritura'],
  escritura: ['mandato', 'nota_simple', 'catastro', 'escritura', 'comunidad', 'ibi', 'cee'],
};

export const getClosingActiveStep = (property: {
  status?: string | null;
  arras_status?: string | null;
  reservation_date?: string | null;
}): ClosingStepKey => {
  if (property.status === 'vendido' || property.status === 'alquilado') return 'escritura';
  if (property.arras_status === 'firmado') return 'escritura';
  if (property.arras_status === 'pendiente') return 'arras';
  if (property.reservation_date) return 'arras';
  return 'reserva';
};

export const isClosingStepComplete = (
  step: ClosingStepKey,
  property: {
    reservation_date?: string | null;
    arras_status?: string | null;
    status?: string | null;
  },
) => {
  if (step === 'reserva') return !!property.reservation_date;
  if (step === 'arras') return property.arras_status === 'firmado';
  if (step === 'escritura') return property.status === 'vendido' || property.status === 'alquilado';
  return false;
};

export const buildClosingOperationalBlockers = ({
  property,
  propertyOwnerCount,
  uploadedDocTypes,
  pendingSignatureCount,
}: {
  property: {
    legal_risk_level?: string | null;
    arras_buyer_id?: string | null;
    arras_amount?: number | null;
    arras_date?: string | null;
    deed_date?: string | null;
    deed_notary?: string | null;
    status?: string | null;
    arras_status?: string | null;
    reservation_date?: string | null;
  };
  propertyOwnerCount: number;
  uploadedDocTypes: string[];
  pendingSignatureCount: number;
}) => {
  const activeStep = getClosingActiveStep(property);
  const requiredDocs = CLOSING_REQUIRED_DOCS[activeStep];
  const missingRequiredDocs = requiredDocs.filter((docType) => !uploadedDocTypes.includes(docType));
  const blockers: string[] = [];

  if (propertyOwnerCount === 0) blockers.push('Falta vincular al menos un propietario.');
  if (property.legal_risk_level === 'alto') blockers.push('El semaforo legal del inmueble esta en riesgo alto.');
  if (missingRequiredDocs.length > 0) {
    blockers.push(`Faltan documentos clave: ${missingRequiredDocs.map((doc) => CLOSING_DOC_LABELS[doc] || doc).join(', ')}.`);
  }

  if (activeStep === 'arras') {
    if (!property.arras_buyer_id) blockers.push('Falta asignar comprador para arras.');
    if (!property.arras_amount) blockers.push('Falta definir importe de arras.');
    if (!property.arras_date) blockers.push('Falta fijar fecha de firma de arras.');
  }

  if (activeStep === 'escritura') {
    if (!property.arras_buyer_id) blockers.push('Falta comprador vinculado para cierre.');
    if (!property.deed_date) blockers.push('Falta programar la fecha de escritura.');
    if (!property.deed_notary?.trim()) blockers.push('Falta indicar la notaria.');
    if (pendingSignatureCount > 0) blockers.push(`Hay ${pendingSignatureCount} firma(s) digital(es) pendiente(s).`);
  }

  return {
    activeStep,
    requiredDocs,
    missingRequiredDocs,
    blockers,
  };
};
