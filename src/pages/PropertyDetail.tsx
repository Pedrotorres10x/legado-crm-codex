import { lazy, Suspense, useEffect, useState, useRef, useCallback, type CSSProperties } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePropertyCatastro } from '@/hooks/usePropertyCatastro';
import { usePropertyDetailCore } from '@/hooks/usePropertyDetailCore';
import { usePropertyDetailRelatedData } from '@/hooks/usePropertyDetailRelatedData';
import { usePropertyMediaManager } from '@/hooks/usePropertyMediaManager';
import { hapticLight } from '@/lib/haptics';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as AccordionUI from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, MapPin, BedDouble, Bath, Maximize, Upload, Image, Video,
  Globe, Trash2, Loader2, X, ChevronLeft, ChevronRight, ChevronDown, MapPinned,
  Share2, Copy, ExternalLink, Zap, User,
  Plus, Eye, EyeOff, Key, Home, Rss
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import MandateSection from '@/components/MandateSection';
import InternalComments from '@/components/InternalComments';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import PhoneLink from '@/components/PhoneLink';
import ChangeRequestButton from '@/components/ChangeRequestButton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCoverImage } from '@/lib/get-cover-image';
import ArrasBuyerField from '@/components/ArrasBuyerField';
import PropertyBusinessPanel from '@/components/properties/PropertyBusinessPanel';
import PropertyBasicsPanel from '@/components/properties/PropertyBasicsPanel';
import PropertyCommercialActivityPanel from '@/components/properties/PropertyCommercialActivityPanel';
import PropertyDetailAnomalyBanner from '@/components/properties/PropertyDetailAnomalyBanner';
import PropertyDetailHero from '@/components/properties/PropertyDetailHero';
import PropertyDetailMetrics from '@/components/properties/PropertyDetailMetrics';
import PropertyDetailWebCard from '@/components/properties/PropertyDetailWebCard';
import PropertyExtendedMediaPanel from '@/components/properties/PropertyExtendedMediaPanel';
import PropertyOwnerActionsPanel from '@/components/properties/PropertyOwnerActionsPanel';
import PropertyPhotosPanel from '@/components/properties/PropertyPhotosPanel';
import PropertyStakeholdersPanel from '@/components/properties/PropertyStakeholdersPanel';
import PropertyVisitSheetDialog from '@/components/properties/PropertyVisitSheetDialog';
import AISectionGuide from '@/components/ai/AISectionGuide';
import { commitClosingFieldUpdates } from '@/lib/closing-workflow';
import { sanitizePropertyTitle } from '@/lib/property-text';
import {
  buildImageOrderUpdatePayload,
  buildPropertyMediaCollections,
  getEstanciaGroup,
  getPropertyImageSource,
  removeDeletedImagesFromProperty,
  type PropertyImageOrderEntry,
} from '@/lib/property-detail-media';

const DocumentScanner = lazy(() => import('@/components/DocumentScanner'));
const ClosingWorkflow = lazy(() => import('@/components/ClosingWorkflow'));
const PropertyDocumentsSection = lazy(() => import('@/components/PropertyDocumentsSection'));
const DocumentRelationsPanel = lazy(() => import('@/components/DocumentRelationsPanel'));

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// ── Validación de valor de planta ───────────────────────────────────────────
const validateFloorNumber = (value: string): string | null => {
  if (!value?.trim()) return null;
  const v = value.trim();
  const numMatch = v.match(/^(\d+)[ºª]?$/);
  if (numMatch) {
    const n = parseInt(numMatch[1]);
    if (n > 50) return `Planta "${v}" parece incorrecta (¿concatenación planta+puerta?)`;
    return null;
  }
  // Cadena numérica larga que parece planta+puerta pegados: "211ª", "211A"
  if (/^\d{3,}/.test(v) && parseInt(v) > 50) {
    return `"${v}" parece una concatenación planta+puerta. Corrígelo manualmente.`;
  }
  return null;
};

const statusLabels: Record<string, string> = { disponible: 'Disponible', arras: 'Arras', vendido: 'Vendido', no_disponible: 'No disponible', reservado: 'Reservado', alquilado: 'Alquilado', retirado: 'Retirado' };
const statusColors: Record<string, string> = { disponible: 'bg-success', arras: 'bg-warning', vendido: 'bg-primary', no_disponible: 'bg-muted', reservado: 'bg-warning', alquilado: 'bg-info', retirado: 'bg-muted' };

