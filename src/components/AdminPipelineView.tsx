import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AgentPipelineEagle from '@/components/performance/AgentPipelineEagle';
import { useAgentPerformance } from '@/hooks/useAgentPerformance';
import { Skeleton } from '@/components/ui/skeleton';
import { aggregatePipelineBuckets } from '@/lib/agent-performance';

interface Agent { user_id: string; full_name: string }

const AdminPipelineView = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const { data, loading } = useAgentPerformance(selectedAgent === 'all' ? undefined : selectedAgent, 3);

  const [globalPipeline, setGlobalPipeline] = useState<Record<string, number> | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('user_id, full_name').order('full_name').then(({ data }) => {
      if (data) setAgents(data.filter(a => a.full_name));
    });
  }, []);

  useEffect(() => {
    if (selectedAgent !== 'all') { setGlobalPipeline(null); return; }
    setGlobalLoading(true);
    supabase.from('contacts').select('pipeline_stage').then(({ data: contacts }) => {
      setGlobalPipeline(aggregatePipelineBuckets(contacts || []));
      setGlobalLoading(false);
    });
  }, [selectedAgent]);

  const isAll = selectedAgent === 'all';
  const showLoading = isAll ? globalLoading : loading;
  const pipelineData = isAll && globalPipeline
    ? { pipeline: globalPipeline } as any
    : data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Agente:</label>
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Todos los agentes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los agentes</SelectItem>
            {agents.map(a => (
              <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showLoading || !pipelineData ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <AgentPipelineEagle data={pipelineData} />
      )}
    </div>
  );
};

export default AdminPipelineView;
