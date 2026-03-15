export const PIPELINE_BUCKET_KEYS = ['nuevo', 'en_seguimiento', 'activo', 'en_cierre', 'cerrado'] as const;

export type PipelineBucketKey = (typeof PIPELINE_BUCKET_KEYS)[number];

const PIPELINE_STAGE_TO_BUCKET: Record<string, PipelineBucketKey> = {
  nuevo: 'nuevo',
  prospecto: 'nuevo',

  contactado: 'en_seguimiento',
  en_seguimiento: 'en_seguimiento',
  cualificado: 'en_seguimiento',
  activo: 'en_seguimiento',

  visita: 'activo',
  visita_programada: 'activo',
  visita_tasacion: 'activo',
  visitando: 'activo',
  negociando: 'activo',
  oferta: 'activo',

  captado: 'en_cierre',
  en_venta: 'en_cierre',
  reserva: 'en_cierre',
  arras: 'en_cierre',
  escritura: 'en_cierre',
  en_cierre: 'en_cierre',

  completado: 'cerrado',
  vendido: 'cerrado',
  cerrado: 'cerrado',
  sin_interes: 'cerrado',
};

export function getPipelineBucket(stage: string | null | undefined): PipelineBucketKey {
  if (!stage) {
    return 'nuevo';
  }

  return PIPELINE_STAGE_TO_BUCKET[stage] ?? 'en_seguimiento';
}

export function createEmptyPipelineBuckets(): Record<PipelineBucketKey, number> {
  return {
    nuevo: 0,
    en_seguimiento: 0,
    activo: 0,
    en_cierre: 0,
    cerrado: 0,
  };
}

export function aggregatePipelineBuckets(
  contacts: Array<{ pipeline_stage?: string | null }>
): Record<PipelineBucketKey, number> {
  const buckets = createEmptyPipelineBuckets();

  contacts.forEach((contact) => {
    const bucket = getPipelineBucket(contact.pipeline_stage);
    buckets[bucket] += 1;
  });

  return buckets;
}
