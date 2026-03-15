import { differenceInCalendarDays } from 'date-fns';

export type AgentOnboardingInput = {
  createdAt?: string | null;
  touchesToday: number;
  touchTarget: number;
  captureVisitsWeek: number;
  captureVisitsTarget: number;
  capturesMonth: number;
  availableStock: number;
  richnessScore: number;
};

export type AgentOnboardingStage = {
  weekLabel: 'Semana 2' | 'Semana 4' | 'Semana 8' | 'Semana 12' | 'Más de 90 días';
  status: 'early' | 'on_track' | 'at_risk';
  detail: string;
  action: string;
  daysSinceStart: number;
};

export const getAgentOnboardingStage = ({
  createdAt,
  touchesToday,
  touchTarget,
  captureVisitsWeek,
  captureVisitsTarget,
  capturesMonth,
  availableStock,
  richnessScore,
}: AgentOnboardingInput): AgentOnboardingStage => {
  const daysSinceStart = createdAt ? Math.max(differenceInCalendarDays(new Date(), new Date(createdAt)), 0) : 999;
  const touchReady = touchTarget > 0 && touchesToday >= Math.max(1, Math.ceil(touchTarget * 0.75));
  const visitReady = captureVisitsTarget > 0 && captureVisitsWeek >= Math.max(1, Math.ceil(captureVisitsTarget * 0.5));

  if (daysSinceStart <= 14) {
    return {
      weekLabel: 'Semana 2',
      status: touchReady ? 'on_track' : 'at_risk',
      detail: touchReady
        ? 'Ya debería verse método: círculo, zona, agenda y constancia en toques.'
        : 'Todavía no se ve método suficiente. A esta altura ya debería notarse disciplina diaria.',
      action: 'Mirar agenda, círculo de influencia y trabajo de zona. Si no hay ritmo aquí, luego no habrá captación.',
      daysSinceStart,
    };
  }

  if (daysSinceStart <= 28) {
    const onTrack = touchReady && visitReady;
    return {
      weekLabel: 'Semana 4',
      status: onTrack ? 'on_track' : 'at_risk',
      detail: onTrack
        ? 'Ya debería estar convirtiendo actividad en visitas de captación reales.'
        : 'A las 4 semanas ya deberías ver visitas de captación y método comercial, aunque aún no haya ventas.',
      action: 'Exigir toques útiles y primeras visitas de captación. Sin eso, la nevera sigue vacía.',
      daysSinceStart,
    };
  }

  if (daysSinceStart <= 56) {
    const onTrack = visitReady && (capturesMonth >= 1 || availableStock >= 3);
    return {
      weekLabel: 'Semana 8',
      status: onTrack ? 'on_track' : 'at_risk',
      detail: onTrack
        ? 'Ya debería haber señales claras de cartera en construcción.'
        : 'A las 8 semanas ya deberías ver producto en cartera o primeras captaciones claras.',
      action: 'Empujar captación exclusiva y calidad de ficha. Aquí ya no basta con “moverse mucho”.',
      daysSinceStart,
    };
  }

  if (daysSinceStart <= 84) {
    const onTrack = (capturesMonth >= 1 || availableStock >= 5) && richnessScore >= 55;
    return {
      weekLabel: 'Semana 12',
      status: onTrack ? 'on_track' : 'at_risk',
      detail: onTrack
        ? 'Aunque la primera venta tarde, ya debería verse una base comercial seria para llegar a ella.'
        : 'A los 90 días ya deberías tener suficiente base para saber si el agente va a captar y vender o no.',
      action: 'Revisar con crudeza: actividad, visitas, cartera y calidad de producto. Si aquí no está arrancando, no es un tema de paciencia.',
      daysSinceStart,
    };
  }

  return {
    weekLabel: 'Más de 90 días',
    status: richnessScore >= 60 && availableStock >= 5 ? 'on_track' : 'early',
    detail: 'Pasado el arranque, esta lectura deja de ser onboarding y pasa a ser producción sostenida.',
    action: 'Usar ya foco comercial, Horus, cuellos y arras como lectura principal.',
    daysSinceStart,
  };
};
