import type { LucideIcon } from 'lucide-react';
import { Target, TrendingUp, Users, Wallet } from 'lucide-react';
import type { PerformanceData } from '@/hooks/useAgentPerformance';
import { getAgentCommercialFocus, getAgentAutonomyStatus } from '@/lib/property-stock-health';
import { getAgentViabilitySignal } from '@/lib/agent-viability';

type EvaluationExtraState = {
  activeOffers: number;
  hotOpportunities: number;
  visitsWithoutOffer: number;
};

export type AgentEvaluationTone = 'bien' | 'atencion' | 'mal';

export type AgentEvaluationPillar = {
  key: string;
  label: string;
  value: string;
  helper: string;
  status: AgentEvaluationTone;
  icon: LucideIcon;
};

export type AgentEvaluation = {
  focus: ReturnType<typeof getAgentCommercialFocus>;
  autonomy: ReturnType<typeof getAgentAutonomyStatus>;
  viability: ReturnType<typeof getAgentViabilitySignal>;
  verdict: {
    label: string;
    detail: string;
    tone: AgentEvaluationTone;
  };
  pillars: AgentEvaluationPillar[];
  weakPillars: string[];
};

export const autonomyTone = {
  rojo: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  amarillo: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  verde: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
} as const;

export const statusTone = {
  bien: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  atencion: 'border-amber-200 bg-amber-50 text-amber-700',
  mal: 'border-rose-200 bg-rose-50 text-rose-700',
} as const;

const getPillarStatus = (ratio: number): AgentEvaluationTone => {
  if (ratio >= 1) return 'bien';
  if (ratio >= 0.65) return 'atencion';
  return 'mal';
};

export const buildAgentEvaluation = (
  data: PerformanceData,
  extra: EvaluationExtraState,
  influenceTotal?: number,
): AgentEvaluation => {
  const workRatio = data.toquesTarget > 0 ? data.toquesCount / data.toquesTarget : 0;
  const captureRatio = data.entrevistasTarget > 0 ? data.entrevistasCount / data.entrevistasTarget : 0;
  const stockRatio = data.captacionesTarget > 0 ? data.captacionesCount / data.captacionesTarget : 0;
  const conversionRatio = data.facturacionTarget > 0 ? data.facturacionCount / data.facturacionTarget : 0;

  const focus = getAgentCommercialFocus({
    availableCount: data.availableStockCount,
    activeOffers: extra.activeOffers,
    hotOpportunities: extra.hotOpportunities,
    visitsWithoutOffer: extra.visitsWithoutOffer,
  });

  const autonomy = getAgentAutonomyStatus({
    focus: focus.focus,
    availableCount: data.availableStockCount,
    activeOffers: extra.activeOffers,
    hotOpportunities: extra.hotOpportunities,
    visitsWithoutOffer: extra.visitsWithoutOffer,
    touchesToday: data.toquesCount,
    touchTarget: data.toquesTarget,
    captureVisitsWeek: data.entrevistasCount,
    captureVisitsTarget: data.entrevistasTarget,
    capturesMonth: data.captacionesCount,
    capturesTarget: data.captacionesTarget,
  });

  const viability = getAgentViabilitySignal({
    touchesToday: data.toquesCount,
    touchTarget: data.toquesTarget,
    captureVisitsWeek: data.entrevistasCount,
    captureVisitsTarget: data.entrevistasTarget,
    capturesMonth: data.captacionesCount,
    capturesTarget: data.captacionesTarget,
    availableStock: data.availableStockCount,
    richnessScore: 100 - ((data.health.orange + data.health.red) / Math.max(data.health.total, 1)) * 100,
  });

  const weakPillars = [
    workRatio < 0.65 ? 'trabajas poco o registras poco' : null,
    captureRatio < 0.65 ? 'no conviertes suficiente actividad en visitas de captacion' : null,
    stockRatio < 0.65 && data.availableStockCount < 5 ? 'no estás construyendo producto suficiente' : null,
    conversionRatio < 0.65 && data.availableStockCount >= 10 ? 'no conviertes bien cartera en arras' : null,
    typeof influenceTotal === 'number' && influenceTotal < 300 ? 'tu circulo de influencia todavía es demasiado corto' : null,
  ].filter(Boolean) as string[];

  const verdict =
    viability.level === 'verde' && weakPillars.length === 0
      ? {
          label: 'Puedes decir que vas bien',
          detail: 'Estás construyendo negocio con método. Aunque la venta tarde, el motor comercial ya se ve en actividad, captación y producto.',
          tone: 'bien' as const,
        }
      : viability.level === 'amarillo'
        ? {
            label: 'Todavía no basta',
            detail: 'Hay señales, pero aún no son suficientes para concluir que vas a sostener captación y venta con continuidad.',
            tone: 'atencion' as const,
          }
        : {
            label: 'Así no vas bien',
            detail: 'Los datos no acompañan. Sin método, captación y base comercial, esperar a la primera venta solo retrasa una verdad que ya se está viendo.',
            tone: 'mal' as const,
          };

  return {
    focus,
    autonomy,
    viability,
    verdict,
    pillars: [
      {
        key: 'trabajo',
        label: 'Trabaja',
        value: `${data.toquesCount}/${data.toquesTarget}`,
        helper: 'toques sobre objetivo',
        status: getPillarStatus(workRatio),
        icon: Target,
      },
      {
        key: 'captacion',
        label: 'Capta',
        value: `${data.entrevistasCount}/${data.entrevistasTarget}`,
        helper: 'visitas de captacion',
        status: getPillarStatus(captureRatio),
        icon: Users,
      },
      {
        key: 'producto',
        label: 'Construye producto',
        value: `${data.availableStockCount}`,
        helper: 'stock disponible',
        status: data.availableStockCount >= 10 ? 'bien' : data.availableStockCount >= 5 ? 'atencion' : 'mal',
        icon: Wallet,
      },
      {
        key: 'convierte',
        label: 'Convierte',
        value: `${data.facturacionCount}/${data.facturacionTarget}`,
        helper: 'arras en ritmo',
        status: getPillarStatus(conversionRatio),
        icon: TrendingUp,
      },
    ],
    weakPillars,
  };
};
