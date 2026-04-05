import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

type ContactSummaryResponse = {
  summary?: string;
  error?: string;
};

export type ContactVisitRow = {
  id: string;
  visit_date: string;
  properties?: { title: string } | null;
};

type Params = {
  toast: ToastFn;
};

export function useContactInsights({ toast }: Params) {
  const [summaryOpen, setSummaryOpen] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [contactVisits, setContactVisits] = useState<ContactVisitRow[]>([]);
  const [visitsOpen, setVisitsOpen] = useState<string | null>(null);
  const [visitsLoading, setVisitsLoading] = useState(false);

  const fetchContactVisits = async (contactId: string) => {
    setVisitsOpen(contactId);
    setVisitsLoading(true);
    const { data } = await supabase
      .from('visits')
      .select('*, properties(title)')
      .eq('contact_id', contactId)
      .order('visit_date', { ascending: false });
    setContactVisits(data || []);
    setVisitsLoading(false);
  };

  const fetchSummary = async (contactId: string) => {
    setSummaryOpen(contactId);
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
      const data = (await resp.json()) as ContactSummaryResponse;
      if (data.error) {
        toast({ title: 'Error IA', description: data.error, variant: 'destructive' });
        setSummaryOpen(null);
      } else {
        setSummary(data.summary ?? '');
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo conectar con IA', variant: 'destructive' });
      setSummaryOpen(null);
    }
    setSummaryLoading(false);
  };

  return {
    summaryOpen,
    setSummaryOpen,
    summary,
    summaryLoading,
    contactVisits,
    visitsOpen,
    setVisitsOpen,
    visitsLoading,
    fetchContactVisits,
    fetchSummary,
  };
}
