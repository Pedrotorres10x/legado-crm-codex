import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgentPerformance } from '@/hooks/useAgentPerformance';
import AgentRadarChart from '@/components/performance/AgentRadarChart';
import AgentPointsAccumulator from '@/components/performance/AgentPointsAccumulator';
import AgentConversionFunnel from '@/components/performance/AgentConversionFunnel';
import ContactHealthSummary from '@/components/performance/ContactHealthSummary';
import AgentPipelineEagle from '@/components/performance/AgentPipelineEagle';
import AdminAgentBottlenecks from '@/components/performance/AdminAgentBottlenecks';
import AdminAgentViabilityCard from '@/components/performance/AdminAgentViabilityCard';
import AdminAgentEvaluationCard from '@/components/performance/AdminAgentEvaluationCard';
import AgentConversionRatiosCard from '@/components/performance/AgentConversionRatiosCard';
import { Skeleton } from '@/components/ui/skeleton';

interface Agent { user_id: string; full_name: string }

type Props = {
  initialAgentId?: string;
};

const AdminAgentTracker = ({ initialAgentId }: Props) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>(initialAgentId || '');
  const [period, setPeriod] = useState<3 | 6>(3);
  const { data, loading } = useAgentPerformance(selectedAgent || undefined, period);

  useEffect(() => {
    supabase.from('profiles').select('user_id, full_name').order('full_name').then(({ data }) => {
      if (data) {
        setAgents(data.filter(a => a.full_name));
        if (data.length > 0 && !selectedAgent) setSelectedAgent(data[0].user_id);
      }
    });
  }, [selectedAgent]);

  useEffect(() => {
    if (initialAgentId) {
      setSelectedAgent(initialAgentId);
    }
  }, [initialAgentId]);

  return (
    <div className="space-y-6">
      <AdminAgentBottlenecks agents={agents} onSelectAgent={setSelectedAgent} />

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Agente:</label>
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Seleccionar agente" />
          </SelectTrigger>
          <SelectContent>
            {agents.map(a => (
              <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedAgent ? (
        <p className="text-muted-foreground text-sm">Selecciona un agente para ver su seguimiento.</p>
      ) : loading || !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (
        <>
        <div className="grid gap-5 lg:grid-cols-2">
            <AdminAgentEvaluationCard agentId={selectedAgent} data={data} />
            <AdminAgentViabilityCard agentId={selectedAgent} />
            <AgentRadarChart data={data} period={period} onPeriodChange={setPeriod} />
            <ContactHealthSummary data={data} />
          </div>
          <AgentPipelineEagle data={data} />
          <div className="grid gap-5 lg:grid-cols-2">
            <AgentPointsAccumulator data={data} />
            <AgentConversionFunnel data={data} />
          </div>
          <AgentConversionRatiosCard data={data} />
        </>
      )}
    </div>
  );
};

export default AdminAgentTracker;
