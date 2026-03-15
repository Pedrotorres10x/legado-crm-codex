import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentPerformance } from '@/hooks/useAgentPerformance';
import { getPerformanceBottleneck } from '@/lib/agent-bottlenecks';
import { getAgentForecast } from '@/lib/agent-forecast';
import { AlertTriangle, ArrowRight } from 'lucide-react';

type Agent = {
  user_id: string;
  full_name: string;
};

type Props = {
  agents: Agent[];
  onSelectAgent: (agentId: string) => void;
};

const toneClass = (value: number) => {
  if (value >= 75) return 'text-emerald-600';
  if (value >= 50) return 'text-amber-600';
  return 'text-rose-600';
};

const AgentBottleneckRow = ({ agent, onSelectAgent }: { agent: Agent; onSelectAgent: (agentId: string) => void }) => {
  const { data, loading } = useAgentPerformance(agent.user_id, 3);

  if (loading || !data) {
    return <Skeleton className="h-28 rounded-xl" />;
  }

  const bottleneck = getPerformanceBottleneck(data);
  const forecast = getAgentForecast(data);

  return (
    <div className="rounded-xl border border-border/60 bg-background px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{agent.full_name}</p>
          <p className="text-xs text-muted-foreground">{bottleneck.title}</p>
          <p className="text-sm text-muted-foreground">{bottleneck.detail}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={`text-lg font-bold ${toneClass(bottleneck.value)}`}>{bottleneck.value}%</p>
            <p className="text-[11px] text-muted-foreground">{bottleneck.axis}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onSelectAgent(agent.user_id)}>
            Abrir seguimiento
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-3 text-sm">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span><span className="font-medium">Foco sugerido:</span> {bottleneck.action}</span>
      </div>
      <div className="mt-2 rounded-lg bg-background px-3 py-3 text-sm">
        <span className="font-medium">{forecast.title}:</span> {forecast.action}
      </div>
    </div>
  );
};

const AdminAgentBottlenecks = ({ agents, onSelectAgent }: Props) => {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Cuellos del equipo
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Golpe de vista por agente para detectar dónde se rompe la cadena comercial y actuar antes.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay agentes disponibles.</p>
        ) : (
          agents.map((agent) => (
            <AgentBottleneckRow key={agent.user_id} agent={agent} onSelectAgent={onSelectAgent} />
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAgentBottlenecks;
