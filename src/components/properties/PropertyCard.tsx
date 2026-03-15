import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Rss } from 'lucide-react';
import { MapPin, BedDouble, Bath, Maximize, Eye, EyeOff, Home, ShieldCheck, Crown, Globe, Archive, Trash2, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import HealthDot from '@/components/HealthDot';
import PriceSparkline from '@/components/PriceSparkline';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getCoverImage } from '@/lib/get-cover-image';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function getLegalRiskBadge(p: any) {
  if (!p.legal_risk_level) return null;

  if (p.legal_risk_level === 'alto') {
    return {
      label: 'Legal alto',
      className: 'bg-destructive/90 text-destructive-foreground border-0',
    };
  }

  if (p.legal_risk_level === 'medio') {
    return {
      label: 'Legal medio',
      className: 'bg-amber-500/90 text-white border-0',
    };
  }

  if (p.legal_risk_level === 'bajo') {
    return {
      label: 'Legal OK',
      className: 'bg-emerald-500/90 text-white border-0',
    };
  }

  return {
    label: 'Sin análisis',
    className: 'bg-muted text-muted-foreground border-0',
  };
}

/** Property qualifies for Magnos (IA Gestión Premium) feed */
function isMagnos(p: any): boolean {
  return (p.price || 0) >= 500000 && (p.images?.length || 0) >= 20;
}

/** Property is international (non-Spanish) */
function isInternacional(p: any): boolean {
  return !!p.country && p.country !== 'España';
}

export const statusLabels: Record<string, string> = {
  disponible: 'Disponible', arras: 'Arras', vendido: 'Vendido',
  no_disponible: 'No disponible', reservado: 'Reservado',
  alquilado: 'Alquilado', retirado: 'Retirado',
};
export const statusColors: Record<string, string> = {
  disponible: 'bg-success', arras: 'bg-warning', vendido: 'bg-primary',
  no_disponible: 'bg-muted', reservado: 'bg-warning',
  alquilado: 'bg-info', retirado: 'bg-muted',
};

interface PropertyCardProps {
  property: any;
  healthInfo?: any;
  mode: 'grid' | 'mobile';
  onRemoved?: () => void;
}

