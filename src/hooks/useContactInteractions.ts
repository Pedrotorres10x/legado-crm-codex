import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

const INITIAL_INTERACTION_FORM = {
  interaction_type: 'llamada',
  subject: '',
  description: '',
};

export const useContactInteractions = ({
  contactId,
  agentId,
  toast,
  onReload,
}: {
  contactId?: string;
  agentId?: string;
  toast: ToastFn;
  onReload: () => Promise<void> | void;
}) => {
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [intForm, setIntForm] = useState(INITIAL_INTERACTION_FORM);
  const [intSaving, setIntSaving] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState('');

  const handleAddInteraction = async () => {
    if (!contactId) return;
    if (!intForm.subject.trim() || intForm.subject.trim().length < 6) {
      toast({
        title: 'Falta resultado breve',
        description: 'Resume que paso en esa interaccion para que no quede vacia.',
        variant: 'destructive',
      });
      return;
    }
    if (!intForm.description.trim() || intForm.description.trim().length < 12) {
      toast({
        title: 'Falta siguiente paso',
        description: 'Explica el contexto o siguiente movimiento para que la interaccion tenga valor comercial.',
        variant: 'destructive',
      });
      return;
    }

    setIntSaving(true);
    const { error } = await supabase.from('interactions').insert({
      contact_id: contactId,
      interaction_type: intForm.interaction_type as any,
      subject: intForm.subject || null,
      description: intForm.description || null,
      agent_id: agentId || null,
      interaction_date: new Date().toISOString(),
    } as any);
    setIntSaving(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Interacción registrada' });
    setInteractionOpen(false);
    setIntForm(INITIAL_INTERACTION_FORM);
    await onReload();
  };

  const fetchSummary = async () => {
    if (!contactId) return;

    setSummaryLoading(true);
    setSummary('');
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ contact_id: contactId }),
      });
      const data = await resp.json();
      if (data.error) {
        toast({ title: 'Error IA', description: data.error, variant: 'destructive' });
      } else {
        setSummary(data.summary);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo conectar con IA', variant: 'destructive' });
    }
    setSummaryLoading(false);
  };

  return {
    interactionOpen,
    setInteractionOpen,
    intForm,
    setIntForm,
    intSaving,
    summaryLoading,
    summary,
    handleAddInteraction,
    fetchSummary,
  };
};
