import { useEffect, useState, useRef, useCallback } from 'react';
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
import { Accordion } from '@/components/ui/accordion';
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
import DocumentScanner from '@/components/DocumentScanner';

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
import ClosingWorkflow from '@/components/ClosingWorkflow';
import PropertyDocumentsSection from '@/components/PropertyDocumentsSection';
import DocumentRelationsPanel from '@/components/DocumentRelationsPanel';
import PropertyBusinessPanel from '@/components/properties/PropertyBusinessPanel';
import PropertyBasicsPanel from '@/components/properties/PropertyBasicsPanel';
import PropertyCommercialActivityPanel from '@/components/properties/PropertyCommercialActivityPanel';
import PropertyExtendedMediaPanel from '@/components/properties/PropertyExtendedMediaPanel';
import PropertyOwnerActionsPanel from '@/components/properties/PropertyOwnerActionsPanel';
import PropertyPhotosPanel from '@/components/properties/PropertyPhotosPanel';
import PropertyStakeholdersPanel from '@/components/properties/PropertyStakeholdersPanel';
import AISectionGuide from '@/components/ai/AISectionGuide';
import { commitClosingFieldUpdates } from '@/lib/closing-workflow';
import {
  buildImageOrderUpdatePayload,
  buildPropertyMediaCollections,
  getEstanciaGroup,
  getPropertyImageSource,
  removeDeletedImagesFromProperty,
  type PropertyImageOrderEntry,
} from '@/lib/property-detail-media';

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