export const PropertyCard = ({ property: p, healthInfo, mode, onRemoved }: PropertyCardProps) => {
  const navigate = useNavigate();
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const coverImage = getCoverImage(p.images, p.image_order, p.id);
  const legalRiskBadge = getLegalRiskBadge(p);

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiving(true);
    const { error } = await supabase.from('properties').update({ status: 'retirado' as any }).eq('id', p.id);
    setArchiving(false);
    if (error) { toast.error('Error al archivar'); return; }
    toast.success('Propiedad archivada');
    onRemoved?.();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    const { error } = await supabase.from('properties').delete().eq('id', p.id);
    setDeleting(false);
    if (error) { toast.error('Error al eliminar: ' + error.message); return; }
    toast.success('Propiedad eliminada');
    onRemoved?.();
  };

  if (mode === 'mobile') {
    return (
      <button
        onClick={() => navigate(`/properties/${p.id}`)}
        className="w-full text-left bg-card border border-border/50 rounded-2xl overflow-hidden flex items-stretch active:scale-[0.99] transition-all shadow-sm"
      >
        <div className="w-20 shrink-0 bg-muted relative">
          {coverImage ? (
            <img src={coverImage} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center min-h-[72px]">
              <Home className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
          <div className={`absolute bottom-1 left-1 h-2 w-2 rounded-full ${p.status === 'disponible' ? 'bg-success' : 'bg-muted-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0 px-3 py-3">
          <div className="flex items-start justify-between gap-1">
            <span className="font-semibold text-sm text-foreground line-clamp-1">{p.title}</span>
            {p.crm_reference && (
              <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                {p.crm_reference}
              </span>
            )}
          </div>
          {p.city && (
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" />{p.city}
            </p>
          )}
          <div className="flex items-center gap-2.5 mt-1 text-[11px] text-muted-foreground">
            {p.bedrooms > 0 && <span className="flex items-center gap-0.5"><BedDouble className="h-3 w-3" />{p.bedrooms}</span>}
            {p.surface_area && <span className="flex items-center gap-0.5"><Maximize className="h-3 w-3" />{p.surface_area}m²</span>}
            {p.price && <span className="font-semibold text-primary text-xs">{Number(p.price).toLocaleString('es-ES')} €</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <Badge className={`${statusColors[p.status]} text-primary-foreground border-0 text-[9px] px-1.5 py-0 shrink-0`}>
              {statusLabels[p.status]}
            </Badge>
            {p.mandate_type === 'exclusiva' && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/40 text-primary shrink-0">Exclusiva</Badge>
            )}
            {isMagnos(p) && (
              <Badge className="bg-amber-500/90 text-white border-0 text-[9px] px-1.5 py-0 flex items-center gap-0.5 shrink-0">
                <Crown className="h-2.5 w-2.5" />Magnos
              </Badge>
            )}
            {isInternacional(p) && (
              <Badge className="bg-sky-600/90 text-white border-0 text-[9px] px-1.5 py-0 flex items-center gap-0.5 shrink-0">
                <Globe className="h-2.5 w-2.5" />{p.country}
              </Badge>
            )}
            {p.send_to_idealista && (
              <Badge className="bg-success/90 text-success-foreground border-0 text-[9px] px-1.5 py-0 flex items-center gap-0.5 shrink-0">
                <Globe className="h-2.5 w-2.5" />Idealista
              </Badge>
            )}
            {legalRiskBadge && (
              <Badge className={`${legalRiskBadge.className} text-[9px] px-1.5 py-0 shrink-0`}>
                {legalRiskBadge.label}
              </Badge>
            )}
            {(p.xml_id || p.source === 'habihub') && (
              <Badge variant="outline" className="border-orange-400/60 text-orange-600 text-[9px] px-1.5 py-0 flex items-center gap-0.5 shrink-0">
                <Rss className="h-2.5 w-2.5" />HabiHub
              </Badge>
            )}
            <span className="shrink-0"><HealthDot info={healthInfo} /></span>
          </div>
        </div>
      </button>
    );
  }

  // Grid mode
  const isAvailable = p.status === 'disponible';
  return (
    <Card
      className={`hover-lift cursor-pointer border-0 shadow-[var(--shadow-card)] animate-fade-in-up overflow-hidden ${!isAvailable ? 'opacity-70' : ''}`}
      onClick={() => navigate(`/properties/${p.id}`)}
    >
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {coverImage ? (
          <img src={coverImage} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="h-14 w-14 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <Badge className={`border-0 text-xs font-semibold ${isAvailable ? 'bg-success text-success-foreground' : 'bg-destructive/90 text-destructive-foreground'}`}>
            {isAvailable ? <><Eye className="h-3 w-3 mr-1" />Publicado</> : <><EyeOff className="h-3 w-3 mr-1" />No publicado</>}
          </Badge>
        </div>
        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
          <Badge variant="secondary" className={`${statusColors[p.status]} text-primary-foreground border-0 text-[11px]`}>
            {statusLabels[p.status]}
          </Badge>
          {isMagnos(p) && (
            <Badge className="bg-amber-500/90 text-white border-0 text-[11px] flex items-center gap-0.5">
              <Crown className="h-3 w-3" />Magnos
            </Badge>
          )}
          {isInternacional(p) && (
            <Badge className="bg-sky-600/90 text-white border-0 text-[11px] flex items-center gap-0.5">
              <Globe className="h-3 w-3" />{p.country}
            </Badge>
          )}
          {p.send_to_idealista && (
            <Badge className="bg-success/90 text-success-foreground border-0 text-[11px] flex items-center gap-0.5">
              <Globe className="h-3 w-3" />Idealista
            </Badge>
          )}
          {legalRiskBadge && (
            <Badge className={`${legalRiskBadge.className} text-[11px]`}>
              {legalRiskBadge.label}
            </Badge>
          )}
          {(p.xml_id || p.source === 'habihub') && (
            <Badge variant="outline" className="border-orange-400/60 text-orange-600 bg-card/80 text-[11px] flex items-center gap-0.5">
              <Rss className="h-3 w-3" />HabiHub
            </Badge>
          )}
        </div>
        {healthInfo && <div className="absolute bottom-2.5 right-2.5"><HealthDot info={healthInfo} size="md" /></div>}
      </div>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-display font-semibold text-lg leading-snug line-clamp-2">{p.title}</h3>
          {p.crm_reference && (
            <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">
              {p.crm_reference}
            </span>
          )}
        </div>
        {p.city && (
          <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
            <MapPin className="h-4 w-4" />{p.city}
          </p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          {p.bedrooms > 0 && <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" />{p.bedrooms} hab.</span>}
          {p.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="h-4 w-4" />{p.bathrooms} baños</span>}
          {p.surface_area && <span className="flex items-center gap-1"><Maximize className="h-4 w-4" />{p.surface_area} m²</span>}
        </div>
        {p.price && (
          <div className="flex items-center gap-2">
            <p className="text-xl font-display font-bold text-primary">{Number(p.price).toLocaleString('es-ES')} €</p>
            <PriceSparkline propertyId={p.id} currentPrice={p.price} />
          </div>
        )}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
          <Button
            variant="ghost" size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-warning"
            disabled={archiving || p.status === 'retirado'}
            onClick={handleArchive}
          >
            {archiving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Archive className="h-3 w-3 mr-1" />}
            Archivar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost" size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-3 w-3 mr-1" />Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar propiedad?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará permanentemente "{p.title}" ({p.crm_reference}). Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

interface PropertyListViewProps {
  properties: any[];
  healthColors: Record<string, any>;
  onRemoved?: () => void;
}

export const PropertyListView = ({ properties, healthColors, onRemoved }: PropertyListViewProps) => {
  const navigate = useNavigate();
  return (
    <Card>
      <Table>
        <TableHeader>
         <TableRow>
            <TableHead>Referencia</TableHead><TableHead>Inmueble</TableHead><TableHead>Salud</TableHead>
            <TableHead>País</TableHead><TableHead>Ciudad</TableHead><TableHead>Legal</TableHead><TableHead>Hab.</TableHead><TableHead>Superficie</TableHead>
            <TableHead>Precio</TableHead><TableHead>Estado</TableHead><TableHead>Mandato</TableHead>
            <TableHead>Magnos</TableHead>
            <TableHead>Idealista</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map(p => (
            <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/properties/${p.id}`)}>
              <TableCell><span className="font-mono text-xs font-bold text-primary">{p.crm_reference || '—'}</span></TableCell>
              <TableCell className="font-medium">{p.title}</TableCell>
              <TableCell><HealthDot info={healthColors[p.id]} /></TableCell>
              <TableCell>
                {isInternacional(p) ? (
                  <Badge className="bg-sky-600/90 text-white border-0 text-[10px] flex items-center gap-0.5 w-fit">
                    <Globe className="h-3 w-3" />{p.country}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">España</span>
                )}
              </TableCell>
              <TableCell>{p.city || '—'}</TableCell>
              <TableCell>
                {legalRiskBadge ? (
                  <Badge className={`${legalRiskBadge.className} text-[10px] w-fit`}>
                    {legalRiskBadge.label}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{p.bedrooms || '—'}</TableCell>
              <TableCell>{p.surface_area ? `${p.surface_area} m²` : '—'}</TableCell>
              <TableCell className="font-semibold">{p.price ? `${Number(p.price).toLocaleString('es-ES')} €` : '—'}</TableCell>
              <TableCell>
                <Badge className={`${statusColors[p.status]} text-primary-foreground border-0 text-[10px]`}>
                  {statusLabels[p.status]}
                </Badge>
              </TableCell>
              <TableCell>
                {p.mandate_type === 'exclusiva'
                  ? <span className="flex items-center gap-1 text-xs"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Exclusiva</span>
                  : p.mandate_type === 'compartida'
                  ? <span className="text-xs text-muted-foreground">Compartida</span>
                  : '—'}
              </TableCell>
              <TableCell>
                {isMagnos(p) ? (
                  <Badge className="bg-amber-500/90 text-white border-0 text-[10px] flex items-center gap-0.5 w-fit">
                    <Crown className="h-3 w-3" />Magnos
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {p.send_to_idealista ? (
                  <Badge className="bg-success/90 text-success-foreground border-0 text-[10px] flex items-center gap-0.5 w-fit">
                    <Globe className="h-3 w-3" />Sí
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <PropertyRowActions property={p} onRemoved={onRemoved} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

/** Inline action buttons for table rows */
const PropertyRowActions = ({ property: p, onRemoved }: { property: any; onRemoved?: () => void }) => {
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiving(true);
    const { error } = await supabase.from('properties').update({ status: 'retirado' as any }).eq('id', p.id);
    setArchiving(false);
    if (error) { toast.error('Error al archivar'); return; }
    toast.success('Propiedad archivada');
    onRemoved?.();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    const { error } = await supabase.from('properties').delete().eq('id', p.id);
    setDeleting(false);
    if (error) { toast.error('Error al eliminar: ' + error.message); return; }
    toast.success('Propiedad eliminada');
    onRemoved?.();
  };

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-warning" disabled={archiving || p.status === 'retirado'} onClick={handleArchive} title="Archivar">
        {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Eliminar">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar propiedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente "{p.title}" ({p.crm_reference}). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
