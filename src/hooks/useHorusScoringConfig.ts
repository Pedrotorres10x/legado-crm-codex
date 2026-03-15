import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_HORUS_WEIGHTS, normalizeHorusWeights, type HorusWeights } from '@/lib/horus-model';

export function useHorusScoringConfig() {
  const [weights, setWeights] = useState<HorusWeights>(DEFAULT_HORUS_WEIGHTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'point_weights')
        .maybeSingle();

      setWeights(normalizeHorusWeights(data?.value));
      setLoading(false);
    };

    load();
  }, []);

  return { weights, loading };
}
