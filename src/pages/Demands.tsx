import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowRight,
  ClipboardPaste,
  CheckCircle2,
  Clock3,
  Euro,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AISectionGuide from '@/components/ai/AISectionGuide';
import { useToast } from '@/hooks/use-toast';
import { ocrDemandScreenshot, prepareDemandScreenshot } from '@/lib/demandScreenshot';

type DemandRow = {
  id: string;
  created_at: string;
  updated_at: string;
  contact_id: string;
  operation: string | null;
  property_type: string | null;
  property_types: string[] | null;
  cities: string[] | null;
  zones: string[] | null;
  min_price: number | null;
  max_price: number | null;
  min_bedrooms: number | null;
  notes: string | null;
  auto_match: boolean;
  is_active: boolean | null;
  contacts: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    agent_id: string | null;
    pipeline_stage: string | null;
    tags: string[] | null;
  } | null;
};

type DemandView = DemandRow & {
  sourceLabel: string;
  sourceKey: 'outlook' | 'portal' | 'web' | 'manual';
  needsReview: boolean;
  matchCount: number;
  lastTouchAt: string | null;
};

type DemandsInboxResponse = {
  ok?: boolean;
  error?: string;
  total?: number;
  rows?: (DemandRow & {
    matchCount?: number;
    lastTouchAt?: string | null;
  })[];
};

type ScreenshotIntakeResponse = {
  ok?: boolean;
  error?: string;
  contact_id?: string | null;
  demand_id?: string | null;
  duplicate?: boolean;
  duplicate_demand?: boolean;
  warnings?: string[];
};

const DEMANDS_PER_PAGE = 50;

const sourceBadgeClass: Record<DemandView['sourceKey'], string> = {
  outlook: 'bg-violet-100 text-violet-700 border-violet-300',
  portal: 'bg-sky-100 text-sky-700 border-sky-300',
  web: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  manual: 'bg-slate-100 text-slate-700 border-slate-300',
};

function inferSource(tags: string[]) {
  if (tags.includes('outlook-demanda')) return { key: 'outlook' as const, label: 'Outlook' };
  if (tags.includes('portal-lead')) return { key: 'portal' as const, label: 'Portal' };
  if (tags.includes('web-lead')) return { key: 'web' as const, label: 'Web' };
  return { key: 'manual' as const, label: 'Manual' };
}

function compactDemandTitle(demand: DemandRow) {
  const types = demand.property_types?.length ? demand.property_types : demand.property_type ? [demand.property_type] : [];
  const typeLabel = types.length ? types.join(', ') : 'Sin tipologia';
  const opLabel = demand.operation || 'venta';
  return `${typeLabel} · ${opLabel}`;
}

function formatBudget(demand: DemandRow) {
  if (demand.min_price && demand.max_price) {
    return `${demand.min_price.toLocaleString('es-ES')}€ - ${demand.max_price.toLocaleString('es-ES')}€`;
  }
  if (demand.max_price) return `Hasta ${demand.max_price.toLocaleString('es-ES')}€`;
  if (demand.min_price) return `Desde ${demand.min_price.toLocaleString('es-ES')}€`;
  return 'Sin presupuesto';
}

