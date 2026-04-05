import { useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePropertiesData } from '@/hooks/usePropertiesData';
import { usePropertyHealthColors } from '@/hooks/useHealthColors';
import { usePropertiesPageState } from '@/hooks/usePropertiesPageState';
import PropertiesAiCreateDialog from '@/components/properties/PropertiesAiCreateDialog';
import { PropertyForm } from '@/components/properties/PropertyForm';
import PropertiesHeader from '@/components/properties/PropertiesHeader';
import { PropertyList } from '@/components/properties/PropertyList';
import PropertiesMobileFab from '@/components/properties/PropertiesMobileFab';
import PropertiesSearchFilters from '@/components/properties/PropertiesSearchFilters';
import { PropertiesStockSummary } from '@/components/properties/PropertiesStockSummary';
import PropertiesSourceTabs from '@/components/properties/PropertiesSourceTabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ensurePropertyFromDocument } from '@/lib/document-onboarding';
import { useToast } from '@/hooks/use-toast';
import AISectionGuide from '@/components/ai/AISectionGuide';

const ITEMS_PER_PAGE = 20;

const Properties = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, canViewAll } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const {
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
  } = usePropertiesPageState({
    canViewAll,
    searchParams,
    setSearchParams,
  });
  const {
    properties,
    totalCount,
    loading,
    isClientFiltered,
    itemsPerPage,
    fetchProperties,
  } = usePropertiesData({
    userId: user?.id,
    showAll,
    sourceTab,
    currentPage,
    debouncedSearch,
    filters,
    toast,
  });

  const healthColors = usePropertyHealthColors(properties);
  const weakListingCount = useMemo(
    () => properties.filter((property) => !(property.images?.length > 0) || !property.description).length,
    [properties],
  );
  const expiredMandateCount = useMemo(
    () =>
      properties.filter((property) => property.mandate_end && new Date(property.mandate_end) < new Date()).length,
    [properties],
  );

  const effectiveViewMode = isMobile ? 'mobile' : viewMode;

  const handleAutoCreatePropertyFromDocument = async (data: unknown) => {
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
    } catch (error: unknown) {
      toast({
        title: 'No se pudo dar de alta el inmueble',
        description: error instanceof Error ? error.message : 'Faltan datos suficientes en el documento.',
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

      <PropertiesHeader
        totalCount={totalCount}
        isMobile={isMobile}
        viewMode={viewMode}
        setViewMode={setViewMode}
        showAll={showAll}
        setShowAll={setShowAll}
        onAutoCreateFromDocument={handleAutoCreatePropertyFromDocument}
        onOpenAiDialog={() => setAiDialogOpen(true)}
        onOpenCreateDialog={() => setDialogOpen(true)}
      />

      <PropertiesSourceTabs
        isMobile={isMobile}
        sourceTab={sourceTab}
        onSelectTab={selectSourceTab}
      />

      <PropertiesSearchFilters
        isMobile={isMobile}
        searchText={searchText}
        setSearchText={setSearchText}
        filters={filters}
        onFiltersChange={patchFilters}
        availableCities={availableCities}
        availableCountries={availableCountries}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
        cityPopoverOpen={cityPopoverOpen}
        onCityPopoverChange={setCityPopoverOpen}
      />

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
          itemsPerPage={itemsPerPage}
          serverPaginated={!isClientFiltered}
          onPageChange={setCurrentPage}
          onRemoved={fetchProperties}
        />
      )}

      <PropertiesMobileFab isMobile={isMobile} onOpenCreate={() => setDialogOpen(true)} />

      {/* New property form */}
      <PropertyForm
        open={dialogOpen}
        onOpenChange={handlePropertyFormOpenChange}
        onCreated={fetchProperties}
      />

      <PropertiesAiCreateDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onCreated={(id) => navigate(`/properties/${id}`)}
      />
    </div>
  );
};

export default Properties;
