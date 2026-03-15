import type { PerformanceData } from '@/hooks/useAgentPerformance';

export type AgentBottleneck = {
  axis: 'Toques' | 'Entrevistas' | 'Captaciones' | 'Facturación';
  value: number;
  averageValue: number;
  title: string;
  detail: string;
  action: string;
};

const BOTTLENECK_MAP: Record<AgentBottleneck['axis'], Omit<AgentBottleneck, 'axis' | 'value' | 'averageValue'>> = {
  Toques: {
    title: 'Cuello en actividad base',
    detail: 'Falta volumen de prospección inicial y la cadena comercial no arranca con suficiente fuerza.',
    action: 'Subir toques útiles: WhatsApp, email, llamada y reuniones.',
  },
  Entrevistas: {
    title: 'Cuello en conversión a visita',
    detail: 'Hay actividad, pero cuesta llevarla a entrevistas o visitas comerciales útiles.',
    action: 'Mejorar paso de toque a visita: propuesta de agenda y siguiente paso claro.',
  },
  Captaciones: {
    title: 'Cuello en captación',
    detail: 'El trabajo comercial no se está transformando suficiente en mandato o producto nuevo.',
    action: 'Empujar tasaciones, cierre de captación y origen propio.',
  },
  'Facturación': {
    title: 'Cuello en arras',
    detail: 'La oficina mueve cartera, pero cuesta convertirla en arras firmadas.',
    action: 'Reforzar seguimiento comprador, negociación y cierre.',
  },
};

export function getPerformanceBottleneck(data: Pick<PerformanceData, 'toques' | 'entrevistas' | 'captaciones' | 'facturacion'>): AgentBottleneck {
  const axes = [
    { axis: 'Toques' as const, value: data.toques },
    { axis: 'Entrevistas' as const, value: data.entrevistas },
    { axis: 'Captaciones' as const, value: data.captaciones },
    { axis: 'Facturación' as const, value: data.facturacion },
  ];

  const lowestAxis = [...axes].sort((a, b) => a.value - b.value)[0];
  const averageValue = Math.round(axes.reduce((sum, item) => sum + item.value, 0) / axes.length);
  const meta = BOTTLENECK_MAP[lowestAxis.axis];

  return {
    axis: lowestAxis.axis,
    value: lowestAxis.value,
    averageValue,
    ...meta,
  };
}