export default function Demands() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, canViewAll } = useAuth();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingFromScreenshot, setCreatingFromScreenshot] = useState(false);
  const [pasteModeActive, setPasteModeActive] = useState(false);
  const [demands, setDemands] = useState<DemandView[]>([]);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | DemandView['sourceKey']>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'review' | 'ready'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const loadInbox = useCallback(async () => {
    let payload: DemandsInboxResponse | null = null;

    const { data, error } = await supabase.functions.invoke('demands-inbox', {
      body: { limit: 5000, version: '2026-03-21-portal-fix' },
    });

    if (!error && data?.ok) {
      payload = data as DemandsInboxResponse;
    } else {
      const fallbackResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/demands-inbox`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ limit: 5000, version: '2026-03-21-portal-fix' }),
      });

      const fallbackData = (await fallbackResponse.json()) as DemandsInboxResponse;
      if (!fallbackResponse.ok || !fallbackData?.ok) {
        throw new Error(
          fallbackData?.error ||
            error?.message ||
            'No se pudo cargar la bandeja de demandas',
        );
      }

      payload = fallbackData;
    }

    const demandRows = payload.rows ?? [];

    const mapped: DemandView[] = demandRows
      .filter((row) => row.contacts)
      .map((demand) => {
        const tags = demand.contacts?.tags ?? [];
        const source = inferSource(tags);
        const notes = String(demand.notes || '').toLowerCase();
        const needsReview =
          tags.includes('demanda-pendiente-revision') ||
          notes.includes('revisar') ||
          notes.includes('borrador outlook');

        return {
          ...demand,
          sourceLabel: source.label,
          sourceKey: source.key,
          needsReview,
          matchCount: demand.matchCount ?? 0,
          lastTouchAt: demand.lastTouchAt ?? null,
        };
      });

    setDemands(mapped);
  }, []);

  useEffect(() => {
    let alive = true;

    const fetchDemands = async () => {
      setLoading(true);
      await loadInbox();

      if (alive) {
        setLoading(false);
      }
    };

    fetchDemands().catch((error) => {
      console.error('[Demands] error loading inbox:', error);
      if (alive) {
        setDemands([]);
        setLoading(false);
        toast({
          title: 'No se han podido cargar las demandas',
          description: error instanceof Error ? error.message : 'Error desconocido',
          variant: 'destructive',
        });
      }
    });

    return () => {
      alive = false;
    };
  }, [canViewAll, loadInbox, toast, user?.id]);

  const filteredDemands = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return demands.filter((demand) => {
      if (sourceFilter !== 'all' && demand.sourceKey !== sourceFilter) return false;
      if (reviewFilter === 'review' && !demand.needsReview) return false;
      if (reviewFilter === 'ready' && demand.needsReview) return false;
      if (activeFilter === 'active' && !demand.is_active) return false;
      if (activeFilter === 'inactive' && demand.is_active) return false;

      if (!needle) return true;

      const searchBucket = [
        demand.contacts?.full_name,
        demand.contacts?.email,
        demand.contacts?.phone,
        demand.notes,
        demand.operation,
        demand.property_type,
        demand.property_types?.join(' '),
        demand.cities?.join(' '),
        demand.zones?.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchBucket.includes(needle);
    });
  }, [activeFilter, demands, reviewFilter, search, sourceFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sourceFilter, reviewFilter, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDemands.length / DEMANDS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const pagedDemands = filteredDemands.slice((page - 1) * DEMANDS_PER_PAGE, page * DEMANDS_PER_PAGE);

  const stats = useMemo(() => {
    return {
      total: demands.length,
      review: demands.filter((item) => item.needsReview).length,
      today: demands.filter((item) => {
        const created = new Date(item.created_at);
        const now = new Date();
        return created.toDateString() === now.toDateString();
      }).length,
      outlook: demands.filter((item) => item.sourceKey === 'outlook').length,
    };
  }, [demands]);

  const refreshDemands = useCallback(async () => {
    setLoading(true);
    await loadInbox();
    setLoading(false);
  }, [loadInbox]);

  const sendScreenshotIntake = useCallback(async (payload: { base64: string; mimeType: string; fileName: string; rawText?: string }) => {
      const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-demand-screenshot-intake`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image_base64: payload.base64,
          mime_type: payload.mimeType,
          file_name: payload.fileName,
          raw_text: payload.rawText,
        }),
      });
    }, []);

  const processScreenshotFile = useCallback(async (file: File) => {
    setCreatingFromScreenshot(true);

    try {
      const prepared = await prepareDemandScreenshot(file);
      let rawText: string | undefined;
      let response = await sendScreenshotIntake(prepared);
      let data = (await response.json().catch(() => ({}))) as ScreenshotIntakeResponse;

      const shouldRetryWithOcr =
        response.status === 429 ||
        String(data?.error || '').toLowerCase().includes('límite de peticiones') ||
        String(data?.error || '').toLowerCase().includes('limite de peticiones');

      if ((!response.ok || !data?.ok) && shouldRetryWithOcr) {
        rawText = await ocrDemandScreenshot(file);
        if (rawText) {
          response = await sendScreenshotIntake({ ...prepared, rawText });
          data = (await response.json().catch(() => ({}))) as ScreenshotIntakeResponse;
        }
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Error ${response.status} creando la demanda`);
      }

      setPasteModeActive(false);
      await refreshDemands();

      toast({
        title: data.duplicate_demand
          ? 'La demanda ya existia'
          : data.duplicate
            ? 'Contacto reutilizado y demanda creada'
            : 'Contacto y demanda creados',
        description: data.warnings?.length
          ? data.warnings.join(' · ')
          : 'La entrada ya esta guardada en el CRM.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo crear desde el pantallazo',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setCreatingFromScreenshot(false);
    }
  }, [refreshDemands, sendScreenshotIntake, toast]);

  useEffect(() => {
    if (!pasteModeActive) return;

    const onPaste = async (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (!imageItem) return;

      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      await processScreenshotFile(file);
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [pasteModeActive, processScreenshotFile]);

  return (
    <div className="space-y-4 md:space-y-6">
      <AISectionGuide
        title="Demandas entrantes"
        context="Esta bandeja te deja ver de un vistazo lo que acaba de entrar al CRM sin abrir contacto por contacto."
        doNow={`Ahora mismo hay ${stats.total} demandas visibles, ${stats.review} pendientes de revisión y ${stats.today} creadas hoy.`}
        dontForget="Si una demanda entra desde Outlook o un portal, conviene validar presupuesto, zona y duplicados antes de activarla."
        risk="Si no revisas esta entrada, se acumulan demandas duplicadas, mal clasificadas o sin seguimiento."
        actions={[
          { label: 'Que revisar primero', description: 'Empieza por las que salen como Pendiente de revisión y por las más recientes.' },
          { label: 'Que significa listo', description: 'La demanda ya tiene contexto suficiente y no está marcada para revisión manual.' },
          { label: 'Donde sigo trabajando', description: 'Desde cada fila puedes saltar al contacto para editar la demanda o ver sus cruces.' },
        ]}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bandeja</p>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Demandas</h1>
            <p className="text-sm text-muted-foreground">
              Vista directa para revisar lo que entra al CRM y decidir rápido qué necesita seguimiento, limpieza o activación.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                await processScreenshotFile(file);
              }}
            />
            <Button
              type="button"
              variant={pasteModeActive ? 'secondary' : 'outline'}
              onClick={() => {
                setPasteModeActive((current) => !current);
                if (!pasteModeActive) {
                  toast({
                    title: 'Modo pegar activado',
                    description: 'Pulsa Ctrl+V con el pantallazo copiado y crearemos contacto y demanda directamente.',
                  });
                }
              }}
              disabled={creatingFromScreenshot}
            >
              <ClipboardPaste className="h-4 w-4 mr-2" />
              {pasteModeActive ? 'Esperando Ctrl+V' : 'Pegar pantallazo'}
            </Button>
            <Button
              onClick={() => uploadInputRef.current?.click()}
              disabled={creatingFromScreenshot}
            >
              {creatingFromScreenshot ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {creatingFromScreenshot ? 'Creando...' : 'Subir pantallazo'}
            </Button>
          </div>
        </div>
      </div>

      {pasteModeActive && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <ClipboardPaste className="h-4 w-4 text-primary" />
            <span>Pega ahora la captura con <span className="font-medium">Ctrl+V</span>. En cuanto detectemos una imagen, creamos contacto y demanda directamente.</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Totales</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Search className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-bold">{stats.review}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Hoy</p>
              <p className="text-2xl font-bold">{stats.today}</p>
            </div>
            <Clock3 className="h-5 w-5 text-sky-500" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Desde Outlook</p>
              <p className="text-2xl font-bold">{stats.outlook}</p>
            </div>
            <Mail className="h-5 w-5 text-violet-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por persona, email, ciudad, notas..."
          />
          <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as typeof sourceFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los origenes</SelectItem>
              <SelectItem value="outlook">Outlook</SelectItem>
              <SelectItem value="portal">Portal</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as typeof reviewFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Revision" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="review">Pendiente de revision</SelectItem>
              <SelectItem value="ready">Lista para trabajar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={(value) => setActiveFilter(value as typeof activeFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Activas e inactivas</SelectItem>
              <SelectItem value="active">Solo activas</SelectItem>
              <SelectItem value="inactive">Solo inactivas</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Entrada reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando demandas...
            </div>
          ) : pagedDemands.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No hay demandas que cumplan esos filtros.
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Persona</TableHead>
                    <TableHead>Demanda</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cruces</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedDemands.map((demand) => (
                    <TableRow key={demand.id}>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={sourceBadgeClass[demand.sourceKey]}>
                              {demand.sourceLabel}
                            </Badge>
                            {demand.needsReview && (
                              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700">
                                Revisar
                              </Badge>
                            )}
                            {!demand.needsReview && (
                              <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-700">
                                Lista
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Hace {formatDistanceToNow(new Date(demand.created_at), { addSuffix: false, locale: es })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <button
                          className="text-left transition-colors hover:text-primary"
                          onClick={() => navigate(`/contacts/${demand.contact_id}`)}
                        >
                          <div className="font-medium">{demand.contacts?.full_name || 'Sin contacto'}</div>
                          <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                            {demand.contacts?.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {demand.contacts.phone}
                              </div>
                            )}
                            {demand.contacts?.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {demand.contacts.email}
                              </div>
                            )}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="font-medium">{compactDemandTitle(demand)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {demand.min_bedrooms ? `Min. ${demand.min_bedrooms} hab.` : 'Sin habitaciones minimas'}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-start gap-1 text-sm">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {demand.cities?.length
                              ? demand.cities.join(', ')
                              : demand.zones?.length
                                ? demand.zones.join(', ')
                                : 'Sin zona'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-start gap-1 text-sm">
                          <Euro className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                          <span>{formatBudget(demand)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            {demand.is_active ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Activa
                              </>
                            ) : (
                              <>
                                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                                Inactiva
                              </>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {demand.lastTouchAt
                              ? `Ultimo toque hace ${formatDistanceToNow(new Date(demand.lastTouchAt), { addSuffix: false, locale: es })}`
                              : 'Sin interacciones'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="secondary">{demand.matchCount}</Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/contacts/${demand.contact_id}`)}>
                            Abrir contacto
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => navigate('/matches')}>
                            Cruces
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredDemands.length > DEMANDS_PER_PAGE && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(page - 1) * DEMANDS_PER_PAGE + 1}-{Math.min(page * DEMANDS_PER_PAGE, filteredDemands.length)} de {filteredDemands.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setCurrentPage(page - 1)}>
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Pagina {page} de {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setCurrentPage(page + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
