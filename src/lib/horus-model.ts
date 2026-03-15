export type HorusWeights = {
  whatsapp: number;
  email: number;
  llamada: number;
  cafe_comida: number;
  reunion: number;
  visita_tasacion: number;
  visita_comprador_sin_resultado: number;
  visita_comprador_con_resultado: number;
  captacion: number;
  facturacion: number;
  quarterly_target: number;
  monthly_bonus_target: number;
};

export type HorusActivityGroup = {
  key:
    | 'whatsapp'
    | 'email'
    | 'llamada'
    | 'cafe_comida'
    | 'reunion'
    | 'visita_tasacion'
    | 'visita_comprador_sin_resultado'
    | 'visita_comprador_con_resultado'
    | 'captacion'
    | 'facturacion';
  label: string;
  description: string;
  activities?: string[];
};

export const DEFAULT_HORUS_WEIGHTS: HorusWeights = {
  whatsapp: 1,
  email: 2,
  llamada: 3,
  cafe_comida: 5,
  reunion: 8,
  visita_tasacion: 8,
  visita_comprador_sin_resultado: 2,
  visita_comprador_con_resultado: 6,
  captacion: 70,
  facturacion: 100,
  quarterly_target: 500,
  monthly_bonus_target: 500,
};

export const HORUS_ACTIVITY_GROUPS: HorusActivityGroup[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Toque digital corto',
  },
  {
    key: 'email',
    label: 'Email',
    description: 'Toque digital',
  },
  {
    key: 'llamada',
    label: 'Llamada',
    description: 'Toque telefonico',
  },
  {
    key: 'cafe_comida',
    label: 'Reunion cafe',
    description: 'Cafe o similar',
  },
  {
    key: 'reunion',
    label: 'Reunion comida',
    description: 'Comida o reunion de mas peso',
  },
  {
    key: 'visita_tasacion',
    label: 'Visita de captacion',
    description: 'Visita de captacion / tasacion, equivalente a comida',
  },
  {
    key: 'visita_comprador_sin_resultado',
    label: 'Visita comprador sin resultado',
    description: 'Visita comercial realizada pero sin oferta posterior',
  },
  {
    key: 'visita_comprador_con_resultado',
    label: 'Visita comprador con resultado',
    description: 'Visita que termina derivando en oferta sobre el mismo inmueble',
  },
  {
    key: 'captacion',
    label: 'Captacion',
    description: 'Captacion / mandato',
  },
  {
    key: 'facturacion',
    label: 'Arras firmadas',
    description: 'Facturacion comercial real',
  },
];

export function normalizeHorusWeights(raw: any): HorusWeights {
  return {
    whatsapp: Number(raw?.whatsapp ?? raw?.toque ?? DEFAULT_HORUS_WEIGHTS.whatsapp),
    email: Number(raw?.email ?? raw?.toque ?? DEFAULT_HORUS_WEIGHTS.email),
    llamada: Number(raw?.llamada ?? raw?.toque ?? DEFAULT_HORUS_WEIGHTS.llamada),
    cafe_comida: Number(raw?.cafe_comida ?? raw?.toque ?? DEFAULT_HORUS_WEIGHTS.cafe_comida),
    reunion: Number(raw?.reunion ?? raw?.toque ?? DEFAULT_HORUS_WEIGHTS.reunion),
    visita_tasacion: Number(raw?.visita_tasacion ?? raw?.reunion ?? raw?.toque ?? DEFAULT_HORUS_WEIGHTS.visita_tasacion),
    visita_comprador_sin_resultado: Number(
      raw?.visita_comprador_sin_resultado ??
      raw?.visita_sin_resultado ??
      raw?.visita ??
      raw?.entrevista ??
      DEFAULT_HORUS_WEIGHTS.visita_comprador_sin_resultado
    ),
    visita_comprador_con_resultado: Number(
      raw?.visita_comprador_con_resultado ??
      raw?.visita_con_resultado ??
      raw?.visita_resultado ??
      raw?.visita ??
      raw?.entrevista ??
      DEFAULT_HORUS_WEIGHTS.visita_comprador_con_resultado
    ),
    captacion: Number(raw?.captacion ?? DEFAULT_HORUS_WEIGHTS.captacion),
    facturacion: Number(raw?.facturacion ?? raw?.venta ?? DEFAULT_HORUS_WEIGHTS.facturacion),
    quarterly_target: Number(raw?.quarterly_target ?? DEFAULT_HORUS_WEIGHTS.quarterly_target),
    monthly_bonus_target: Number(
      raw?.monthly_bonus_target ??
      raw?.horus_bonus_target ??
      raw?.quarterly_target ??
      DEFAULT_HORUS_WEIGHTS.monthly_bonus_target
    ),
  };
}

export function getHorusPointsRows(weights: HorusWeights) {
  return HORUS_ACTIVITY_GROUPS.map((group) => ({
    ...group,
    points: weights[group.key],
  }));
}

export const HORUS_TOUCH_TYPES = ['whatsapp', 'email', 'llamada', 'cafe_comida', 'reunion', 'visita_tasacion'] as const;
export const HORUS_INTERVIEW_TYPES = ['visita'] as const;

export type HorusInteractionLike = {
  id?: string;
  interaction_type: string;
  interaction_date?: string;
  contact_id?: string | null;
  property_id?: string | null;
};

