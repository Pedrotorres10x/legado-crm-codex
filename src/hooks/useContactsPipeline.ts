import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const CAPTACION_STAGES = [
  { key: 'prospecto', label: 'Lead', color: 'bg-slate-500' },
  { key: 'contactado', label: 'Contactado', color: 'bg-blue-500' },
  { key: 'visita_tasacion', label: 'Visita tasación', color: 'bg-amber-500' },
  { key: 'negociando', label: 'Negociando', color: 'bg-orange-500' },
  { key: 'captado', label: 'Captado', color: 'bg-emerald-500' },
  { key: 'en_venta', label: 'En venta', color: 'bg-purple-500' },
] as const;

export const BUYER_STAGES = [
  { key: 'nuevo', label: 'Nuevo', color: 'bg-slate-500' },
  { key: 'cualificado', label: 'Cualificado', color: 'bg-blue-500' },
  { key: 'visitando', label: 'Visitando', color: 'bg-amber-500' },
  { key: 'oferta', label: 'Oferta', color: 'bg-orange-500' },
  { key: 'reserva', label: 'Reserva', color: 'bg-emerald-500' },
  { key: 'escritura', label: 'Escritura', color: 'bg-purple-500' },
] as const;

export const CERRADO_STAGES = [
  { key: 'reserva', label: 'Reserva', color: 'bg-amber-500' },
  { key: 'escritura', label: 'Escritura', color: 'bg-blue-500' },
  { key: 'completado', label: 'Completado', color: 'bg-emerald-500' },
  { key: 'vendido', label: 'Vendido', color: 'bg-green-600' },
  { key: 'en_venta', label: 'En venta', color: 'bg-purple-500' },
] as const;

export const COLABORADOR_STAGES = [
  { key: 'nuevo', label: 'Nuevo', color: 'bg-slate-500' },
  { key: 'activo', label: 'Activo', color: 'bg-emerald-500' },
  { key: 'en_seguimiento', label: 'En seguimiento', color: 'bg-blue-500' },
  { key: 'cerrado', label: 'Inactivo', color: 'bg-red-500' },
] as const;

export const PIPELINE_TYPE_MAP: Record<string, string[]> = {
  captacion: ['statefox', 'prospecto', 'propietario'],
  compradores: ['comprador', 'ambos'],
  cerrados: ['comprador_cerrado', 'vendedor_cerrado'],
  red: ['colaborador', 'contacto', 'comprador_cerrado', 'vendedor_cerrado', 'ambos'],
};

export const stagesMap: Record<string, typeof BUYER_STAGES> = {
  captacion: CAPTACION_STAGES as unknown as typeof BUYER_STAGES,
  compradores: BUYER_STAGES,
  cerrados: CERRADO_STAGES as unknown as typeof BUYER_STAGES,
  red: COLABORADOR_STAGES as unknown as typeof BUYER_STAGES,
};

export const CONTACTS_PAGE_SIZE = 20;

type Params = {
  userId?: string;
  effectiveViewMode: 'list' | 'kanban' | 'funnel';
  search: string;
  searchField: 'all' | 'name' | 'phone' | 'email' | 'city' | 'id_number' | 'tags';
  filterType: string;
  showAll: boolean;
  pipelineTab: 'captacion' | 'compradores' | 'cerrados' | 'red';
  stageFilter: string | null;
};

