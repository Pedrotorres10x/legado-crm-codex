import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Database } from '@/integrations/supabase/types';
import { getCoverImage } from '@/lib/get-cover-image';
import { ArrowLeft, Bath, BedDouble, ChevronDown, Copy, Eye, EyeOff, Home, MapPin, Maximize, Plus, User, Zap } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import ChangeRequestButton from '@/components/ChangeRequestButton';

type PropertyRow = Database['public']['Tables']['properties']['Row'];

type OriginBadge = {
  label: string;
  className: string;
  icon: React.ComponentType<{ className?: string }>;
};

type PrimaryAction = {
  label: string;
  description: string;
  onClick: () => void;
};

type Props = {
  property: PropertyRow;
  safeTitle: string;
  originBadge: OriginBadge;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  isMobile: boolean;
  fromSearch?: string;
  canSeePropertyContactData: boolean;
  propertyOwnersCount: number;
  isPublished: boolean;
  propertyTypes: readonly string[];
  operationTypes: readonly string[];
  statusOptions: readonly string[];
  primaryAction: PrimaryAction;
  topBlockers: string[];
  propertyId: string;
  sectionFallback?: React.ReactNode;
  onBack: () => void;
  onNavigateOwner: () => void;
  onOpenMatches: () => void;
  onOpenVisitSheet: () => void;
  onOpenFicha: () => void;
  onOpenExpediente: () => void;
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onTitleBlur: () => void;
  onSaveStatus: (value: string) => void;
  onTogglePublished: () => void;
  onSaveAutoMatch: (checked: boolean) => void;
  onSavePropertyType: (value: string) => void;
  onSaveSecondaryPropertyType: (value: string) => void;
  onSaveOperation: (value: string) => void;
  ownerActions?: React.ReactNode;
  scannerAction?: React.ReactNode;
};

