export type AgentViabilityInput = {
  touchesToday: number;
  touchTarget: number;
  captureVisitsWeek: number;
  captureVisitsTarget: number;
  capturesMonth: number;
  capturesTarget: number;
  availableStock: number;
  richnessScore: number;
};

export type AgentViabilitySignal = {
  level: 'rojo' | 'amarillo' | 'verde';
  label: string;
  detail: string;
  action: string;
};

export const getAgentViabilitySignal = ({
  touchesToday,
  touchTarget,
  captureVisitsWeek,
  captureVisitsTarget,
  capturesMonth,
  capturesTarget,
  availableStock,
  richnessScore,
}: AgentViabilityInput): AgentViabilitySignal => {
  const touchRatio = touchTarget > 0 ? touchesToday / touchTarget : 0;
  const visitRatio = captureVisitsTarget > 0 ? captureVisitsWeek / captureVisitsTarget : 0;
  const captureRatio = capturesTarget > 0 ? capturesMonth / capturesTarget : 0;

  if (
    touchRatio >= 1 &&
    visitRatio >= 1 &&
    (capturesMonth >= 1 || availableStock >= 5) &&
    richnessScore >= 60
  ) {
    return {
      level: 'verde',
      label: 'Arranque sano',
      detail:
        'Con esta disciplina comercial, base de producto y calidad de ficha, el agente está en camino de captar y vender con continuidad.',
      action:
        'Dejar autonomía alta y revisar solo cuello fino: captación, venta o equilibrio según su cartera.',
    };
  }

  if (
    touchRatio >= 0.5 &&
    (visitRatio >= 0.5 || capturesMonth >= 1 || availableStock >= 3) &&
    richnessScore >= 45
  ) {
    return {
      level: 'amarillo',
      label: 'Todavía por demostrar',
      detail:
        'Hay señales de trabajo, pero todavía no basta para concluir que el agente va a sostener captación y venta al ritmo que necesitas.',
      action:
        'Seguir de cerca una semana más y empujar el hueco principal: toques, visitas de captación o calidad de ficha.',
    };
  }

  return {
    level: 'rojo',
    label: 'No está arrancando',
    detail:
      'Si no cumple disciplina, Horus, visitas de captación y base mínima de producto, es muy difícil que le vaya bien por inercia.',
    action:
      'Intervenir ya: agenda diaria, círculo de influencia, zona, visitas de captación y ficha rica. Sin eso, no hay motor comercial.',
  };
};
