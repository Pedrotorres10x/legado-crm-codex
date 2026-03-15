import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getAgentKpiSummary, getAgentKpiTargets } from '@/lib/agent-kpis';
import { getAgentRecordRichness } from '@/lib/agent-record-richness';
import { getAgentViabilitySignal } from '@/lib/agent-viability';
import { getAgentOnboardingStage } from '@/lib/agent-onboarding';
import { supabase } from '@/integrations/supabase/client';

type Props = {
  agentId?: string;
};

const toneMap = {
  rojo: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: ShieldAlert,
  },
  amarillo: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: ShieldQuestion,
  },
  verde: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: ShieldCheck,
  },
};

const AdminAgentViabilityCard = ({ agentId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<{
    signal: ReturnType<typeof getAgentViabilitySignal>;
    touchesToday: number;
    touchTarget: number;
    captureVisitsWeek: number;
    captureVisitsTarget: number;
    capturesMonth: number;
    capturesTarget: number;
    availableStock: number;
    richnessScore: number;
    onboarding: ReturnType<typeof getAgentOnboardingStage>;
  } | null>(null);

  useEffect(() => {
    if (!agentId) {
      setState(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const targets = await getAgentKpiTargets();
      const [summary, propertiesRes, profileRes] = await Promise.all([
        getAgentKpiSummary(agentId, targets),
        supabase
          .from('properties')
          .select(
            'agent_id, status, title, price, address, city, description, images, videos, virtual_tour_url, reference, bedrooms, bathrooms, surface_area, mandate_type',
          )
          .eq('agent_id', agentId),
        supabase.from('profiles').select('created_at').eq('user_id', agentId).maybeSingle(),
      ]);

      if (cancelled) return;

      const properties = (propertiesRes.data as any[]) || [];
      const richness = getAgentRecordRichness(properties);
      const availableStock = properties.filter((property) => property.status === 'disponible').length;
      const signal = getAgentViabilitySignal({
        touchesToday: summary.toquesHorusHoy,
        touchTarget: summary.targets.toques_horus_dia,
        captureVisitsWeek: summary.citasSemana,
        captureVisitsTarget: summary.targets.citas_semana,
        capturesMonth: summary.captacionesMes,
        capturesTarget: summary.targets.captaciones_mes,
        availableStock,
        richnessScore: richness.averageScore,
      });
      const onboarding = getAgentOnboardingStage({
        createdAt: profileRes.data?.created_at,
        touchesToday: summary.toquesHorusHoy,
        touchTarget: summary.targets.toques_horus_dia,
        captureVisitsWeek: summary.citasSemana,
        captureVisitsTarget: summary.targets.citas_semana,
        capturesMonth: summary.captacionesMes,
        availableStock,
        richnessScore: richness.averageScore,
      });

      setState({
        signal,
        touchesToday: summary.toquesHorusHoy,
        touchTarget: summary.targets.toques_horus_dia,
        captureVisitsWeek: summary.citasSemana,
        captureVisitsTarget: summary.targets.citas_semana,
        capturesMonth: summary.captacionesMes,
        capturesTarget: summary.targets.captaciones_mes,
        availableStock,
        richnessScore: richness.averageScore,
        onboarding,
      });
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (!agentId) return null;

  if (loading || !state) {
    return <Skeleton className="h-56 rounded-xl" />;
  }

  const tone = toneMap[state.signal.level];
  const Icon = tone.icon;

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-primary" />
          Viabilidad comercial temprana
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={tone.badge}>
            {state.signal.label}
          </Badge>
          <Badge variant="outline">{state.touchesToday}/{state.touchTarget} toques hoy</Badge>
          <Badge variant="outline">{state.captureVisitsWeek}/{state.captureVisitsTarget} visitas captación</Badge>
          <Badge variant="outline">{state.capturesMonth}/{state.capturesTarget} captaciones mes</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{state.signal.detail}</p>
        <p className="text-sm">{state.signal.action}</p>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Base del diagnóstico</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Stock disponible: <span className="text-foreground">{state.availableStock}</span> · Calidad de ficha:{' '}
            <span className="text-foreground">{state.richnessScore}/100</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {state.onboarding.weekLabel}: <span className="text-foreground">{state.onboarding.detail}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminAgentViabilityCard;