export const useContactsPipeline = ({
  userId,
  effectiveViewMode,
  search,
  searchField,
  filterType,
  showAll,
  pipelineTab,
  stageFilter,
}: Params) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [kanbanContacts, setKanbanContacts] = useState<any[]>([]);
  const [kanbanPage, setKanbanPage] = useState(1);
  const [kanbanTotal, setKanbanTotal] = useState(0);

  const buildQuery = useCallback((searchTerm: string, typeFilterValue: string, showAllContacts: boolean, pipelineTypes?: string[], stage?: string | null) => {
    let query = supabase.from('contacts').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (!showAllContacts && userId) query = query.eq('agent_id', userId);

    const hasSearch = searchTerm && searchTerm.length >= 2;
    if (!hasSearch) {
      if (pipelineTypes && pipelineTypes.length > 0) {
        query = pipelineTypes.length === 1
          ? query.eq('contact_type', pipelineTypes[0] as any)
          : query.in('contact_type', pipelineTypes as any);
      } else if (typeFilterValue !== 'all') {
        query = query.eq('contact_type', typeFilterValue as any);
      }
      if (stage) {
        query = query.eq('pipeline_stage', stage as any);
      }
    }

    if (searchTerm && searchTerm.length >= 2) {
      const term = searchTerm.trim();
      switch (searchField) {
        case 'name':
          query = query.ilike('full_name', `%${term}%`);
          break;
        case 'phone': {
          const digits = term.replace(/\D/g, '');
          const local = digits.replace(/^(00)?34/, '');
          const parts = local.length >= 4
            ? `phone.ilike.%${local}%,phone2.ilike.%${local}%`
            : `phone.ilike.%${digits}%,phone2.ilike.%${digits}%`;
          query = query.or(parts);
          break;
        }
        case 'email':
          query = query.ilike('email', `%${term}%`);
          break;
        case 'city':
          query = query.ilike('city', `%${term}%`);
          break;
        case 'id_number':
          query = query.ilike('id_number', `%${term}%`);
          break;
        case 'tags':
          query = query.contains('tags', [term]);
          break;
        default: {
          const isPhone = /^[\d\s\+\-()]{3,}$/.test(term);
          const isEmail = /@/.test(term);
          if (isPhone) {
            const digits = term.replace(/\D/g, '');
            const local = digits.replace(/^(00)?34/, '');
            query = query.or(`phone.ilike.%${local}%,phone2.ilike.%${local}%`);
          } else if (isEmail) {
            query = query.or(`email.ilike.%${term}%`);
          } else {
            query = query.or(`full_name.ilike.%${term}%,city.ilike.%${term}%,id_number.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
          }
        }
      }
    }

    return query;
  }, [searchField, userId]);

  const fetchContacts = useCallback(async (page = 1) => {
    const from = (page - 1) * CONTACTS_PAGE_SIZE;
    const to = from + CONTACTS_PAGE_SIZE - 1;
    const types = PIPELINE_TYPE_MAP[pipelineTab] ?? ['comprador'];
    const { data, count } = await buildQuery(search, filterType, showAll, types, stageFilter).range(from, to);
    setContacts(data || []);
    setTotalCount(count ?? 0);
  }, [buildQuery, filterType, pipelineTab, search, showAll, stageFilter]);

  const fetchTypeCounts = useCallback(async () => {
    const types = ['comprador', 'ambos', 'propietario', 'prospecto', 'contacto', 'comprador_cerrado', 'vendedor_cerrado', 'colaborador', 'statefox'];
    const typeResults = await Promise.all(
      types.map((type) =>
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('contact_type', type as any).then(({ count }) => ({ type, count: count ?? 0 }))
      )
    );
    const counts: Record<string, number> = {};
    for (const result of typeResults) counts[result.type] = result.count;
    setTypeCounts(counts);
  }, []);

  const fetchKanbanContacts = useCallback(async (page: number) => {
    const types = PIPELINE_TYPE_MAP[pipelineTab] ?? ['comprador'];
    const from = (page - 1) * CONTACTS_PAGE_SIZE;
    const to = from + CONTACTS_PAGE_SIZE - 1;
    let query = supabase.from('contacts').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (!showAll && userId) query = query.eq('agent_id', userId);
    query = types.length === 1 ? query.eq('contact_type', types[0] as any) : query.in('contact_type', types as any);
    const { data, count } = await query.range(from, to);
    setKanbanContacts(data || []);
    setKanbanTotal(count ?? 0);
  }, [pipelineTab, showAll, userId]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const delay = search.length > 0 ? 400 : 0;
    searchDebounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      void fetchContacts(1);
    }, delay);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [fetchContacts, filterType, pipelineTab, search, searchField, showAll, stageFilter]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void fetchContacts(currentPage);
  }, [currentPage, fetchContacts]);

  useEffect(() => {
    void fetchTypeCounts();
  }, [fetchTypeCounts, showAll]);

  useEffect(() => {
    if (effectiveViewMode === 'kanban' || effectiveViewMode === 'funnel') {
      setKanbanPage(1);
      void fetchKanbanContacts(1);
    }
  }, [effectiveViewMode, fetchKanbanContacts, pipelineTab, showAll]);

  useEffect(() => {
    if (effectiveViewMode === 'kanban' || effectiveViewMode === 'funnel') {
      void fetchKanbanContacts(kanbanPage);
    }
  }, [effectiveViewMode, fetchKanbanContacts, kanbanPage]);

  return {
    contacts,
    totalCount,
    currentPage,
    setCurrentPage,
    typeCounts,
    refreshContacts: async () => fetchContacts(currentPage),
    refreshContactsFirstPage: async () => {
      setCurrentPage(1);
      await fetchContacts(1);
    },
    kanbanContacts,
    kanbanPage,
    setKanbanPage,
    kanbanTotal,
    refreshKanban: async () => fetchKanbanContacts(kanbanPage),
    pipelineStages: stagesMap[pipelineTab] || BUYER_STAGES,
  };
};