function getPropertyOriginBadge(property: any) {
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
  const fromSearch: string | undefined = (location.state as any)?.fromSearch;
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

  const commitClosingField = useCallback((updates: Record<string, any>) => {
    commitClosingFieldUpdates(setProperty, saveField, updates);
  }, [saveField]);

  const fetchPopularFeatures = useCallback(async () => {
    const { data } = await supabase.from('settings').select('value').eq('key', 'popular_features').single();
    if (data?.value) {
      const val = data.value as any;
      setPopularFeatures((val.popular_extras || []).map((e: any) => e.name));
    }
  }, []);

  const dismissAnomaly = useCallback(async (notifId: string) => {
    setDismissedAnomalies(prev => new Set(prev).add(notifId));
    void dismissStoredAnomaly(notifId);
  }, [dismissStoredAnomaly]);

  const handleMatchStatusChange = useCallback(async (matchId: string, status: string) => {
    await supabase.from('matches').update({ status: status as any }).eq('id', matchId);
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

  return (
    <div className="space-y-6">
      <AISectionGuide
        title={`Ficha de ${property.title || 'inmueble'}`}
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

      {/* ── ANOMALY BANNER ── */}
      {visibleAnomalies.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 space-y-2 animate-fade-in-up">
          <div className="flex items-start gap-2">
            <span className="text-xl leading-none mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">
                {visibleAnomalies.length === 1 ? 'Dato sospechoso detectado — revisa el formulario' : `${visibleAnomalies.length} datos sospechosos detectados — revisa el formulario`}
              </p>
              <ul className="mt-1 space-y-1">
                {visibleAnomalies.map(n => (
                  <li key={n.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="flex-1">{n.description}</span>
                    <button
                      onClick={() => dismissAnomaly(n.id)}
                      className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                      title="Marcar como revisado"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE HERO ── */}
      {isMobile && (
        <div className="rounded-3xl bg-card border border-border/60 overflow-hidden shadow-sm animate-fade-in-up">
          {/* Imagen principal */}
           {(property.images && property.images.length > 0) || getCoverImage(property.images, property.image_order, property.id) ? (
            <div className="aspect-[16/9] relative overflow-hidden bg-muted">
              <img src={getCoverImage(property.images, property.image_order, property.id) || property.images?.[0]} alt={property.title} className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 flex gap-1.5">
                <Badge className={`border-0 text-xs font-semibold ${statusColors[property.status]} text-primary-foreground`}>
                  {statusLabels[property.status]}
                </Badge>
              </div>
              {property.crm_reference && (
                <div className="absolute top-3 right-3">
                  <span className="font-mono text-[11px] font-bold text-white bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded">
                    {property.crm_reference}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[16/9] bg-muted flex items-center justify-center">
              <Home className="h-14 w-14 text-muted-foreground/30" />
            </div>
          )}

          {/* Info principal */}
          <div className="px-5 pt-4 pb-3">
            <h2 className="font-display font-bold text-[17px] leading-tight mb-1">{property.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className={`${originBadge.className} flex items-center gap-1`}>
                <OriginIcon className="h-3 w-3" />
                {originBadge.label}
              </Badge>
            </div>
            {property.address && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{property.address}{property.city ? `, ${property.city}` : ''}</span>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
              {property.bedrooms > 0 && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{property.bedrooms} hab.</span>}
              {property.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{property.bathrooms} baños</span>}
              {property.surface_area && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{property.surface_area} m²</span>}
            </div>
            {property.price && (
              <p className="text-2xl font-display font-bold text-primary">{Number(property.price).toLocaleString('es-ES')} €</p>
            )}
          </div>

          {/* Acciones rápidas */}
          <div className="grid grid-cols-3 gap-px bg-border/40 border-t border-border/40">
            {canSeePropertyContactData && property.owner_id ? (
              <button
                onClick={() => { hapticLight(); navigate(`/contacts/${property.owner_id}`); }}
                className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors relative"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-[18px] w-[18px] text-primary" />
                </div>
                <span className="text-[11px] font-medium text-foreground">Propietario</span>
                {propertyOwners.length > 1 && (
                  <span className="absolute top-2 right-1/4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {propertyOwners.length}
                  </span>
                )}
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card opacity-40">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-[18px] w-[18px] text-muted-foreground" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {canSeePropertyContactData ? 'Sin propietario' : 'Contacto oculto'}
                </span>
              </div>
            )}
            <button
              onClick={() => { hapticLight(); navigate(`/matches?property_id=${id}`); }}
              className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Zap className="h-[18px] w-[18px] text-emerald-600" />
              </div>
              <span className="text-[11px] font-medium text-foreground">Cruces</span>
            </button>
          </div>
        </div>
      )}

      {/* Header escritorio */}
      {isMobile ? null : (
      <div className="flex flex-col gap-2 animate-fade-in-up">
        {/* Breadcrumb / volver */}
        <div className="flex items-center gap-1 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {fromSearch
              ? <span>Resultados de <span className="font-semibold text-foreground">"{fromSearch}"</span></span>
              : <span>Inmuebles</span>
            }
          </Button>
        </div>
        {/* Title row + actions */}
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3">
              <Input
                className="h-auto max-w-2xl border-0 bg-transparent px-0 text-2xl font-display font-bold tracking-tight focus-visible:ring-1"
                value={property.title}
                onChange={e => setProperty((p: any) => ({ ...p, title: e.target.value }))}
                onBlur={() => saveField({ title: property.title })}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`${originBadge.className} flex items-center gap-1`}>
                  <OriginIcon className="h-3 w-3" />
                  {originBadge.label}
                </Badge>
                {property.crm_reference && (
                  <span className="select-all rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 font-mono text-sm font-bold text-primary">
                    {property.crm_reference}
                  </span>
                )}
                <Select value={property.status} onValueChange={v => saveField({ status: v })}>
                  <SelectTrigger className="h-8 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(() => {
                  const isPublished = property.status === 'disponible';
                  return (
                    <Button
                      size="sm"
                      variant={isPublished ? 'default' : 'outline'}
                      className={`gap-1.5 ${isPublished ? 'bg-success hover:bg-success/90 text-success-foreground' : 'text-muted-foreground'}`}
                      onClick={() => saveField({ status: isPublished ? 'no_disponible' : 'disponible' })}
                    >
                      {isPublished ? <><Eye className="h-3.5 w-3.5" />Publicado</> : <><EyeOff className="h-3.5 w-3.5" />No publicado</>}
                    </Button>
                  );
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                  <Zap className={`h-3.5 w-3.5 ${property.auto_match !== false ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-xs text-muted-foreground">Cruce auto</span>
                  <Switch
                    checked={property.auto_match !== false}
                    onCheckedChange={async (checked) => {
                      await saveField({ auto_match: checked });
                    }}
                    className="scale-75"
                  />
                </div>
                {!property.xml_id && (
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5">
                    <Globe className={`h-3.5 w-3.5 ${property.send_to_idealista ? 'text-success' : 'text-muted-foreground'}`} />
                    <span className="text-xs text-muted-foreground">Idealista</span>
                    <Switch
                      checked={!!property.send_to_idealista}
                      onCheckedChange={async (checked) => {
                        await saveField({ send_to_idealista: checked });
                      }}
                      className="scale-75"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <Select value={property.property_type} onValueChange={v => saveField({ property_type: v })}>
                <SelectTrigger className="w-[120px] h-7 text-xs capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {propertyTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={property.secondary_property_type || '_none'} onValueChange={v => saveField({ secondary_property_type: v === '_none' ? null : v })}>
                <SelectTrigger className="w-[130px] h-7 text-xs capitalize" title="Tipo secundario (portales)">
                  <SelectValue placeholder="+ Tipo 2" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none" className="text-muted-foreground">Sin tipo 2</SelectItem>
                  {propertyTypes.filter(t => t !== property.property_type && t !== 'otro').map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={property.operation} onValueChange={v => saveField({ operation: v })}>
                <SelectTrigger className="w-[110px] h-7 text-xs capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operationTypes.map(o => <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ChangeRequestButton
              entityType="property"
              entityId={property?.id || ''}
              entityLabel={property?.title || ''}
            />
            <DocumentScanner
              context="property"
              onExtracted={async (data) => {
                const updates: any = {};
                if (data.property_address) updates.address = data.property_address;
                if (data.property_city) updates.city = data.property_city;
                if (data.property_province) updates.province = data.property_province;
                if (data.property_zip_code) updates.zip_code = data.property_zip_code;
                if (data.property_type) updates.property_type = data.property_type;
                if (data.cadastral_reference) updates.reference = data.cadastral_reference;
                if (data.surface_area) updates.surface_area = data.surface_area;
                if (data.built_area) updates.built_area = data.built_area;
                if (data.bedrooms) updates.bedrooms = data.bedrooms;
                if (data.bathrooms) updates.bathrooms = data.bathrooms;
                if (data.floor) updates.floor_number = data.floor;
                if (data.price) updates.price = data.price;
                if (data.energy_cert) updates.energy_cert = data.energy_cert;
                if (data.property_description) updates.description = data.property_description;
                if (Object.keys(updates).length > 0) {
                  await supabase.from('properties').update(updates).eq('id', id!);
                  fetchProperty();
                }
              }}
            />
            
            {canSeePropertyContactData && (
              <PropertyOwnerActionsPanel
                property={property}
                propertyId={id!}
                isAdmin={isAdmin}
                compact
                onRefreshProperty={fetchProperty}
                onDeleteSuccess={() => navigate('/properties')}
              />
            )}
          </div>
        </div>
      </div>
      )}

      {/* Key metrics - editable */}
      <Card className="animate-fade-in-up">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: BedDouble, label: 'Habitaciones', field: 'bedrooms' },
              { icon: Bath, label: 'Baños', field: 'bathrooms' },
              { icon: Maximize, label: 'Superficie (m²)', field: 'surface_area' },
              { icon: Maximize, label: 'Construida (m²)', field: 'built_area' },
            ].map(m => (
              <div key={m.field} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <m.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    className="h-8 text-lg font-bold border-0 bg-transparent px-0 focus-visible:ring-1 w-full"
                    placeholder="0"
                    value={property[m.field] || ''}
                    onChange={e => setProperty((p: any) => ({ ...p, [m.field]: e.target.value ? Number(e.target.value) : null }))}
                    onBlur={() => saveField({ [m.field]: property[m.field] })}
                  />
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Card Ficha Web (compacta) ── */}
      {(() => {
        // legadocoleccion.es usa slugs exactamente iguales al sitemap:
        // {tipo}-en-{ciudad}-{ciudad}-{últimos 5 hex del UUID sin guiones}
        // Ej: piso-en-finestrat-finestrat-73a70, chalet-en-polop-polop-fc10f
        const slugify = (s: string) =>
          s.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const titleSlug = slugify(property.title || 'propiedad');
        const citySlug = slugify(property.city || property.province || '');
        const uuidSuffix = (property.id as string).replace(/-/g, '').slice(-5);
        const propertySlug = citySlug
          ? `${titleSlug}-${citySlug}-${uuidSuffix}`
          : `${titleSlug}-${uuidSuffix}`;
        const webUrl = `https://legadocoleccion.es/propiedad/${propertySlug}`;
        // URL para compartir en redes: pasa por legadocoleccion.es/s/ que proxia a og-property
        const socialUrl = `https://legadocoleccion.es/s/${id}`;
        const isPublished = ['disponible', 'reservado'].includes(property.status);
        const firstImage = getCoverImage(property.images, property.image_order, property.id);
        const summaryParts: string[] = [];
        if (property.bedrooms) summaryParts.push(`${property.bedrooms} hab.`);
        if (property.bathrooms) summaryParts.push(`${property.bathrooms} baños`);
        if (property.price) summaryParts.push(`${Number(property.price).toLocaleString('es-ES')} €`);

        return (
          <div className="flex justify-start animate-fade-in-up">
            <div className="inline-flex items-center gap-2.5 rounded-lg border border-border/50 bg-card px-3 py-2 shadow-sm hover:shadow-md transition-shadow max-w-sm">
              {/* Thumbnail */}
              {firstImage && (
                <div className="h-9 w-12 shrink-0 overflow-hidden rounded-md border border-border/40">
                  <img src={firstImage} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-foreground">Ficha web</span>
                  {isPublished ? (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-success bg-success/10 px-1 py-0.5 rounded-full">
                      <span className="h-1 w-1 rounded-full bg-success inline-block" />
                      Live
                    </span>
                  ) : (
                    <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1 py-0.5 rounded-full uppercase">Off</span>
                  )}
                </div>
                {summaryParts.length > 0 && (
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">{summaryParts.join(' · ')}</p>
                )}
              </div>
              {/* Dropdown: Ver, Compartir, Ficha ciega */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/15 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors flex items-center gap-1 shrink-0">
                    Acciones
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => window.open(webUrl, '_blank')}>
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    Ver en web
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    navigator.clipboard.writeText(webUrl);
                    toast({ title: 'Enlace web copiado ✓', description: 'URL directa para enviar a clientes' });
                  }}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Copiar enlace web
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    navigator.clipboard.writeText(socialUrl);
                    toast({ title: 'Enlace redes copiado ✓', description: 'Pégalo en LinkedIn, WhatsApp o Facebook — verás preview con foto y precio' });
                  }}>
                    <Share2 className="h-3.5 w-3.5 mr-2" />
                    Copiar enlace redes sociales
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(`/ficha-ciega/${id}`, '_blank')}>
                    <EyeOff className="h-3.5 w-3.5 mr-2" />
                    Ficha ciega
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const blindUrl = `${SUPABASE_URL}/functions/v1/og-blind?id=${id}`;
                    navigator.clipboard.writeText(blindUrl);
                    toast({ title: 'Enlace ficha ciega copiado ✓', description: 'Sin datos de la inmobiliaria — ideal para compartir con otras agencias' });
                  }}>
                    <Share2 className="h-3.5 w-3.5 mr-2" />
                    Copiar enlace ficha ciega (redes)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })()}

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
            <ClosingWorkflow
              property={property}
              propertyOwners={propertyOwners}
              onCommitField={commitClosingField}
              onSetProperty={setProperty}
            />
          </div>

          <div id="expediente" ref={expedienteSectionRef} className="space-y-4">
            <DocumentRelationsPanel propertyId={property.id} />

            {/* Documentación Horus */}
            <PropertyDocumentsSection propertyId={property.id} propertyStatus={property.status} />
          </div>
        </>
      )}

      <Card className="animate-fade-in-up">
        <Accordion type="multiple" defaultValue={['activity']} className="w-full">
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
        </Accordion>
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
                <img src={images[lightboxIndex].url} alt="" className="max-h-[80vh] max-w-full object-contain pointer-events-none" draggable={false} style={{ WebkitUserDrag: 'none' } as any} />
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
