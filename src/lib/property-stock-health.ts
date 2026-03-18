type PropertyStockRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  agent_id?: string | null;
  mandate_type?: string | null;
  mandate_end?: string | null;
  xml_id?: string | null;
  source?: string | null;
  price?: number | null;
  images?: string[] | null;
  description?: string | null;
};

type AgentFocusInput = {
  availableCount: number;
  activeOffers?: number;
  hotOpportunities?: number;
  visitsWithoutOffer?: number;
};

export type AgentCommercialFocus = {
  focus: 'captacion' | 'venta' | 'equilibrio';
  band: 'critico' | 'traccion' | 'optimo' | 'sobrecarga';
  label: string;
  detail: string;
  action: string;
};

export type AgentAutonomyStatus = {
  level: 'rojo' | 'amarillo' | 'verde';
  label: string;
  detail: string;
  reward: string;
};

export const isAvailablePropertyStock = (property: PropertyStockRow) => property.status === 'disponible';

export const hasPublishBasics = (property: PropertyStockRow) =>
  Boolean(property.price) &&
  Boolean(property.images?.length) &&
  Boolean(property.description && property.description.trim().length >= 20);

export const hasDistributionReady = (property: PropertyStockRow) =>
  Boolean(property.xml_id || property.source === 'habihub');

export const isMandateExpired = (property: PropertyStockRow) =>
  Boolean(property.mandate_end) && new Date(`${property.mandate_end}T00:00:00`) < new Date(new Date().toISOString().split('T')[0] + 'T00:00:00');

export const getPropertyStockSummary = (properties: PropertyStockRow[]) => {
  const available = properties.filter(isAvailablePropertyStock);
  const exclusives = available.filter((property) => property.mandate_type === 'exclusiva');
  const shared = available.filter((property) => property.mandate_type === 'compartida');
  const noMandate = available.filter((property) => !property.mandate_type || property.mandate_type === 'sin_mandato');
  const expiredMandate = available.filter(isMandateExpired);
  const feedReady = available.filter((property) => Boolean(property.xml_id || property.source === 'habihub'));
  const missingPublishBasics = available.filter((property) => !hasPublishBasics(property));
  const distributionGap = available.filter((property) => hasPublishBasics(property) && !hasDistributionReady(property));

  return {
    availableCount: available.length,
    exclusiveCount: exclusives.length,
    sharedCount: shared.length,
    noMandateCount: noMandate.length,
    expiredMandateCount: expiredMandate.length,
    feedReadyCount: feedReady.length,
    missingPublishBasicsCount: missingPublishBasics.length,
    distributionGapCount: distributionGap.length,
  };
};

export const getAgentStockRows = (properties: PropertyStockRow[]) => {
  const byAgent = properties.reduce<Map<string, PropertyStockRow[]>>((map, property) => {
    if (!property.agent_id) return map;
    const current = map.get(property.agent_id) || [];
    current.push(property);
    map.set(property.agent_id, current);
    return map;
  }, new Map());

  return Array.from(byAgent.entries()).map(([agentId, rows]) => ({
    agentId,
    ...getPropertyStockSummary(rows),
  }));
};

export const getAgentCommercialFocus = ({
  availableCount,
  activeOffers = 0,
  hotOpportunities = 0,
  visitsWithoutOffer = 0,
}: AgentFocusInput): AgentCommercialFocus => {
  if (availableCount < 5) {
    return {
      focus: 'captacion',
      band: 'critico',
      label: 'Modo captacion',
      detail: `Solo ${availableCount} propiedades en cartera. Con menos de 5 es difícil sostener el ritmo comercial deseado.`,
      action: 'Subir visitas de captación y mandatos hasta construir una base vendedora mínima.',
    };
  }

  if (availableCount < 10) {
    if (activeOffers >= 2 || hotOpportunities >= 2) {
      return {
        focus: 'equilibrio',
        band: 'traccion',
        label: 'Equilibrio en construcción',
        detail: `${availableCount} propiedades activas y ya hay tracción comercial. Estás acercándote a la zona útil.`,
        action: 'Mantén captación constante sin dejar caer seguimiento comprador y ofertas.',
      };
    }

    return {
      focus: 'captacion',
      band: 'traccion',
      label: 'Tracción hacia captación',
      detail: `${availableCount} propiedades activas. Entre 5 y 10 ya hay base, pero todavía conviene empujar producto.`,
      action: 'Prioriza captación y exclusiva hasta entrar en la franja óptima de cartera.',
    };
  }

  if (availableCount <= 15) {
    if (activeOffers >= 2 || hotOpportunities >= 1) {
      return {
        focus: 'equilibrio',
        band: 'optimo',
        label: 'Zona óptima',
        detail: `${availableCount} propiedades en cartera y pipeline vivo. Aquí interesa equilibrar captación y venta.`,
        action: 'Sostén el producto actual y convierte visitas, ofertas y arras sin sobrecargar stock.',
      };
    }

    return {
      focus: 'venta',
      band: 'optimo',
      label: 'Stock sano, toca vender',
      detail: `${availableCount} propiedades en cartera. Ya no necesitas empujar más captación; el cuello está en conversión.`,
      action: visitsWithoutOffer > 0
        ? 'Aprieta seguimiento comprador, segunda visita, oferta y cierre de las visitas ya realizadas.'
        : 'Mueve demanda, visitas y negociación para transformar cartera en arras.',
    };
  }

  return {
    focus: 'venta',
    band: 'sobrecarga',
    label: 'Exceso de cartera',
    detail: `${availableCount} propiedades en cartera. Por encima de 15 empieza a costar gestionarlo con calidad.`,
    action: 'Deja de empujar captación nueva y centra al agente en mover stock, ofertas y arras.',
  };
};

