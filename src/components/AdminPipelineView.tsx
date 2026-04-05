import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AgentPipelineEagle from '@/components/performance/AgentPipelineEagle';
import { useAgentPerformance, type PerformanceData } from '@/hooks/useAgentPerformance';
import { Skeleton } from '@/components/ui/skeleton';
import { aggregatePipelineBuckets } from '@/lib/agent-performance';

interface Agent { user_id: string; full_name: string }
type PipelineContact = { pipeline_stage?: string | null };

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
      setGlobalPipeline(aggregatePipelineBuckets((contacts || []) as PipelineContact[]));
      setGlobalLoading(false);
    });
  }, [selectedAgent]);

  const isAll = selectedAgent === 'all';
  const showLoading = isAll ? globalLoading : loading;
  const pipelineData: PerformanceData | null = isAll && globalPipeline
    ? {
        periodMonths: 3,
        periodLabel: 'Todos los agentes',
        toques: 0,
        entrevistas: 0,
        captaciones: 0,
        facturacion: 0,
        toquesCount: 0,
        entrevistasCount: 0,
        captacionesCount: 0,
        facturacionCount: 0,
        availableStockCount: 0,
        llamadasCount: 0,
        buyerVisitsCount: 0,
        toquesTarget: 0,
        entrevistasTarget: 0,
        captacionesTarget: 0,
        facturacionTarget: 0,
        totalPoints: 0,
        averagePoints: 0,
        rollingTarget: 0,
        quarterlyTarget: 0,
        monthlyBreakdown: [],
        pipeline: globalPipeline,
        health: { green: 0, yellow: 0, orange: 0, red: 0, total: 0 },
        funnel: [],
        conversion: {
          llamadasToCaptacionVisitsRate: 0,
          captacionVisitsToExclusiveRate: 0,
          exclusivesToArrasRate: 0,
          buyerVisitsPerArras: null,
        },
        weights: data?.weights ?? {
          whatsapp: 0,
          email: 0,
          llamada: 0,
          cafe_comida: 0,
          reunion: 0,
          visita_tasacion: 0,
          visita_comprador_sin_resultado: 0,
          visita_comprador_con_resultado: 0,
          captacion: 0,
          facturacion: 0,
          quarterly_target: 0,
          monthly_bonus_target: 0,
        },
      }
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