export function getInteractionPoints(type: string, weights: HorusWeights) {
  switch (type) {
    case 'whatsapp':
      return weights.whatsapp;
    case 'email':
      return weights.email;
    case 'llamada':
      return weights.llamada;
    case 'cafe_comida':
      return weights.cafe_comida;
    case 'reunion':
      return weights.reunion;
    case 'visita_tasacion':
      return weights.visita_tasacion;
    default:
      return 0;
  }
}

export type HorusVisitLike = {
  id: string;
  contact_id?: string | null;
  property_id?: string | null;
  visit_date: string;
  result?: string | null;
  confirmation_status?: string | null;
};

export type HorusOfferLike = {
  contact_id?: string | null;
  property_id?: string | null;
  created_at: string;
};

export const VISIT_RESULT_OPTIONS = [
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'segunda_visita', label: 'Segunda visita' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'reserva', label: 'Reserva' },
  { value: 'sin_interes', label: 'Sin interés' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'no_show', label: 'No show' },
] as const;

const NEGATIVE_VISIT_RESULTS = new Set(['cancelada', 'cancelado', 'no_show', 'sin_interes', 'sin_interés', 'descartada', 'descartado']);
const POSITIVE_VISIT_RESULTS = new Set(['oferta', 'reserva', 'arras', 'compra', 'comprado']);
const MID_VISIT_RESULTS = new Set(['segunda_visita', 'seguimiento', 'realizada', 'interesado', 'interesada']);

function normalizeVisitResult(result?: string | null) {
  return (result || '').trim().toLowerCase();
}

export function isEligibleBuyerVisit(visit: HorusVisitLike, now = new Date()) {
  if (!visit.visit_date) return false;

  const visitDate = new Date(visit.visit_date);
  if (Number.isNaN(visitDate.getTime()) || visitDate > now) return false;

  if (visit.confirmation_status === 'cancelado') return false;

  const normalizedResult = normalizeVisitResult(visit.result);
  if (NEGATIVE_VISIT_RESULTS.has(normalizedResult)) return false;

  return true;
}

export function visitHasCommercialResult(visit: HorusVisitLike, offers: HorusOfferLike[]) {
  const normalizedResult = normalizeVisitResult(visit.result);
  if (POSITIVE_VISIT_RESULTS.has(normalizedResult)) {
    return true;
  }
  if (MID_VISIT_RESULTS.has(normalizedResult)) {
    return false;
  }

  const visitTime = new Date(visit.visit_date).getTime();
  return offers.some((offer) => {
    if (!offer.contact_id || !offer.property_id) return false;
    if (offer.contact_id !== visit.contact_id || offer.property_id !== visit.property_id) return false;

    const offerTime = new Date(offer.created_at).getTime();
    return !Number.isNaN(offerTime) && offerTime >= visitTime;
  });
}

export function getBuyerVisitPoints(visit: HorusVisitLike, offers: HorusOfferLike[], weights: HorusWeights, now = new Date()) {
  if (!isEligibleBuyerVisit(visit, now)) return 0;

  return visitHasCommercialResult(visit, offers)
    ? weights.visita_comprador_con_resultado
    : weights.visita_comprador_sin_resultado;
}

export function countBuyerInterviews(visits: HorusVisitLike[], now = new Date()) {
  return visits.filter((visit) => isEligibleBuyerVisit(visit, now)).length;
}

export function sumBuyerVisitPoints(visits: HorusVisitLike[], offers: HorusOfferLike[], weights: HorusWeights, now = new Date()) {
  return visits.reduce((total, visit) => total + getBuyerVisitPoints(visit, offers, weights, now), 0);
}

export function getHorusOpportunityKey(interaction: HorusInteractionLike) {
  if (interaction.property_id) return `property:${interaction.property_id}`;
  if (interaction.contact_id) return `contact:${interaction.contact_id}`;
  return `interaction:${interaction.id || 'unknown'}`;
}

export function countHorusTouches(interactions: HorusInteractionLike[]) {
  const uniqueCaptationVisits = new Set<string>();
  let total = 0;

  for (const interaction of interactions) {
    if (!HORUS_TOUCH_TYPES.includes(interaction.interaction_type as any)) continue;

    if (interaction.interaction_type === 'visita_tasacion') {
      const key = getHorusOpportunityKey(interaction);
      if (uniqueCaptationVisits.has(key)) continue;
      uniqueCaptationVisits.add(key);
    }

    total += 1;
  }

  return total;
}

export function countCaptureInterviews(interactions: HorusInteractionLike[]) {
  const uniqueCaptationVisits = new Set<string>();

  for (const interaction of interactions) {
    if (interaction.interaction_type !== 'visita_tasacion') continue;
    uniqueCaptationVisits.add(getHorusOpportunityKey(interaction));
  }

  return uniqueCaptationVisits.size;
}

export function sumHorusInteractionPoints(interactions: HorusInteractionLike[], weights: HorusWeights) {
  const uniqueCaptationVisits = new Set<string>();
  let total = 0;

  for (const interaction of interactions) {
    if (interaction.interaction_type === 'visita_tasacion') {
      const key = getHorusOpportunityKey(interaction);
      if (uniqueCaptationVisits.has(key)) continue;
      uniqueCaptationVisits.add(key);
    }

    total += getInteractionPoints(interaction.interaction_type, weights);
  }

  return total;
}
