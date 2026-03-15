import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PerformanceData } from '@/hooks/useAgentPerformance';
import { useAgentInfluenceCircle } from '@/hooks/useAgentInfluenceCircle';
import { autonomyTone, buildAgentEvaluation, statusTone } from '@/lib/agent-evaluation';

type Props = {
  agentId?: string;
  data: PerformanceData;
};

type ExtraState = {
  activeOffers: number;
  hotOpportunities: number;
  visitsWithoutOffer: number;
};

const autonomyIcons = {
  rojo: ShieldAlert,
  amarillo: ShieldQuestion,
  verde: ShieldCheck,
} as const;

const AgentSelfEvaluationCard = ({ agentId, data }: Props) => {
  const { summary: influenceCircle, loading: influenceLoading } = useAgentInfluenceCircle(agentId);
  const [extra, setExtra] = useState<ExtraState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [{ data: offers }, { data: visits }] = await Promise.all([
        supabase.from('offers').select('status').eq('agent_id', agentId),
        supabase.from('visits').select('result').eq('agent_id', agentId),
      ]);

      if (cancelled) return;

      const activeOffers = (offers || []).filter((offer) => ['presentada', 'contraoferta', 'aceptada'].includes(offer.status)).length;
      const hotOpportunities = (visits || []).filter((visit) => ['oferta', 'reserva'].includes(visit.result || '')).length;
      const visitsWithoutOffer = (visits || []).filter((visit) => ['seguimiento', 'segunda_visita', 'realizada'].includes(visit.result || '')).length;

      setExtra({ activeOffers, hotOpportunities, visitsWithoutOffer });
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const evaluation = useMemo(() => {
    if (!extra) return null;
    return buildAgentEvaluation(data, extra, influenceCircle?.total);
  }, [data, extra, influenceCircle?.total]);

  if (!agentId) return null;
  if (loading || influenceLoading || !evaluation) return <Skeleton className="h-[360px] rounded-xl" />;

  const AutonomyIcon = autonomyIcons[evaluation.autonomy.level];

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Tu evaluacion de hoy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-xl border p-4 ${statusTone[evaluation.verdict.tone]}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{evaluation.verdict.label}</p>
              <p className="mt-1 text-sm opacity-90">
                Nadie debería llevarse sorpresas: esta es la lectura que ve dirección con tus datos actuales.
              </p>
            </div>
            {evaluation.verdict.tone === 'bien' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {evaluation.pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.key} className={`rounded-xl border p-4 ${statusTone[pillar.status]}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4" />
                  {pillar.label}
                </div>
                <p className="mt-2 text-2xl font-bold">{pillar.value}</p>
                <p className="text-xs opacity-80">{pillar.helper}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Foco</p>
            <p className="mt-2 text-sm font-semibold">{evaluation.focus.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{evaluation.focus.detail}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Autonomia</p>
            <div className="mt-2">
              <Badge variant="outline" className={autonomyTone[evaluation.autonomy.level].badge}>
                <AutonomyIcon className="mr-1 h-3 w-3" />
                {evaluation.autonomy.label}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{evaluation.autonomy.detail}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Circulo</p>
            <p className="mt-2 text-sm font-semibold">{influenceCircle?.total ?? 0} contactos utiles</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {influenceCircle ? influenceCircle.detail : 'Sin datos suficientes del circulo de influencia.'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Lo que te está frenando hoy</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {evaluation.weakPillars.length > 0
              ? `Si hoy te sentaras con dirección, te dirían que ${evaluation.weakPillars.join(', ')}.`
              : 'Hoy tus datos defienden bien que estás haciendo lo que toca para construir negocio real y no depender solo de intuiciones.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentSelfEvaluationCard;
