import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

type AiSearchFilters = {
  explanation?: string;
  [key: string]: unknown;
};

type AiSearchResponse = {
  filters?: AiSearchFilters;
};

export function useAiSearch() {
  const { toast } = useToast();
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiFilters, setAiFilters] = useState<AiSearchFilters | null>(null);
  const [aiExplanation, setAiExplanation] = useState('');

  const doSearch = async (query: string) => {
    if (!query.trim()) return;
    setAiSearchLoading(true);
    setAiFilters(null);
    setAiExplanation('');
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query }),
      });
      const data = (await resp.json()) as AiSearchResponse;
      if (data.filters) {
        setAiFilters(data.filters);
        setAiExplanation(data.filters.explanation || '');
      } else {
        toast({ title: 'IA no pudo interpretar la búsqueda', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error en búsqueda IA', variant: 'destructive' });
    }
    setAiSearchLoading(false);
  };

  const runAiSearch = () => doSearch(aiQuery);

  /** Busca directamente con un texto concreto (útil para sugerencias) */
  const runAiSearchWith = (query: string) => {
    setAiQuery(query);
    doSearch(query);
  };

  const clearAiSearch = () => {
    setAiQuery('');
    setAiFilters(null);
    setAiExplanation('');
  };

  return { aiQuery, setAiQuery, aiSearchLoading, aiFilters, aiExplanation, runAiSearch, runAiSearchWith, clearAiSearch };
}
