import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Radar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAgentPerformance } from '@/hooks/useAgentPerformance';
import { getPerformanceBottleneck } from '@/lib/agent-bottlenecks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Agent = {
  user_id: string;
  full_name: string;
};

const toneClass = (value: number) => {
  if (value >= 75) return 'text-emerald-600';
  if (value >= 50) return 'text-amber-600';
  return 'text-rose-600';
};

const AgentBottleneckItem = ({ agent }: { agent: Agent }) => {
  const { data, loading } = useAgentPerformance(agent.user_id, 3);

  if (loading || !data) {
    return <Skeleton className="h-20 rounded-xl" />;
  }

  const bottleneck = getPerformanceBottleneck(data);

  return (
    <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{agent.full_name}</p>
          <p className="text-xs text-muted-foreground">{bottleneck.title}</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${toneClass(bottleneck.value)}`}>{bottleneck.value}%</p>
          <p className="text-[11px] text-muted-foreground">{bottleneck.axis}</p>
        </div>
      </div>
      <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>{bottleneck.action}</span>
      </div>
      <div className="mt-3">
        <Button asChild size="sm" variant="outline">
          <Link to={`/admin/team?tab=tracking&agent=${agent.user_id}`}>Abrir seguimiento</Link>
        </Button>
      </div>
    </div>
  );
};

const AdminCommercialBottlenecks = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const { data: officeData, loading: officeLoading } = useAgentPerformance(undefined, 3);

  useEffect(() => {
    let mounted = true;

    supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name')
      .then(({ data }) => {
        if (!mounted) return;
        setAgents((data || []).filter((agent) => agent.full_name));
        setAgentsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const officeBottleneck = officeData ? getPerformanceBottleneck(officeData) : null;

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              Cuellos comerciales
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Golpe de vista de dónde se atasca la oficina y qué agente necesita acción primero.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/team?tab=tracking">Abrir seguimiento completo</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          {officeLoading || !officeBottleneck ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Oficina hoy</p>
                <p className="text-lg font-semibold">{officeBottleneck.title}</p>
                <p className="text-sm text-muted-foreground">{officeBottleneck.detail}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className={`text-2xl font-bold ${toneClass(officeBottleneck.value)}`}>{officeBottleneck.value}%</p>
                  <p className="text-xs text-muted-foreground">{officeBottleneck.axis}</p>
                </div>
                <div className="flex max-w-xs items-start gap-2 rounded-xl bg-background px-3 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{officeBottleneck.action}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Agentes a mirar</p>
            <p className="text-xs text-muted-foreground">Ventana rolling de 3 meses</p>
          </div>
          {agentsLoading ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay agentes disponibles.</p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {agents.map((agent) => (
                <AgentBottleneckItem key={agent.user_id} agent={agent} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCommercialBottlenecks;
