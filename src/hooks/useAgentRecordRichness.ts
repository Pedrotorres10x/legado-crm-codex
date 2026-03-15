import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AgentRecordRichnessSummary, getAgentRecordRichness } from '@/lib/agent-record-richness';

type AgentRecordRichnessState = AgentRecordRichnessSummary | null;

export const useAgentRecordRichness = (userId?: string) => {
  const [summary, setSummary] = useState<AgentRecordRichnessState>(null);
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
        .from('properties')
        .select(
          'id, status, title, price, address, city, description, images, videos, virtual_tour_url, reference, bedrooms, bathrooms, surface_area, mandate_type',
        )
        .eq('agent_id', userId);

      if (!cancelled) {
        setSummary(getAgentRecordRichness((data as any[]) || []));
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