type PropertyDetailProperty = NonNullable<ReturnType<typeof usePropertyDetailCore>['property']>;
type PropertyUpdater = (updater: (prev: PropertyDetailProperty) => PropertyDetailProperty) => void;
type PropertyDocumentExtracted = {
  property_address?: string;
  property_city?: string;
  property_province?: string;
  property_zip_code?: string;
  property_type?: string;
  cadastral_reference?: string;
  surface_area?: number;
  built_area?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: string;
  price?: number;
  energy_cert?: string;
  property_description?: string;
};

function getPropertyOriginBadge(property: Pick<PropertyDetailProperty, 'source' | 'source_feed_name' | 'source_metadata'> | null | undefined) {
  const source = String(property?.source || '').toLowerCase();
  const sourceFeedName = String(property?.source_feed_name || '').toLowerCase();
  const legacyOrigin = String(property?.source_metadata?.legacy_origin || '').toLowerCase();

  if (source === 'habihub' || sourceFeedName.includes('habihub')) {
    return {
      label: 'HabiHub',
      className: 'border-orange-400/60 text-orange-600 bg-orange-50',
      icon: Rss,
    };
  }

  if (source === 'legacy-crm' || legacyOrigin) {
    return {
      label: 'CRM original',
      className: 'border-sky-400/60 text-sky-700 bg-sky-50',
      icon: Globe,
    };
  }

  return {
    label: 'Manual',
    className: 'border-slate-300 text-slate-600 bg-slate-50',
    icon: Home,
  };
}

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isAdmin, isCoordinadora, canViewAll, user } = useAuth();
  const isMobile = useIsMobile();
  // Si venimos desde el buscador global, preservamos el query para el breadcrumb
  const fromSearch = (location.state as { fromSearch?: string } | null)?.fromSearch;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closingSectionRef = useRef<HTMLDivElement>(null);
  const expedienteSectionRef = useRef<HTMLDivElement>(null);

  const {
    property,
    setProperty,
    loading,
    uploading,
    mediaFiles,
    virtualTour,
    setVirtualTour,
    savingTour,
    saveField,
    commitReadyPropertyRef: propertyRef,
    fetchProperty,
    fetchMedia,
    syncCatastroSnapshot,
    logMediaAccess,
    uploadFiles,
    deleteFile,
    saveVirtualTour,
    disableAutoSync,
  } = usePropertyDetailCore({
    id,
    userId: user?.id,
    toast,
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [commissionMode, setCommissionMode] = useState<'fixed' | 'pct'>('fixed');
  const [commissionPctInput, setCommissionPctInput] = useState('');
  const [featureInput, setFeatureInput] = useState('');
  const [popularFeatures, setPopularFeatures] = useState<string[]>([]);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());
  const [visitSheetDialogOpen, setVisitSheetDialogOpen] = useState(false);
  const {
    propertyMatches,
    propertyVisits,
    ownerContact,
    propertyOwners,
    agentProfile,
    propertyOffers,
    anomalyNotifications,
    dismissAnomaly: dismissStoredAnomaly,
    fetchMatches,
    fetchVisits,
    fetchOwnerAndOffers,
    fetchAnomalyNotifications,
  } = usePropertyDetailRelatedData(id);
  const {
    catastroLoading,
    catastroResults,
    catastroDialogOpen,
    setCatastroDialogOpen,
    referenceInput,
    setReferenceInput,
    savingRef,
    lookupByAddress,
    lookupByReference,
    saveReference,
    selectCatastroResult,
  } = usePropertyCatastro({
    id,
    property,
    toast,
    onPropertyRefresh: fetchProperty,
    onSyncSnapshot: syncCatastroSnapshot,
  });

  const propertyTypes = ['piso', 'casa', 'chalet', 'adosado', 'atico', 'duplex', 'estudio', 'local', 'oficina', 'nave', 'terreno', 'garaje', 'trastero', 'otro'] as const;
  const operationTypes = ['venta', 'alquiler', 'ambas'] as const;
  const statusOptions = ['disponible', 'arras', 'vendido', 'no_disponible', 'reservado', 'alquilado', 'retirado'] as const;

  useEffect(() => {
    if (!property || !location.hash) return;

    const targetRef =
      location.hash === '#cierre'
        ? closingSectionRef
        : location.hash === '#expediente'
          ? expedienteSectionRef
          : null;

    if (!targetRef?.current) return;

    const timeoutId = window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [property, location.hash]);

  const commitClosingField = useCallback((updates: Record<string, unknown>) => {
    commitClosingFieldUpdates(setProperty, saveField, updates);
  }, [saveField, setProperty]);

  const fetchPopularFeatures = useCallback(async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'popular_features').single();
    if (data?.value) {
      const val = data.value as { popular_extras?: Array<{ name?: string }> };
      setPopularFeatures((val.popular_extras || []).map((e) => e.name || '').filter(Boolean));
    }
  }, []);

  const dismissAnomaly = useCallback(async (notifId: string) => {
    setDismissedAnomalies(prev => new Set(prev).add(notifId));
    void dismissStoredAnomaly(notifId);
  }, [dismissStoredAnomaly]);

  const handleMatchStatusChange = useCallback(async (matchId: string, status: string) => {
    await supabase.from('matches').update({ status }).eq('id', matchId);
    fetchMatches();
    toast({ title: 'Estado actualizado' });
  }, [fetchMatches, toast]);


  useEffect(() => {
    fetchProperty(); fetchMedia(); fetchPopularFeatures();
    if (id && user) logMediaAccess('view_gallery');
  }, [fetchMedia, fetchPopularFeatures, fetchProperty, id, logMediaAccess, user]);

  // Build ordered images list using image_order metadata
  const imageOrder: PropertyImageOrderEntry[] = property?.image_order || [];
  const { images, videos } = buildPropertyMediaCollections({
    supabaseUrl: SUPABASE_URL,
    propertyId: id!,
    propertyImages: property?.images || [],
    propertyVideos: property?.videos || [],
    imageOrder,
    mediaFiles,
  });

  const {
    editingLabel,
    setEditingLabel,
    editingLabelValue,
    setEditingLabelValue,
    dragIndex,
    setDragIndex,
    dragOverIndex,
    setDragOverIndex,
    photoOrderOpen,
    setPhotoOrderOpen,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    saveImageOrder,
    moveImage,
    handleDragDrop,
    updateImageLabel,
    applyDefaultOrder,
    bulkDeletePhotos,
  } = usePropertyMediaManager({
    propertyId: id!,
    supabaseUrl: SUPABASE_URL,
    images,
    mediaFiles,
    propertyRef,
    disableAutoSync,
    saveField,
    fetchMedia,
    toast,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Propiedad no encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/properties')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Volver
        </Button>
      </div>
    );
  }

  const originBadge = getPropertyOriginBadge(property);
  const safeTitle = sanitizePropertyTitle(property.title);
  const OriginIcon = originBadge.icon;
  const canSeePropertyContactData = canViewAll || property.agent_id === user?.id;
  const visibleAnomalies = anomalyNotifications.filter(n => !dismissedAnomalies.has(n.id));
  const propertyIssueCount = [
    !(property.images?.length > 0),
    !property.description,
    !property.price,
    !property.mandate_type,
    !!(property.mandate_end && new Date(property.mandate_end) < new Date()),
  ].filter(Boolean).length;
  const sectionFallback = (
    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Cargando seccion...
    </div>
  );
  const isPublished = ['disponible', 'reservado'].includes(property.status);
  const hasCommercialAssets = Boolean(property.images?.length);
  const hasCommercialDescription = Boolean(property.description?.trim());
  const hasCommercialPrice = Boolean(property.price && Number(property.price) > 0);
  const hasMandate = Boolean(property.mandate_type);
  const hasOwners = propertyOwners.length > 0;
  const documentsReady = propertyIssueCount === 0;
  const scrollToElement = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const publicationBlockers = [
    !hasCommercialAssets ? 'Subir fotos y material visual' : null,
    !hasCommercialDescription ? 'Completar la descripcion comercial' : null,
    !hasCommercialPrice ? 'Definir precio de salida' : null,
    !hasMandate ? 'Revisar mandato o exclusividad' : null,
    canSeePropertyContactData && !hasOwners ? 'Vincular propietario principal' : null,
  ].filter(Boolean) as string[];

  const commercialBlockers = [
    isPublished && propertyVisits.length === 0 ? 'Registrar la primera visita en CRM' : null,
    isPublished && propertyOffers.length === 0 ? 'Todavia no hay ofertas registradas' : null,
    propertyMatches.length === 0 ? 'Sin cruces activos ahora mismo' : null,
  ].filter(Boolean) as string[];

  const topBlockers = [...publicationBlockers, ...commercialBlockers].slice(0, 3);

  const primaryAction = (() => {
    if (publicationBlockers.length > 0) {
      return {
        label: 'Preparar para publicar',
        description: 'Antes de mover esta vivienda, cierra lo que hoy la deja floja o incompleta.',
        onClick: () => {
          if (!hasCommercialAssets) {
            scrollToElement('fotos');
            return;
          }
          if (!hasCommercialDescription || !hasCommercialPrice) {
            scrollToElement('ficha');
            return;
          }
          if (!hasMandate) {
            scrollToElement('mandato');
            return;
          }
          scrollToElement('ficha');
        },
      };
    }

    if (canSeePropertyContactData && isPublished) {
      return {
        label: 'Enviar hoja de visita',
        description: 'Deja preparada la siguiente visita con una constancia clara para el cliente.',
        onClick: () => setVisitSheetDialogOpen(true),
      };
    }

    if (canSeePropertyContactData && ['arras', 'vendido'].includes(property.status)) {
      return {
        label: 'Ir a cierre',
        description: 'Este inmueble ya esta entrando en cierre. Revisa firma, documentos y el siguiente hito.',
        onClick: () => closingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      };
    }

    if (propertyMatches.length > 0) {
      return {
        label: 'Ver cruces activos',
        description: 'Ya hay compradores compatibles. Lo siguiente es trabajar esos cruces con foco.',
        onClick: () => navigate(`/matches?property_id=${id}`),
      };
    }

    return {
      label: 'Revisar documentación',
      description: 'Empieza por el expediente para asegurarte de que el inmueble esta realmente listo.',
      onClick: () => expedienteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    };
  })();

  return (
    <div className="space-y-6">
      <PropertyDetailAnomalyBanner anomalies={visibleAnomalies} onDismiss={dismissAnomaly} />

      <PropertyDetailHero
        property={property}
        safeTitle={safeTitle}
        originBadge={originBadge}
        statusLabels={statusLabels}
        statusColors={statusColors}
        isMobile={isMobile}
        fromSearch={fromSearch}
        canSeePropertyContactData={canSeePropertyContactData}
        propertyOwnersCount={propertyOwners.length}
        isPublished={isPublished}
        propertyTypes={propertyTypes}
        operationTypes={operationTypes}
        statusOptions={statusOptions}
        primaryAction={primaryAction}
        topBlockers={topBlockers}
        propertyId={id!}
        onBack={() => navigate(-1)}
        onNavigateOwner={() => {
          hapticLight();
          navigate(`/contacts/${property.owner_id}`);
        }}
        onOpenMatches={() => {
          hapticLight();
          navigate(`/matches?property_id=${id}`);
        }}
        onOpenVisitSheet={() => setVisitSheetDialogOpen(true)}
        onOpenFicha={() => scrollToElement('ficha')}
        onOpenExpediente={() => scrollToElement('expediente')}
        onTitleChange={(event) => setProperty(((prev: PropertyDetailProperty) => ({ ...prev, title: event.target.value })) as Parameters<PropertyUpdater>[0])}
        onTitleBlur={() => saveField({ title: property.title })}
        onSaveStatus={(value) => saveField({ status: value })}
        onTogglePublished={() => saveField({ status: isPublished ? 'no_disponible' : 'disponible' })}
        onSaveAutoMatch={async (checked) => {
          await saveField({ auto_match: checked });
        }}
        onSavePropertyType={(value) => saveField({ property_type: value })}
        onSaveSecondaryPropertyType={(value) => saveField({ secondary_property_type: value === '_none' ? null : value })}
        onSaveOperation={(value) => saveField({ operation: value })}
        scannerAction={(
          <Suspense fallback={sectionFallback}>
            <DocumentScanner
              context="property"
              onExtracted={async (data) => {
                const extracted = data as PropertyDocumentExtracted;
                const updates: Record<string, string | number> = {};
                if (extracted.property_address) updates.address = extracted.property_address;
                if (extracted.property_city) updates.city = extracted.property_city;
                if (extracted.property_province) updates.province = extracted.property_province;
                if (extracted.property_zip_code) updates.zip_code = extracted.property_zip_code;
                if (extracted.property_type) updates.property_type = extracted.property_type;
                if (extracted.cadastral_reference) updates.reference = extracted.cadastral_reference;
                if (extracted.surface_area) updates.surface_area = extracted.surface_area;
                if (extracted.built_area) updates.built_area = extracted.built_area;
                if (extracted.bedrooms) updates.bedrooms = extracted.bedrooms;
                if (extracted.bathrooms) updates.bathrooms = extracted.bathrooms;
                if (extracted.floor) updates.floor_number = extracted.floor;
                if (extracted.price) updates.price = extracted.price;
                if (extracted.energy_cert) updates.energy_cert = extracted.energy_cert;
                if (extracted.property_description) updates.description = extracted.property_description;
                if (Object.keys(updates).length > 0) {
                  await supabase.from('properties').update(updates).eq('id', id!);
                  fetchProperty();
                }
              }}
            />
          </Suspense>
        )}
        ownerActions={canSeePropertyContactData ? (
          <PropertyOwnerActionsPanel
            property={property}
            propertyId={id!}
            isAdmin={isAdmin}
            compact
            onRefreshProperty={fetchProperty}
            onDeleteSuccess={() => navigate('/properties')}
          />
        ) : undefined}
      />

      {canSeePropertyContactData && (
        <PropertyVisitSheetDialog
          open={visitSheetDialogOpen}
          onOpenChange={setVisitSheetDialogOpen}
          propertyId={property.id}
          propertyTitle={safeTitle}
          propertyAddress={property.address}
          agentId={user?.id}
          canViewAll={canViewAll}
          viewerUserId={user?.id}
          onCreated={fetchVisits}
        />
      )}

      <PropertyDetailMetrics
        visitsCount={propertyVisits.length}
        offersCount={propertyOffers.length}
        matchesCount={propertyMatches.length}
        hasMandate={hasMandate}
        documentsReady={documentsReady}
        propertyIssueCount={propertyIssueCount}
      />

      <AISectionGuide
        title={`Ficha de ${safeTitle}`}
        context="Aqui conviertes esta vivienda en producto real: bien captado, bien presentado, bien documentado y listo para vender."
        doNow={`Esta ficha tiene ${propertyIssueCount} hueco${propertyIssueCount === 1 ? '' : 's'} comercial${propertyIssueCount === 1 ? '' : 'es'}, ${propertyVisits.length} visita${propertyVisits.length === 1 ? '' : 's'} y ${propertyOffers.length} oferta${propertyOffers.length === 1 ? '' : 's'}. Empieza por lo que bloquea venta o captacion ahora mismo.`}
        dontForget="Una vivienda no se vende solo por existir en CRM. Se vende si esta bien trabajada, bien explicada y sin agujeros comerciales o legales."
        risk="Si esta ficha sigue floja, haras peores visitas, menos ofertas y el propietario confiara menos en el trabajo."
        actions={[
          { label: 'Que haria un buen agente aqui', description: 'Completar primero lo que bloquea: precio, fotos, descripcion, mandato y siguiente paso comercial.' },
          { label: 'Que mira direccion aqui', description: 'Si esta propiedad esta realmente vendible o solo dada de alta.' },
          { label: 'Que error evitar', description: 'Confundir alta rapida con ficha terminada. Lo primero evita perderla; lo segundo es lo que la vende.' },
        ]}
      />

      <PropertyDetailWebCard
        property={property}
        propertyId={id!}
        supabaseUrl={SUPABASE_URL}
        onToast={(title, description) => toast({ title, description })}
      />

      {canSeePropertyContactData ? (
        <PropertyStakeholdersPanel
          property={property}
          propertyOwners={propertyOwners}
          agentProfile={agentProfile}
          propertyVisits={propertyVisits}
          propertyOffers={propertyOffers}
          propertyMatches={propertyMatches}
          isAdmin={isAdmin}
          onNavigateContact={(contactId) => navigate(`/contacts/${contactId}`)}
          onRefreshOwnersOffers={fetchOwnerAndOffers}
          onSaveField={saveField}
        />
      ) : (
        <Card className="animate-fade-in-up border border-primary/15 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold">Ficha visible sin datos de contacto</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Puedes trabajar el inmueble y ver su producto, pero los datos de propietario, comprador y relaciones quedan ocultos porque no es una captación tuya.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key location */}
      <Card className="animate-fade-in-up">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Acceso / Llaves</Label>
              <Select value={property.key_location || 'oficina'} onValueChange={v => saveField({ key_location: v })}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oficina">🔑 Llaves en oficina</SelectItem>
                  <SelectItem value="propietario">🏠 Vive el propietario (llamar antes)</SelectItem>
                  <SelectItem value="inquilino">👤 Vive inquilino (llamar antes)</SelectItem>
                  <SelectItem value="caja_seguridad">📦 Caja de seguridad</SelectItem>
                  <SelectItem value="portero">🚪 Portero / Conserje</SelectItem>
                  <SelectItem value="otro">📋 Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div id="ficha">
        <PropertyBasicsPanel
          property={property}
          propertyId={id}
          saveField={saveField}
          setProperty={setProperty}
          commissionMode={commissionMode}
          setCommissionMode={setCommissionMode}
          commissionPctInput={commissionPctInput}
          setCommissionPctInput={setCommissionPctInput}
          featureInput={featureInput}
          setFeatureInput={setFeatureInput}
          popularFeatures={popularFeatures}
          validateFloorNumber={validateFloorNumber}
        />
      </div>

      {/* Mandato / Exclusividad */}
      <div id="mandato">
        <MandateSection
          mandateType={property.mandate_type}
          mandateStart={property.mandate_start}
          mandateEnd={property.mandate_end}
          mandateNotes={property.mandate_notes}
          onSave={saveField}
        />
      </div>

      {canSeePropertyContactData && (
        <PropertyOwnerActionsPanel
          property={property}
          propertyId={id!}
          isAdmin={isAdmin}
          onRefreshProperty={fetchProperty}
          onDeleteSuccess={() => navigate('/properties')}
        />
      )}

      {/* Internal Comments */}
      {id && canSeePropertyContactData && <InternalComments entityType="property" entityId={id} />}

      {/* Referencia Catastral */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><MapPinned className="h-4 w-4 text-primary" />Referencia Catastral</CardTitle>
            <Button size="sm" variant="outline" disabled={catastroLoading || !property.province || !property.city || !property.address}
              onClick={lookupByAddress}>
              {catastroLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <MapPinned className="h-3.5 w-3.5 mr-1" />}
              Buscar por dirección
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={referenceInput} onChange={e => setReferenceInput(e.target.value)} placeholder="Referencia catastral (ej: 1234567AB1234C0001XX)" className="font-mono flex-1" />
            <Button size="sm" variant="outline" disabled={catastroLoading || !referenceInput || referenceInput.length < 14}
              title="Autorellenar datos desde Catastro"
              onClick={lookupByReference}>
              {catastroLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPinned className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" disabled={savingRef} onClick={saveReference}>
              {savingRef ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Introduce la referencia catastral y pulsa 📍 para autorellenar dirección, CP, superficie y más desde el Catastro</p>
        </CardContent>
      </Card>

      {/* Catastro Results Dialog */}
      <Dialog open={catastroDialogOpen} onOpenChange={setCatastroDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Selecciona el inmueble</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {catastroResults.map((r, i) => (
              <button key={i} className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors space-y-1"
                onClick={() => selectCatastroResult(r)}>
                <p className="text-sm font-mono font-medium">{r.rc}</p>
                <p className="text-xs text-muted-foreground">
                  {r.escalera ? `Esc. ${r.escalera}` : ''}{r.planta ? ` Planta ${r.planta}` : ''}{r.puerta ? ` · Pta ${r.puerta}` : ''}{r.superficie ? ` · ${r.superficie} m²` : ''}{r.uso ? ` · ${r.uso}` : ''}
                </p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div id="fotos">
        <PropertyPhotosPanel
          images={images}
          isAdmin={isAdmin}
          isCoordinadora={isCoordinadora}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onUploadFiles={uploadFiles}
          dragIndex={dragIndex}
          setDragIndex={setDragIndex}
          dragOverIndex={dragOverIndex}
          setDragOverIndex={setDragOverIndex}
          handleDragDrop={handleDragDrop}
          editingLabel={editingLabel}
          setEditingLabel={setEditingLabel}
          editingLabelValue={editingLabelValue}
          setEditingLabelValue={setEditingLabelValue}
          updateImageLabel={updateImageLabel}
          deleteFile={deleteFile}
          setLightboxIndex={setLightboxIndex}
          setLightboxOpen={setLightboxOpen}
          logMediaAccess={logMediaAccess}
          photoOrderOpen={photoOrderOpen}
          setPhotoOrderOpen={setPhotoOrderOpen}
          saveImageOrder={saveImageOrder}
          applyDefaultOrder={applyDefaultOrder}
          bulkDeleteOpen={bulkDeleteOpen}
          setBulkDeleteOpen={setBulkDeleteOpen}
          bulkDeletePhotos={bulkDeletePhotos}
          userEmail={user?.email}
        />
      </div>

      {/* Closing Workflow (Reserva → Arras → Escritura) */}
      {canSeePropertyContactData && (
        <>
          <div id="cierre" ref={closingSectionRef}>
            <Suspense fallback={sectionFallback}>
              <ClosingWorkflow
                property={property}
                propertyOwners={propertyOwners}
                onCommitField={commitClosingField}
                onSetProperty={setProperty}
              />
            </Suspense>
          </div>

          <div id="expediente" ref={expedienteSectionRef} className="space-y-4">
            <Suspense fallback={sectionFallback}>
              <DocumentRelationsPanel propertyId={property.id} />
            </Suspense>

            {/* Documentación Horus */}
            <Suspense fallback={sectionFallback}>
              <PropertyDocumentsSection propertyId={property.id} propertyStatus={property.status} />
            </Suspense>
          </div>
        </>
      )}

      <Card className="animate-fade-in-up">
        <AccordionUI.Accordion type="multiple" defaultValue={['activity']} className="w-full">
          <PropertyExtendedMediaPanel
            videos={videos}
            virtualTour={virtualTour}
            savingTour={savingTour}
            uploading={uploading}
            isAdmin={isAdmin}
            isCoordinadora={isCoordinadora}
            onVirtualTourChange={setVirtualTour}
            onSaveVirtualTour={saveVirtualTour}
            onUploadVideos={(files) => uploadFiles(files, 'video')}
            onDeleteVideo={deleteFile}
          />

          {id && canSeePropertyContactData && (
            <PropertyCommercialActivityPanel
              propertyId={id}
              propertyTitle={property?.title}
              propertyAddress={property?.address}
              propertyVisits={propertyVisits}
              propertyMatches={propertyMatches}
              onNavigateContact={(contactId) => navigate(`/contacts/${contactId}`)}
              onUpdateMatchStatus={handleMatchStatusChange}
            />
          )}

          {id && (
            <div id="publicacion">
              <PropertyBusinessPanel
                propertyId={id}
                propertyTitle={property?.title}
                propertyPrice={property?.price}
                propertyAgentId={property?.agent_id}
                propertyOwnerId={canSeePropertyContactData ? property?.owner_id : undefined}
                propertyCity={property?.city}
              />
            </div>
          )}
        </AccordionUI.Accordion>
      </Card>

      {/* Image Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-0" onContextMenu={e => e.preventDefault()}>
          <div className="relative flex items-center justify-center min-h-[60vh] select-none">
            <button className="absolute top-4 right-4 text-white/70 hover:text-white z-10" onClick={() => setLightboxOpen(false)}>
              <X className="h-6 w-6" />
            </button>
            {images.length > 1 && (
              <>
                <button className="absolute left-4 text-white/70 hover:text-white z-10" onClick={() => setLightboxIndex(i => (i - 1 + images.length) % images.length)}>
                  <ChevronLeft className="h-8 w-8" />
                </button>
                <button className="absolute right-4 text-white/70 hover:text-white z-10" onClick={() => setLightboxIndex(i => (i + 1) % images.length)}>
                  <ChevronRight className="h-8 w-8" />
                </button>
              </>
            )}
            {images[lightboxIndex] && (
              <div className="relative">
                <img src={images[lightboxIndex].url} alt="" className="max-h-[80vh] max-w-full object-contain pointer-events-none" draggable={false} style={{ WebkitUserDrag: 'none' } as CSSProperties} />
                {/* Watermark overlay lightbox – solo visible en CRM interno */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-16 overflow-hidden opacity-[0.12]">
                  {[0, 1, 2].map(row => (
                    <div key={row} className="rotate-[-35deg] whitespace-nowrap text-white font-bold text-lg tracking-[0.2em] select-none">
                      {user?.email} • {user?.email} • {user?.email}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <span className="absolute bottom-4 text-white/60 text-sm">{lightboxIndex + 1} / {images.length}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertyDetail;
