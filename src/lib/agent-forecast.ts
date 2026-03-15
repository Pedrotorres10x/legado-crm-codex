import type { PerformanceData } from '@/hooks/useAgentPerformance';

export type AgentForecast = {
  level: 'rojo' | 'amarillo' | 'verde';
  title: string;
  detail: string;
  action: string;
};

export function getAgentForecast(
  data: Pick<
    PerformanceData,
    | 'captacionesCount'
    | 'captacionesTarget'
    | 'facturacionCount'
    | 'facturacionTarget'
    | 'entrevistasCount'
    | 'entrevistasTarget'
    | 'availableStockCount'
  >,
): AgentForecast {
  const captureRatio = data.captacionesCount / Math.max(data.captacionesTarget, 1);
  const salesRatio = data.facturacionCount / Math.max(data.facturacionTarget, 1);
  const interviewRatio = data.entrevistasCount / Math.max(data.entrevistasTarget, 1);

  if (data.facturacionCount >= 1 && data.availableStockCount < 5 && captureRatio < 0.75) {
    return {
      level: 'rojo',
      title: 'Has vendido, pero la nevera se vacía',
      detail: `Ya hay arras en el periodo, pero solo quedan ${data.availableStockCount} propiedades disponibles y la captación no repone cartera suficiente.`,
      action: 'Sube visitas de captación y exclusiva antes de que el próximo mes se quede sin producto para vender.',
    };
  }

  if (data.availableStockCount < 5 && interviewRatio < 0.75 && captureRatio < 0.75) {
    return {
      level: 'rojo',
      title: 'Nevera vacía',
      detail: `La cartera disponible está por debajo del mínimo útil y tampoco hay suficiente actividad de captación para reconstruirla.`,
      action: 'Prioriza captación por encima de todo hasta recuperar una base vendedora mínima.',
    };
  }

  if (data.availableStockCount > 15 && salesRatio < 0.75) {
    return {
      level: 'amarillo',
      title: 'Mucho stock, poca salida',
      detail: `La cartera es amplia, pero no se está transformando en arras al ritmo esperado.`,
      action: 'Deja de empujar captación nueva y centra agenda en visitas con resultado, ofertas y cierres.',
    };
  }

  if (data.availableStockCount >= 10 && data.availableStockCount <= 15 && captureRatio >= 0.75 && salesRatio >= 0.75) {
    return {
      level: 'verde',
      title: 'Nevera sana',
      detail: 'La cartera disponible y la conversión comercial están equilibradas para sostener ventas con continuidad.',
      action: 'Mantén equilibrio entre captación y venta sin sobrecargar stock.',
    };
  }

  if (captureRatio >= 1 && data.availableStockCount >= 5 && data.availableStockCount < 10) {
    return {
      level: 'amarillo',
      title: 'Base creciendo',
      detail: 'La captación ya está construyendo una base útil, pero todavía conviene seguir rellenando la nevera.',
      action: 'Sostén captación hasta entrar en la franja óptima de cartera antes de relajar foco.',
    };
  }

  return {
    level: 'amarillo',
    title: 'Equilibrio frágil',
    detail: 'La oficina se mueve, pero aún no hay suficiente colchón para asegurar que el próximo mes venga igual de fuerte.',
    action: 'Vigila que la captación reponga lo que se está vendiendo y que las entrevistas lleguen a oferta.',
  };
}
