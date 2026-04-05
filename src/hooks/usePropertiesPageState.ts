import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyFiltersState } from '@/components/properties/PropertyFilters';

type PropertyLocationOption = {
  city: string | null;
  country: string | null;
};

export type PropertiesSourceTab = 'all' | 'propias' | 'office' | 'xml' | 'internacional';

const VALID_TABS: PropertiesSourceTab[] = ['all', 'propias', 'office', 'xml', 'internacional'];

type Params = {
  canViewAll: boolean;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
};

export function usePropertiesPageState({
  canViewAll,
  searchParams,
  setSearchParams,
}: Params) {
  const [showAll, setShowAll] = useState(canViewAll);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cityPopoverOpen, setCityPopoverOpen] = useState(false);

  const tabFromUrl = searchParams.get('tab') as PropertiesSourceTab | null;
  const [sourceTab, setSourceTab] = useState<PropertiesSourceTab>(
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'all',
  );

  const [filters, setFilters] = useState<PropertyFiltersState>({
    filterType: 'all',
    filterStatus: 'all',
    filterOperation: 'all',
    filterLegalRisk: 'all',
    filterCohort: 'all',
    priceMin: '',
    priceMax: '',
    surfaceMin: '',
    bedroomsMin: 'any',
    filterMandate: 'all',
    sortBy: 'recent',
    filterCity: '',
    filterCountry: '',
  });

  const patchFilters = useCallback((patch: Partial<PropertyFiltersState>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setCurrentPage(1);
  }, []);

  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchText);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const prevTabRef = useRef(sourceTab);

  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchText]);

  useEffect(() => {
    if (!canViewAll && showAll) {
      setShowAll(false);
    }
  }, [canViewAll, showAll]);

  useEffect(() => {
    if (searchParams.get('quickCreate') === '1') {
      setDialogOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (prevTabRef.current !== sourceTab) {
      setCurrentPage(1);
      prevTabRef.current = sourceTab;
    }
  }, [sourceTab]);

  useEffect(() => {
    supabase.from('properties').select('city,country').then(({ data }) => {
      if (!data) return;

      const locationRows = data as PropertyLocationOption[];
      const cities = [...new Set(locationRows.map((row) => row.city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'es'));
      const countries = [...new Set(locationRows.map((row) => row.country).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'es'));
      setAvailableCities(cities);
      setAvailableCountries(countries);
    });
  }, []);

  const selectSourceTab = (key: PropertiesSourceTab) => {
    setSourceTab(key);
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === 'all') next.delete('tab');
      else next.set('tab', key);
      return next;
    }, { replace: true });
  };

  const handlePropertyFormOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && searchParams.get('quickCreate') === '1') {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('quickCreate');
        return next;
      }, { replace: true });
    }
  };

  return {
    showAll,
    setShowAll,
    dialogOpen,
    setDialogOpen,
    aiDialogOpen,
    setAiDialogOpen,
    currentPage,
    setCurrentPage,
    viewMode,
    setViewMode,
    showAdvanced,
    setShowAdvanced,
    cityPopoverOpen,
    setCityPopoverOpen,
    sourceTab,
    selectSourceTab,
    filters,
    patchFilters,
    searchText,
    setSearchText,
    debouncedSearch,
    availableCities,
    availableCountries,
    handlePropertyFormOpenChange,
  };
}
