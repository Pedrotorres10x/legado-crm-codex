import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AGENT_MONTHLY_COST } from '@/lib/commissions';

export const useAgentMonthlyCost = () => {
  const [cost, setCost] = useState(AGENT_MONTHLY_COST);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'agent_monthly_cost')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value != null) setCost(Number(data.value));
        setLoading(false);
      });
  }, []);

  const updateCost = async (newCost: number) => {
    const { error } = await supabase
      .from('settings')
      .update({ value: newCost, updated_at: new Date().toISOString() })
      .eq('key', 'agent_monthly_cost');
    if (!error) setCost(newCost);
    return !error;
  };

  return { cost, loading, updateCost };
};
