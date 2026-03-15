import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ExclusionType = 'email' | 'ip';

export function useWebLeadsExclusions(refetchExclusions: () => Promise<unknown>) {
  const [newExcType, setNewExcType] = useState<ExclusionType>('email');
  const [newExcValue, setNewExcValue] = useState('');
  const [newExcLabel, setNewExcLabel] = useState('');
  const [savingExc, setSavingExc] = useState(false);

  const addExclusion = async () => {
    if (!newExcValue.trim()) return;
    setSavingExc(true);
    await (supabase as any).from('analytics_exclusions').insert({
      type: newExcType,
      value: newExcValue.trim().toLowerCase(),
      label: newExcLabel.trim() || newExcValue.trim(),
    });
    setNewExcValue('');
    setNewExcLabel('');
    await refetchExclusions();
    setSavingExc(false);
  };

  const removeExclusion = async (id: string) => {
    await (supabase as any).from('analytics_exclusions').delete().eq('id', id);
    await refetchExclusions();
  };

  return {
    addExclusion,
    newExcLabel,
    newExcType,
    newExcValue,
    removeExclusion,
    savingExc,
    setNewExcLabel,
    setNewExcType,
    setNewExcValue,
  };
}
