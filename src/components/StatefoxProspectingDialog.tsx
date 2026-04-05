import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  STATEFOX_ADVERTISER_LABELS,
  STATEFOX_HOUSING_LABELS,
  STATEFOX_HOUSING_OPTIONS,
  STATEFOX_OPERATION_LABELS,
  STATEFOX_SEARCH_MODE_OPTIONS,
  STATEFOX_SOURCE_OPTIONS,
  type StatefoxAdvertiserType,
  type StatefoxListing,
  type StatefoxOperation,
  type StatefoxSearchMeta,
  type StatefoxSearchMode,
  type StatefoxSource,
} from '@/lib/statefox';
import { Building2, CalendarRange, Loader2, Phone, Search, UserPlus } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void> | void;
};

const formatCurrency = (value: number | null) =>
  value == null ? 'n/d' : `${value.toLocaleString('es-ES')} €`;

const normalizeIdsInput = (value: string) =>
  Array.from(new Set(
    value
      .split(/[\s,;\n]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  ));

export default function StatefoxProspectingDialog({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<StatefoxSearchMode>('range');
  const [source, setSource] = useState<StatefoxSource>('idealista');
  const [operation, setOperation] = useState<StatefoxOperation>('sale');
  const [housing, setHousing] = useState('flat');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [items, setItems] = useState('50');
  const [advertiserType, setAdvertiserType] = useState<StatefoxAdvertiserType>('private');
  const [idsInput, setIdsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [listings, setListings] = useState<StatefoxListing[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchMeta, setSearchMeta] = useState<StatefoxSearchMeta | null>(null);

  const selectedListings = useMemo(
    () => listings.filter((listing) => selectedIds.includes(listing.listingId)),
    [listings, selectedIds],
  );

  const parsedIds = useMemo(() => normalizeIdsInput(idsInput), [idsInput]);

  const toggleSelection = (listingId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, listingId])) : current.filter((id) => id !== listingId),
    );
  };

  const resetResults = () => {
    setListings([]);
    setSelectedIds([]);
    setSearchMeta(null);
  };

  const handleSearch = async () => {
    setLoading(true);
    resetResults();

    const body = mode === 'ids'
      ? {
          action: 'lookup_ids',
          ids: parsedIds,
          source,
          advertiserType,
        }
      : {
          action: startDate && endDate && startDate !== endDate ? 'search_range' : 'search_day',
          source,
          type: operation,
          housing,
          insert: startDate || undefined,
          startDate: startDate || undefined,
          endDate: endDate || startDate || undefined,
          items: Number(items || 50),
          advertiserType,
        };

    const { data, error } = await supabase.functions.invoke('statefox-prospecting', { body });
    setLoading(false);

    if (error || data?.error) {
      toast({
        title: 'No se pudo consultar Statefox',
        description: error?.message || data?.error || 'Revisa la configuración del token.',
        variant: 'destructive',
      });
      return;
    }

    const nextListings = Array.isArray(data?.listings) ? data.listings as StatefoxListing[] : [];
    setListings(nextListings);
    setSelectedIds(nextListings.map((listing) => listing.listingId));
    setSearchMeta((data?.meta ?? null) as StatefoxSearchMeta | null);

    const errorsCount = Array.isArray(data?.meta?.errors) ? data.meta.errors.length : 0;
    toast({
      title: 'Búsqueda completada',
      description: `${nextListings.length} anuncio(s) listos para captar${errorsCount > 0 ? ` · ${errorsCount} incidencia(s) en el rango` : ''}.`,
    });
  };

  const handleImport = async () => {
    if (selectedListings.length === 0) return;

    setImporting(true);
    const { data, error } = await supabase.functions.invoke('statefox-prospecting', {
      body: {
        action: 'import',
        listings: selectedListings,
      },
    });
    setImporting(false);

    if (error || data?.error) {
      toast({
        title: 'No se pudieron importar los leads',
        description: error?.message || data?.error || 'Inténtalo de nuevo.',
        variant: 'destructive',
      });
      return;
    }

    await onImported();

    toast({
      title: 'Captación importada',
      description: `${data?.summary?.imported ?? 0} contacto(s) creados y ${data?.summary?.skipped ?? 0} omitidos.`,
    });

    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const canSearch = mode === 'ids'
    ? parsedIds.length > 0
    : Boolean(startDate && (mode !== 'range' || endDate || startDate));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Statefox Captación
          </DialogTitle>
          <DialogDescription>
            Consulta histórico por fechas o recupera anuncios por ID y súbelos al CRM como prospectos de captación.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {STATEFOX_SEARCH_MODE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={mode === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setMode(option.value);
                resetResults();
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {mode === 'ids' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>IDs de Statefox</Label>
              <Textarea
                value={idsInput}
                onChange={(event) => setIdsInput(event.target.value)}
                placeholder="id.es.s.109150258&#10;id.es.s.109150259"
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Pega uno o varios IDs separados por coma, espacio o salto de línea.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Portal de referencia</Label>
                <Select value={source} onValueChange={(value) => setSource(value as StatefoxSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATEFOX_SOURCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo anunciante</Label>
                <Select value={advertiserType} onValueChange={(value) => setAdvertiserType(value as StatefoxAdvertiserType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Particulares</SelectItem>
                    <SelectItem value="professional">Profesionales</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{parsedIds.length} ID(s) detectados</p>
                <p className="mt-1">Este modo sirve para rescatar anuncios concretos si el push falla o quieres refrescarlos manualmente.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-6">
            <div className="space-y-2">
              <Label>Portal</Label>
              <Select value={source} onValueChange={(value) => setSource(value as StatefoxSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATEFOX_SOURCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Operación</Label>
              <Select value={operation} onValueChange={(value) => setOperation(value as StatefoxOperation)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Venta</SelectItem>
                  <SelectItem value="rent">Alquiler</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo inmueble</Label>
              <Select value={housing} onValueChange={setHousing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATEFOX_HOUSING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha inicio</Label>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Fecha fin</Label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Resultados por día</Label>
              <Input
                type="number"
                min="1"
                max="500"
                value={items}
                onChange={(event) => setItems(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Tipo anunciante</Label>
              <Select value={advertiserType} onValueChange={(value) => setAdvertiserType(value as StatefoxAdvertiserType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Particulares</SelectItem>
                  <SelectItem value="professional">Profesionales</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {STATEFOX_SEARCH_MODE_OPTIONS.find((option) => option.value === mode)?.label || mode}
            </Badge>
            <Badge variant="outline">{STATEFOX_SOURCE_OPTIONS.find((option) => option.value === source)?.label}</Badge>
            {mode !== 'ids' && (
              <>
                <Badge variant="outline">{STATEFOX_OPERATION_LABELS[operation]}</Badge>
                <Badge variant="outline">{STATEFOX_HOUSING_LABELS[housing] || housing}</Badge>
              </>
            )}
            {advertiserType !== 'all' && (
              <Badge variant="outline">{STATEFOX_ADVERTISER_LABELS[advertiserType]}</Badge>
            )}
          </div>

          <Button onClick={handleSearch} disabled={loading || !canSearch}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            {mode === 'ids' ? 'Recuperar anuncios' : 'Buscar histórico'}
          </Button>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">{listings.length} anuncio(s) encontrados</p>
            <p className="text-xs text-muted-foreground">
              {selectedIds.length} seleccionado(s) para importar a captación.
            </p>
          </div>

          {searchMeta && (
            <div className="flex flex-wrap gap-2 text-xs">
              {searchMeta.mode !== 'ids' && searchMeta.datesProcessed && searchMeta.datesProcessed.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <CalendarRange className="h-3 w-3" />
                  {searchMeta.datesProcessed.length} fecha(s)
                </Badge>
              )}
              {typeof searchMeta.pagesFetched === 'number' && (
                <Badge variant="secondary">{searchMeta.pagesFetched} página(s)</Badge>
              )}
              {typeof searchMeta.totalFound === 'number' && (
                <Badge variant="secondary">{searchMeta.totalFound} bruto(s)</Badge>
              )}
              {Array.isArray(searchMeta.errors) && searchMeta.errors.length > 0 && (
                <Badge variant="destructive">{searchMeta.errors.length} incidencia(s)</Badge>
              )}
            </div>
          )}
        </div>

        {searchMeta?.errors && searchMeta.errors.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {searchMeta.errors.slice(0, 4).map((error, index) => (
              <p key={`${error.date || 'general'}-${index}`}>
                {error.date ? `${error.date}: ` : ''}{error.message}
              </p>
            ))}
            {searchMeta.errors.length > 4 && (
              <p>Y {searchMeta.errors.length - 4} incidencia(s) más.</p>
            )}
          </div>
        )}

        {listings.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(listings.map((listing) => listing.listingId))}>
              Seleccionar todos
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
              Vaciar selección
            </Button>
          </div>
        )}

        <ScrollArea className="h-[420px] rounded-lg border">
          <div className="divide-y">
            {listings.map((listing) => (
              <label key={listing.listingId} className="flex gap-4 p-4 hover:bg-muted/40 transition-colors">
                <Checkbox
                  checked={selectedIds.includes(listing.listingId)}
                  onCheckedChange={(checked) => toggleSelection(listing.listingId, checked === true)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{listing.advertiserName || 'Propietario sin nombre visible'}</p>
                      <p className="text-sm text-muted-foreground">
                        {listing.address || 'Dirección no visible'}
                        {listing.city ? ` · ${listing.city}` : ''}
                        {listing.region ? ` · ${listing.region}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{formatCurrency(listing.price)}</p>
                      <p className="text-xs text-muted-foreground">
                        {listing.pricePerMeter ? `${listing.pricePerMeter.toLocaleString('es-ES')} €/m²` : '€/m² n/d'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{STATEFOX_ADVERTISER_LABELS[listing.advertiserType] || listing.advertiserType || 'Sin tipo'}</Badge>
                    <Badge variant="outline">{STATEFOX_HOUSING_LABELS[listing.housing] || listing.housing || 'n/d'}</Badge>
                    <Badge variant="outline">{listing.rooms != null ? `${listing.rooms} hab.` : 'Hab. n/d'}</Badge>
                    <Badge variant="outline">{listing.baths != null ? `${listing.baths} baños` : 'Baños n/d'}</Badge>
                    <Badge variant="outline">{listing.builtArea != null ? `${listing.builtArea} m²` : 'm² n/d'}</Badge>
                    {listing.insertDate && <Badge variant="outline">Alta {listing.insertDate}</Badge>}
                    <Badge variant="outline">{listing.listingId}</Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {listing.phones[0] || 'Sin teléfono visible'}
                    </span>
                    {listing.link && (
                      <a href={listing.link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        Abrir anuncio
                      </a>
                    )}
                  </div>
                </div>
              </label>
            ))}

            {!loading && listings.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {mode === 'ids'
                  ? 'Pega IDs de Statefox y ejecuta la recuperación para traer anuncios concretos.'
                  : 'Define portal, operación, rango de fechas y ejecuta la búsqueda para traer anuncios captables desde Statefox.'}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cerrar</Button>
          <Button onClick={handleImport} disabled={importing || selectedListings.length === 0}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Importar {selectedListings.length} lead(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
