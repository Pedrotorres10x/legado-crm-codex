import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyFiltersState } from '@/components/properties/PropertyFilters';

const ITEMS_PER_PAGE = 20;

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

export type PropertiesDataRow = {
  id: string;
  title: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  images: string[] | null;
  mandate_end: string | null;
};

type Params = {
  userId?: string;
  showAll: boolean;
  sourceTab: 'all' | 'propias' | 'office' | 'xml' | 'internacional';
  currentPage: number;
  debouncedSearch: string;
  filters: PropertyFiltersState;
  toast: ToastFn;
};

const coreSelectFields = 'id,title,description,property_type,operation,price,surface_area,built_area,bedrooms,bathrooms,city,province,address,zone,floor_number,energy_cert,has_elevator,has_garage,has_pool,has_terrace,has_garden,features,images,image_order,crm_reference,status,country,is_international,created_at,updated_at,xml_id,source,agent_id,owner_id,mandate_type,mandate_end,reference,latitude,longitude,tags';
const extendedSelectFields = `${coreSelectFields},legal_risk_level,legal_risk_summary,legal_risk_updated_at,legal_risk_docs_count`;

const getOrderConfig = (sortBy: string) => {
  switch (sortBy) {
    case 'price_asc':
      return { column: 'price', ascending: true };
    case 'price_desc':
      return { column: 'price', ascending: false };
    case 'surface_asc':
      return { column: 'surface_area', ascending: true };
    case 'surface_desc':
      return { column: 'surface_area', ascending: false };
    case 'oldest':
      return { column: 'created_at', ascending: true };
    default:
      return { column: 'created_at', ascending: false };
  }
};

export function usePropertiesData({
  userId,
  showAll,
  sourceTab,
  currentPage,
  debouncedSearch,
  filters,
  toast,
}: Params) {
  const [properties, setProperties] = useState<PropertiesDataRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const isClientFiltered = sourceTab === 'internacional';

  const buildPropertiesQuery = useCallback((selectFields: string) => {
    const order = getOrderConfig(filters.sortBy);
    let query = supabase
      .from('properties')
      .select(selectFields, { count: 'exact' })
      .order(order.column, { ascending: order.ascending });

    if (!showAll && userId) {
      query = query.or(`agent_id.eq.${userId},agent_id.is.null`);
    }
    if (sourceTab === 'propias') query = query.is('xml_id', null).or('source.is.null,source.neq.habihub');
    if (sourceTab === 'office') query = query.is('agent_id', null);
    if (sourceTab === 'xml') query = query.not('xml_id', 'is', null);

    if (debouncedSearch && debouncedSearch.length >= 2) {
      const normalizedSearch = debouncedSearch.trim().replace(/[\s-]+/g, '%');
      query = query.or(`title.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%,address.ilike.%${normalizedSearch}%,zone.ilike.%${normalizedSearch}%,city.ilike.%${normalizedSearch}%,reference.ilike.%${normalizedSearch}%,crm_reference.ilike.%${normalizedSearch}%`);
    }

    const {
      filterType,
      filterStatus,
      filterOperation,
      filterLegalRisk,
      filterCohort,
      filterCity,
      filterCountry,
      priceMin,
      priceMax,
      surfaceMin,
      bedroomsMin,
      filterMandate,
    } = filters;

    if (filterType !== 'all') query = query.eq('property_type', filterType);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterOperation !== 'all') query = query.eq('operation', filterOperation);
    if (filterLegalRisk !== 'all' && selectFields.includes('legal_risk_level')) query = query.eq('legal_risk_level', filterLegalRisk);
    if (filterCohort === 'kyero_alicante_50') query = query.contains('tags', ['portal_cohort_alicante_50']);
    if (filterCity) query = query.ilike('city', `%${filterCity}%`);
    if (filterCountry) query = query.ilike('country', `%${filterCountry}%`);
    if (priceMin) query = query.gte('price', parseFloat(priceMin));
    if (priceMax) query = query.lte('price', parseFloat(priceMax));
    if (surfaceMin) query = query.gte('surface_area', parseFloat(surfaceMin));
    if (bedroomsMin && bedroomsMin !== 'any') query = query.gte('bedrooms', parseInt(bedroomsMin));
    if (filterMandate === 'active') query = query.gte('mandate_end', new Date().toISOString().split('T')[0]);
    if (filterMandate === 'expired') query = query.lt('mandate_end', new Date().toISOString().split('T')[0]);
    if (filterMandate === 'no_mandate') query = query.is('mandate_end', null);

    if (!isClientFiltered) {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);
    }

    return query;
  }, [currentPage, debouncedSearch, filters, isClientFiltered, showAll, sourceTab, userId]);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const primary = await buildPropertiesQuery(extendedSelectFields);
      let queryError = primary.error;
      let data = primary.data;
      let count = primary.count;

      if (queryError) {
        console.error('Properties query failed with extended fields', queryError);
        const fallback = await buildPropertiesQuery(coreSelectFields);
        queryError = fallback.error;
        data = fallback.data;
        count = fallback.count;

        if (!queryError) {
          toast({
            title: 'Se cargó una versión reducida de inmuebles',
            description: 'La base no acepta algunos campos avanzados todavía. La lista principal sigue disponible.',
          });
        }
      }

      if (queryError) {
        console.error('Properties query failed', queryError);
        setProperties([]);
        setTotalCount(0);
        toast({
          title: 'No se pudieron cargar los inmuebles',
          description: queryError.message || 'La consulta ha fallado en Supabase.',
          variant: 'destructive',
        });
        return;
      }

      let result = (data || []) as PropertiesDataRow[];
      if (sourceTab === 'internacional') {
        result = result.filter((property) => property.country && property.country !== 'España');
      }

      setProperties(result);
      setTotalCount(isClientFiltered ? result.length : (count || 0));
    } finally {
      setLoading(false);
    }
  }, [buildPropertiesQuery, isClientFiltered, sourceTab, toast]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  return {
    properties,
    totalCount,
    loading,
    isClientFiltered,
    itemsPerPage: ITEMS_PER_PAGE,
    fetchProperties,
  };
}