type AgentAutonomyInput = AgentFocusInput & {
  focus: AgentCommercialFocus['focus'];
  touchesToday?: number;
  touchTarget?: number;
  captureVisitsWeek?: number;
  captureVisitsTarget?: number;
  capturesMonth?: number;
  capturesTarget?: number;
};

export const getAgentAutonomyStatus = ({
  focus,
  availableCount,
  activeOffers = 0,
  hotOpportunities = 0,
  visitsWithoutOffer = 0,
  touchesToday = 0,
  touchTarget = 4,
  captureVisitsWeek = 0,
  captureVisitsTarget = 2,
  capturesMonth = 0,
  capturesTarget = 2,
}: AgentAutonomyInput): AgentAutonomyStatus => {
  if (focus === 'captacion') {
    const weakTouches = touchesToday < Math.max(1, Math.ceil(touchTarget * 0.5));
    const weakCaptureVisits = captureVisitsWeek < Math.max(1, Math.ceil(captureVisitsTarget * 0.5));
    const weakCaptures = capturesMonth < Math.max(1, Math.ceil(capturesTarget * 0.5));

    if (availableCount < 5 && weakTouches && weakCaptureVisits && weakCaptures) {
      return {
        level: 'rojo',
        label: 'Rojo · control estricto',
        detail: 'Tiene poco producto y todavía no está generando la actividad de captación necesaria.',
        reward: 'Necesita acompañamiento cercano hasta reconstruir base vendedora.',
      };
    }

    if (capturesMonth >= capturesTarget || captureVisitsWeek >= captureVisitsTarget) {
      return {
        level: 'verde',
        label: 'Verde · autonomía alta',
        detail: 'Aunque su foco es captar, ya está empujando visitas de captación y exclusivas en ritmo.',
        reward: 'Se gana libertad para organizarse porque está construyendo negocio real.',
      };
    }

    return {
      level: 'amarillo',
      label: 'Amarillo · seguimiento ligero',
      detail: 'Está en fase de construir producto, pero todavía conviene acompañar foco y ritmo.',
      reward: 'Puede ir ganando autonomía si sostiene captación y entrevistas útiles.',
    };
  }

  if (focus === 'venta') {
    if (availableCount > 15 && activeOffers === 0 && hotOpportunities === 0 && visitsWithoutOffer >= 3) {
      return {
        level: 'rojo',
        label: 'Rojo · control estricto',
        detail: 'Tiene mucha cartera, pero no la está convirtiendo en oferta ni en arras con suficiente tracción.',
        reward: 'Necesita coaching y revisión cercana hasta mover stock con resultados.',
      };
    }

    if (activeOffers >= 2 || hotOpportunities >= 2) {
      return {
        level: 'verde',
        label: 'Verde · autonomía alta',
        detail: 'Su foco natural es vender y el pipeline confirma que está moviendo cartera hacia cierre.',
        reward: 'Se le puede dejar más libertad porque convierte producto en negocio.',
      };
    }

    return {
      level: 'amarillo',
      label: 'Amarillo · seguimiento ligero',
      detail: 'Tiene producto suficiente; conviene acompañar la conversión comercial sin ahogarlo.',
      reward: 'La autonomía crecerá en cuanto convierta mejor visitas, ofertas y arras.',
    };
  }

  if (activeOffers >= 2 || hotOpportunities >= 1) {
    return {
      level: 'verde',
      label: 'Verde · autonomía alta',
      detail: 'Mantiene equilibrio razonable entre producto y tracción comercial.',
      reward: 'Está en la zona donde mejor funciona la autonomía como premio.',
    };
  }

  if (visitsWithoutOffer >= 4) {
    return {
      level: 'rojo',
      label: 'Rojo · control estricto',
      detail: 'Tiene base suficiente, pero el embudo se está rompiendo antes de la oferta.',
      reward: 'Necesita foco y revisión cercana hasta recuperar conversión.',
    };
  }

  return {
    level: 'amarillo',
    label: 'Amarillo · seguimiento ligero',
    detail: 'Está en una zona sana, pero todavía conviene vigilar que mantenga equilibrio real.',
    reward: 'Si sostiene stock sano y tracción compradora, se mueve a verde.',
  };
};
