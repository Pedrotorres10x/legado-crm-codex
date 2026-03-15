import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AgentInfluenceCircleSummary, getAgentInfluenceCircle } from '@/lib/agent-influence-circle';

type InfluenceCircleState = AgentInfluenceCircleSummary | null;

export const useAgentInfluenceCircle = (userId?: string) => {
  const [summary, setSummary] = useState<InfluenceCircleState>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setSummary(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('contacts')
        .select('id, full_name, contact_type, status, tags, source_ref')
        .eq('agent_id', userId);

      if (!cancelled) {
        setSummary(getAgentInfluenceCircle((data as any[]) || []));
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    summary,
    loading,
  };
};
