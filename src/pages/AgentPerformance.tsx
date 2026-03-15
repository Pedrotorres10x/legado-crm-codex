import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAgentPerformance } from '@/hooks/useAgentPerformance';
import { useAgentHorusStatus } from '@/hooks/useAgentHorusStatus';
import AgentRadarChart from '@/components/performance/AgentRadarChart';
import AgentPointsAccumulator from '@/components/performance/AgentPointsAccumulator';
import AgentConversionFunnel from '@/components/performance/AgentConversionFunnel';
import ContactHealthSummary from '@/components/performance/ContactHealthSummary';
import AgentPipelineEagle from '@/components/performance/AgentPipelineEagle';
import HorusScoringGuide from '@/components/performance/HorusScoringGuide';
import AgentConversionRatiosCard from '@/components/performance/AgentConversionRatiosCard';
import AgentSelfEvaluationCard from '@/components/performance/AgentSelfEvaluationCard';
import AgentCompetitionCard from '@/components/performance/AgentCompetitionCard';
import Rule42210Card from '@/components/performance/Rule42210Card';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Phone, Users, Building2, Euro } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const AgentPerformance = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<3 | 6>(3);
  const { data, loading } = useAgentPerformance(user?.id, period);
  const horusStatus = useAgentHorusStatus(user?.id);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold">Mi Rendimiento</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Toques', icon: Phone, current: data.toquesCount, target: data.toquesTarget, color: 'text-primary' },
    { label: 'Entrevistas', icon: Users, current: data.entrevistasCount, target: data.entrevistasTarget, color: 'text-accent' },
    { label: 'Captaciones', icon: Building2, current: data.captacionesCount, target: data.captacionesTarget, color: 'text-info' },
    { label: 'Arras firmadas', icon: Euro, current: data.facturacionCount, target: data.facturacionTarget, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Análisis de rendimiento</p>
        <h1 className="text-2xl font-display font-bold">Mi Rendimiento</h1>
      </div>

      <Rule42210Card />

      {/* KPI cards row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => {
          const pct = Math.min(Math.round((k.current / Math.max(k.target, 1)) * 100), 100);
          const done = pct >= 100;
          return (
            <Card key={k.label} className="border-0 shadow-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1.5">
                    <k.icon className={`h-4 w-4 ${k.color}`} />{k.label}
                  </span>
                  <span className={`text-xs font-bold ${done ? 'text-success' : 'text-muted-foreground'}`}>{pct}%</span>
                </div>
                <p className="text-xl font-bold">
                  {k.current}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/ {k.target}</span>
                </p>
                <Progress value={pct} className="h-2" />
                {done && <p className="text-[10px] text-success font-medium">✅ Objetivo cumplido</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        <AgentSelfEvaluationCard agentId={user?.id} data={data} />
        <AgentRadarChart data={data} period={period} onPeriodChange={setPeriod} />
      </div>

      <ContactHealthSummary data={data} />

      <AgentPipelineEagle data={data} />

      <AgentConversionRatiosCard data={data} />

      <AgentCompetitionCard currentAgentId={user?.id} />

      <div className="grid gap-5 lg:grid-cols-2">
        <AgentPointsAccumulator data={data} />
        <AgentConversionFunnel data={data} />
      </div>

      <HorusScoringGuide
        weights={data.weights}
        target={data.weights.monthly_bonus_target}
        periodLabel={horusStatus.periodLabel}
        points={horusStatus.points}
        targetLabel="de promedio rolling para cobrar el bonus Horus"
      />
    </div>
  );
};

export default AgentPerformance;
