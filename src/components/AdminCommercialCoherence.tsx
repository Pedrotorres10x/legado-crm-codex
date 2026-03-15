import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAgentPerformance } from '@/hooks/useAgentPerformance';
import { getAgentCoherenceSignal } from '@/lib/agent-coherence';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Agent = {
  user_id: string;
  full_name: string;
};

const AgentCoherenceRow = ({ agent }: { agent: Agent }) => {
  const { data, loading } = useAgentPerformance(agent.user_id, 3);

  if (loading || !data) {
    return <Skeleton className="h-24 rounded-xl" />;
  }

  const signal = getAgentCoherenceSignal(data);
  if (!signal) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{agent.full_name}</p>
          <p className="text-xs text-muted-foreground">{signal.title}</p>
          <p className="text-sm text-muted-foreground">{signal.detail}</p>
        </div>
        <Badge variant={signal.severity === 'alta' ? 'destructive' : 'secondary'}>
          {signal.severity === 'alta' ? 'Revisar' : 'Vigilar'}
        </Badge>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-3 text-sm">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>{signal.action}</span>
      </div>
      <div className="mt-3">
        <Button asChild size="sm" variant="outline">
          <Link to={`/admin/team?tab=tracking&agent=${agent.user_id}`}>Abrir seguimiento</Link>
        </Button>
      </div>
    </div>
  );
};

const AdminCommercialCoherence = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name')
      .then(({ data }) => {
        if (!mounted) return;
        setAgents((data || []).filter((agent) => agent.full_name));
        setLoadingAgents(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Coherencia comercial
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          No es policía: solo señales de actividad con poca tracción para detectar ruido antes de que distorsione el seguimiento.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadingAgents ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          (() => {
            if (agents.length === 0) {
              return <p className="text-sm text-emerald-700">No hay señales raras de actividad ahora mismo.</p>;
            }

            return <div className="grid gap-3 xl:grid-cols-2">{agents.map((agent) => <AgentCoherenceRow key={agent.user_id} agent={agent} />)}</div>;
          })()
        )}
        <p className="text-xs text-muted-foreground">
          Aquí solo deberían aparecer patrones que piden conversación o revisión de método, no control invasivo del día a día.
        </p>
      </CardContent>
    </Card>
  );
};

export default AdminCommercialCoherence;
