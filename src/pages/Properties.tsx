import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus, Bot, Building2, Rss, Search, Globe, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ViewToggle from '@/components/ViewToggle';
import AgentFilter from '@/components/AgentFilter';
import AIPropertyCreator from '@/components/AIPropertyCreator';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePropertyHealthColors } from '@/hooks/useHealthColors';
import { PropertyFilters, PropertyFiltersState } from '@/components/properties/PropertyFilters';
import { PropertyForm } from '@/components/properties/PropertyForm';
import { PropertyList } from '@/components/properties/PropertyList';
import { PropertiesStockSummary } from '@/components/properties/PropertiesStockSummary';
import { Skeleton } from '@/components/ui/skeleton';
import DocumentScanner from '@/components/DocumentScanner';
import { ensurePropertyFromDocument } from '@/lib/document-onboarding';
import { useToast } from '@/hooks/use-toast';
import AISectionGuide from '@/components/ai/AISectionGuide';

const ITEMS_PER_PAGE = 20;

const Properties = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Data
  const [properties, setProperties] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showAll, setShowAll] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cityPopoverOpen, setCityPopoverOpen] = useState(false);
  const validTabs = ['all','propias','office','xml','internacional'] as const;
  const tabFromUrl = searchParams.get('tab') as typeof validTabs[number] | null;
  const [sourceTab, setSourceTab] = useState<typeof validTabs[number]>(
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'all'
  );

  // Filters
  const [filters, setFilters] = useState<PropertyFiltersState>({
    filterType: 'all', filterStatus: 'all', filterOperation: 'all',
    filterLegalRisk: 'all',
    priceMin: '', priceMax: '', surfaceMin: '', bedroomsMin: 'any',
    filterMandate: 'all', sortBy: 'recent', filterCity: '', filterCountry: '',
  });

  const patchFilters = useCallback((patch: Partial<PropertyFiltersState>) => {
    setFilters(f => ({ ...f, ...patch }));
    setCurrentPage(1);
  }, []);

  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchText);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search text by 400ms
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchText]);

  // Map sortBy to Supabase order
  const getOrderConfig = useCallback((sortBy: string) => {
    switch (sortBy) {
      case 'price_asc': return { column: 'price', ascending: true };
      case 'price_desc': return { column: 'price', ascending: false };
      case 'surface_asc': return { column: 'surface_area', ascending: true };
      case 'surface_desc': return { column: 'surface_area', ascending: false };
      case 'oldest': return { column: 'created_at', ascending: true };
      default: return { column: 'created_at', ascending: false };
    }
  }, []);

  // Whether this tab requires client-side filtering (can't paginate server-side)
  const isClientFiltered = sourceTab === 'internacional';

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const order = getOrderConfig(filters.sortBy);
      const selectFields = 'id,title,description,property_type,operation,price,surface_area,built_area,bedrooms,bathrooms,city,province,address,zone,floor_number,energy_cert,has_elevator,has_garage,has_pool,has_terrace,has_garden,features,images,image_order,crm_reference,status,country,is_international,created_at,updated_at,xml_id,source,agent_id,owner_id,mandate_type,mandate_end,reference,latitude,longitude,legal_risk_level,legal_risk_summary,legal_risk_updated_at,legal_risk_docs_count';

      let query = supabase
        .from('properties')
        .select(selectFields, { count: 'exact' })
        .order(order.column, { ascending: order.ascending });

      if (!showAll && user?.id) {
        query = query.or(`agent_id.eq.${user.id},agent_id.is.null`);
      }
      if (sourceTab === 'propias') query = query.is('xml_id', null).or('source.is.null,source.neq.habihub');
      if (sourceTab === 'office') query = query.is('agent_id', null);
      if (sourceTab === 'xml') query = query.not('xml_id', 'is', null);

      // Text search
      if (debouncedSearch && debouncedSearch.length >= 2) {
        const normalizedSearch = debouncedSearch.trim().replace(/[\s\-]+/g, '%');
        query = query.or(`title.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%,address.ilike.%${normalizedSearch}%,zone.ilike.%${normalizedSearch}%,city.ilike.%${normalizedSearch}%,reference.ilike.%${normalizedSearch}%,crm_reference.ilike.%${normalizedSearch}%`);
      }

      {
        const { filterType, filterStatus, filterOperation, filterLegalRisk, filterCity, filterCountry, priceMin, priceMax, surfaceMin, bedroomsMin, filterMandate } = filters;
        if (filterType !== 'all') query = query.eq('property_type', filterType as any);
        if (filterStatus !== 'all') query = query.eq('status', filterStatus as any);
        if (filterOperation !== 'all') query = query.eq('operation', filterOperation as any);
        if (filterLegalRisk !== 'all') query = query.eq('legal_risk_level', filterLegalRisk);
        if (filterCity) query = query.ilike('city', `%${filterCity}%`);
        if (filterCountry) query = query.ilike('country', `%${filterCountry}%`);
        if (priceMin) query = query.gte('price', parseFloat(priceMin));
        if (priceMax) query = query.lte('price', parseFloat(priceMax));
        if (surfaceMin) query = query.gte('surface_area', parseFloat(surfaceMin));
        if (bedroomsMin && bedroomsMin !== 'any') query = query.gte('bedrooms', parseInt(bedroomsMin));
        if (filterMandate === 'active') query = query.gte('mandate_end', new Date().toISOString().split('T')[0]);
        if (filterMandate === 'expired') query = query.lt('mandate_end', new Date().toISOString().split('T')[0]);
        if (filterMandate === 'no_mandate') query = query.is('mandate_end', null);
      }

      // Server-side pagination only for non-client-filtered tabs
      if (!isClientFiltered) {
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);
      }

      const { data, count } = await query;
      let result = data || [];

      // Client-side filters for special tabs
      if (sourceTab === 'internacional') {
        result = result.filter(p => p.country && p.country !== 'España');
      }
      setProperties(result);
      setTotalCount(isClientFiltered ? result.length : (count || 0));
    } finally {
      setLoading(false);
    }
  }, [showAll, user?.id, filters, debouncedSearch, sourceTab, currentPage, isClientFiltered, getOrderConfig]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  useEffect(() => {
    if (searchParams.get('quickCreate') === '1') {
      setDialogOpen(true);
    }
  }, [searchParams]);

  // Reset page on filter/tab change (but not on page change itself)
  const prevTabRef = useRef(sourceTab);
  useEffect(() => {
    if (prevTabRef.current !== sourceTab) {
      setCurrentPage(1);
      prevTabRef.current = sourceTab;
    }
  }, [sourceTab]);

  const healthColors = usePropertyHealthColors(properties);
  const weakListingCount = useMemo(
    () => properties.filter((property: any) => !(property.images?.length > 0) || !property.description).length,
    [properties],
  );
  const expiredMandateCount = useMemo(
    () =>
      properties.filter((property: any) => property.mandate_end && new Date(property.mandate_end) < new Date()).length,
    [properties],
  );

  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  useEffect(() => {
    supabase.from('properties').select('city,country').then(({ data }) => {
      if (data) {
        const cities = [...new Set(data.map((r: any) => r.city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'es'));
        const countries = [...new Set(data.map((r: any) => r.country).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'es'));
        setAvailableCities(cities);
        setAvailableCountries(countries);
      }
    });
  }, []);

  const effectiveViewMode = isMobile ? 'mobile' : viewMode;

  const handleAutoCreatePropertyFromDocument = async (data: any) => {
    try {
      const result = await ensurePropertyFromDocument(data, user?.id);
      toast({
        title: result.created ? 'Inmueble creado desde documento' : 'Inmueble ya existente',
        description: result.ownerReconciliation?.missing?.length
          ? `Se han detectado ${result.ownerReconciliation.missing.length} titular(es) que aun faltan en CRM.`
          : result.created
            ? 'La nota simple/escritura ha generado el alta automatica.'
            : 'He reutilizado el inmueble existente para evitar duplicados.',
      });
      navigate(`/properties/${result.propertyId}`);
    } catch (error: any) {
      toast({
        title: 'No se pudo dar de alta el inmueble',
        description: error.message || 'Faltan datos suficientes en el documento.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <AISectionGuide
        title="Inmuebles: aqui conviertes captacion en producto vendible"
        context="Aqui conviertes relaciones y captacion en producto vendible. La vivienda es el vehiculo; el negocio venia de la persona que confio en nosotros."
        doNow={`Ahora mismo tienes ${weakListingCount} ficha${weakListingCount === 1 ? '' : 's'} floja${weakListingCount === 1 ? '' : 's'} y ${expiredMandateCount} mandato${expiredMandateCount === 1 ? '' : 's'} vencido${expiredMandateCount === 1 ? '' : 's'}. Empieza por lo que bloquea venta hoy.`}
        dontForget="Prospecto es el dueno sin firmar. La exclusiva se gana primero en la confianza con la persona; luego la vivienda se trabaja para venderla bien."
        risk="Una vivienda mal trabajada genera menos confianza, peores visitas, menos ofertas y menos arras."
        actions={[
          { label: 'Que hago primero aqui', description: 'Mira stock flojo, mandatos vencidos y fichas sin fotos o sin difusion.' },
          { label: 'Que no olvidar nunca', description: 'Si el propietario no confia en ti, discutir solo el producto te convierte en uno mas y te lleva a pelear precio y honorarios.' },
          { label: 'Cuando una vivienda ya esta lista', description: 'Cuando tiene buena ficha, buen precio, material visual y base legal suficiente para venderla.' },
          { label: 'Que error evitar', description: 'Dar de alta y olvidarte. Alta rapida sirve para no perder la oportunidad; completar ficha es lo que te hace vender.' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Inmuebles</h1>
          <p className="text-sm text-muted-foreground">{totalCount} propiedades en cartera</p>
        </div>
        {!isMobile && (
          <div className="flex gap-2">
            <ViewToggle view={viewMode} onViewChange={setViewMode} />
            <AgentFilter showAll={showAll} onToggle={setShowAll} />
            <DocumentScanner context="property" buttonLabel="Alta por Nota Simple" onExtracted={handleAutoCreatePropertyFromDocument} />
            <Button variant="outline" onClick={() => setAiDialogOpen(true)} className="hover-lift">
              <Bot className="h-4 w-4 mr-2" />Crear con IA
            </Button>
            <Button onClick={() => setDialogOpen(true)} style={{ background: 'var(--gradient-primary)' }} className="hover-lift">
              <Plus className="h-4 w-4 mr-2" />Añadir Inmueble
            </Button>
          </div>
        )}
      </div>

      {/* Source tabs (desktop only) */}
      {!isMobile && (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-max md:w-fit">
            {([
              { key: 'all', label: 'Todos', icon: null },
              { key: 'propias', label: 'Propias', icon: Home },
              { key: 'office', label: 'Oficina', icon: Building2 },
              { key: 'xml', label: 'Feed XML', icon: Rss },
              { key: 'internacional', label: 'Intl.', icon: Globe },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => {
                  setSourceTab(key);
                  setCurrentPage(1);
                  setSearchParams(prev => {
                    const next = new URLSearchParams(prev);
                    if (key === 'all') next.delete('tab'); else next.set('tab', key);
                    return next;
                  }, { replace: true });
                }}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${
                  sourceTab === key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Buscar..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
      </div>

      {/* Filters (desktop only) */}
      {!isMobile && <PropertyFilters
        filters={filters}
        onFiltersChange={patchFilters}
        availableCities={availableCities}
        availableCountries={availableCountries}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(v => !v)}
        cityPopoverOpen={cityPopoverOpen}
        onCityPopoverChange={setCityPopoverOpen}
      />}

      {!loading && !isMobile && properties.length > 0 && (
        <PropertiesStockSummary properties={properties} />
      )}

      {/* Property list */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <PropertyList
          properties={properties}
          healthColors={healthColors}
          viewMode={effectiveViewMode}
          currentPage={isClientFiltered ? currentPage : 1}
          totalCount={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
          serverPaginated={!isClientFiltered}
          onPageChange={setCurrentPage}
          onRemoved={fetchProperties}
        />
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <button
          onClick={() => setDialogOpen(true)}
          className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 4px 20px hsl(var(--primary) / 0.4)' }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* New property form */}
      <PropertyForm
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open && searchParams.get('quickCreate') === '1') {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('quickCreate');
              return next;
            }, { replace: true });
          }
        }}
        onCreated={fetchProperties}
      />

      {/* AI property creator */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Crear inmueble con IA
            </DialogTitle>
          </DialogHeader>
          <AIPropertyCreator
            onCreated={(id) => { setAiDialogOpen(false); navigate(`/properties/${id}`); }}
            onCancel={() => setAiDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Properties;