export default function PropertyDetailHero({
  property,
  safeTitle,
  originBadge,
  statusLabels,
  statusColors,
  isMobile,
  fromSearch,
  canSeePropertyContactData,
  propertyOwnersCount,
  isPublished,
  propertyTypes,
  operationTypes,
  statusOptions,
  primaryAction,
  topBlockers,
  propertyId,
  onBack,
  onNavigateOwner,
  onOpenMatches,
  onOpenVisitSheet,
  onOpenFicha,
  onOpenExpediente,
  onTitleChange,
  onTitleBlur,
  onSaveStatus,
  onTogglePublished,
  onSaveAutoMatch,
  onSavePropertyType,
  onSaveSecondaryPropertyType,
  onSaveOperation,
  ownerActions,
  scannerAction,
}: Props) {
  const OriginIcon = originBadge.icon;
  const coverImage = getCoverImage(property.images, property.image_order, property.id) || property.images?.[0];

  if (isMobile) {
    return (
      <div className="rounded-3xl bg-card border border-border/60 overflow-hidden shadow-sm animate-fade-in-up">
        {coverImage ? (
          <div className="aspect-[16/9] relative overflow-hidden bg-muted">
            <img src={coverImage} alt={safeTitle} className="w-full h-full object-cover" />
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

        <div className="px-5 pt-4 pb-3">
          <h2 className="font-display font-bold text-[17px] leading-tight mb-1">{safeTitle}</h2>
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

        <div className="grid grid-cols-3 gap-px bg-border/40 border-t border-border/40">
          {canSeePropertyContactData && property.owner_id ? (
            <button onClick={onNavigateOwner} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors relative">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-[18px] w-[18px] text-primary" />
              </div>
              <span className="text-[11px] font-medium text-foreground">Propietario</span>
              {propertyOwnersCount > 1 && (
                <span className="absolute top-2 right-1/4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {propertyOwnersCount}
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
          <button onClick={onOpenMatches} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors">
            <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Zap className="h-[18px] w-[18px] text-emerald-600" />
            </div>
            <span className="text-[11px] font-medium text-foreground">Cruces</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-1 text-sm">
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground -ml-2" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {fromSearch ? <span>Resultados de <span className="font-semibold text-foreground">"{fromSearch}"</span></span> : <span>Inmuebles</span>}
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <Card className="border-border/60 bg-gradient-to-br from-card via-card to-muted/20 shadow-sm">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-3">
              <Input
                className="h-auto max-w-3xl border-0 bg-transparent px-0 text-3xl font-display font-bold tracking-tight focus-visible:ring-1"
                value={property.title}
                onChange={onTitleChange}
                onBlur={onTitleBlur}
              />

              <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
                {property.address && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm">
                    <MapPin className="h-3.5 w-3.5" />
                    {property.address}{property.city ? `, ${property.city}` : ''}
                  </span>
                )}
                <Badge variant="outline" className={`${originBadge.className} flex shrink-0 items-center gap-1`}>
                  <OriginIcon className="h-3 w-3" />
                  {originBadge.label}
                </Badge>
                {property.crm_reference && (
                  <span className="max-w-full select-all truncate rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 font-mono text-xs font-bold text-primary">
                    {property.crm_reference}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Select value={property.status} onValueChange={onSaveStatus}>
                <SelectTrigger className="h-9 w-[150px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant={isPublished ? 'default' : 'outline'}
                className={`h-9 shrink-0 gap-1.5 ${isPublished ? 'bg-success hover:bg-success/90 text-success-foreground' : 'text-muted-foreground'}`}
                onClick={onTogglePublished}
              >
                {isPublished ? <><Eye className="h-3.5 w-3.5" />Publicado</> : <><EyeOff className="h-3.5 w-3.5" />No publicado</>}
              </Button>

              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
                <Zap className={`h-3.5 w-3.5 ${property.auto_match !== false ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-xs">Cruce auto</span>
                <Switch checked={property.auto_match !== false} onCheckedChange={onSaveAutoMatch} className="scale-75" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 text-sm text-muted-foreground">
              <Select value={property.property_type} onValueChange={onSavePropertyType}>
                <SelectTrigger className="h-8 w-[130px] text-xs capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((type) => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={property.secondary_property_type || '_none'} onValueChange={onSaveSecondaryPropertyType}>
                <SelectTrigger className="h-8 w-[150px] text-xs capitalize" title="Tipo secundario (portales)">
                  <SelectValue placeholder="+ Tipo 2" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none" className="text-muted-foreground">Sin tipo 2</SelectItem>
                  {propertyTypes.filter((type) => type !== property.property_type && type !== 'otro').map((type) => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={property.operation} onValueChange={onSaveOperation}>
                <SelectTrigger className="h-8 w-[120px] text-xs capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operationTypes.map((operation) => <SelectItem key={operation} value={operation} className="capitalize">{operation}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_45%),linear-gradient(135deg,rgba(99,102,241,0.05),rgba(255,255,255,0.98))] shadow-sm">
          <CardContent className="space-y-6 p-6">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                Ahora mismo
              </div>
              <div>
                <h2 className="max-w-[26rem] text-[1.35rem] font-display font-semibold tracking-tight text-foreground">Que haria ahora con este inmueble</h2>
                <p className="mt-1.5 max-w-[34rem] text-sm leading-6 text-muted-foreground">{primaryAction.description}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-background/85 p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Siguiente accion</p>
                    <p className="text-base font-semibold text-foreground">{primaryAction.label}</p>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {topBlockers.length > 0 ? (
                      topBlockers.map((blocker) => (
                        <p key={blocker} className="flex items-start gap-2.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{blocker}</span>
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">La ficha esta ordenada. Aprovecha para mover la siguiente accion comercial.</p>
                    )}
                  </div>
                </div>
                <Button className="shrink-0 min-w-[220px]" onClick={primaryAction.onClick}>{primaryAction.label}</Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Acciones
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {canSeePropertyContactData && (
                    <DropdownMenuItem onClick={onOpenVisitSheet}>
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Enviar hoja de visita
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onOpenFicha}>
                    <Home className="mr-2 h-3.5 w-3.5" />
                    Ir al resumen del inmueble
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenExpediente}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Ver documentacion
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenMatches}>
                    <Zap className="mr-2 h-3.5 w-3.5" />
                    Abrir cruces
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <ChangeRequestButton entityType="property" entityId={property.id} entityLabel={property.title || ''} />
              {scannerAction}
              {ownerActions}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
