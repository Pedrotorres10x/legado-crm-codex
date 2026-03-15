import type { PerformanceData } from '@/hooks/useAgentPerformance';

export type AgentCoherenceSignal = {
  severity: 'media' | 'alta';
  title: string;
  detail: string;
  action: string;
};

export function getAgentCoherenceSignal(data: Pick<
  PerformanceData,
  'toquesCount' | 'entrevistasCount' | 'captacionesCount' | 'facturacionCount'
>): AgentCoherenceSignal | null {
  const { toquesCount, entrevistasCount, captacionesCount, facturacionCount } = data;

  if (toquesCount >= 60 && entrevistasCount <= 1) {
    return {
      severity: 'alta',
      title: 'Mucho toque, poca tracción',
      detail: 'Hay volumen de actividad declarada, pero casi no está aterrizando en visitas comerciales reales.',
      action: 'Revisar calidad de los toques y pedir siguiente paso concreto en cada contacto.',
    };
  }

  if (entrevistasCount >= 6 && captacionesCount === 0 && facturacionCount === 0) {
    return {
      severity: 'alta',
      title: 'Visitas sin avance',
      detail: 'Se están registrando entrevistas, pero no se están transformando ni en captación ni en arras.',
      action: 'Auditar visitas, resultado comercial y propuesta de valor después de cada cita.',
    };
  }

  if (captacionesCount >= 2 && facturacionCount === 0) {
    return {
      severity: 'media',
      title: 'Captación sin arras',
      detail: 'El agente trae producto, pero ese stock todavía no está convirtiendo en negocio firmado.',
      action: 'Mirar calidad del producto, seguimiento comprador y estrategia de precio.',
    };
  }

  if (toquesCount >= 35 && entrevistasCount <= 2) {
    return {
      severity: 'media',
      title: 'Actividad inflada o poco eficaz',
      detail: 'Hay bastante actividad base, pero la cadena se atasca muy pronto y conviene revisar si esos toques están moviendo negocio real.',
      action: 'Cruzar agenda, respuestas y siguiente paso para separar volumen real de ruido.',
    };
  }

  return null;
}
