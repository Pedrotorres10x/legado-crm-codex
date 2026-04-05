import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquareMore,
  RefreshCcw,
  Search,
  Send,
  TimerReset,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AISectionGuide from '@/components/ai/AISectionGuide';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type LogRow = {
  id: string;
  contact_id: string;
  property_id: string | null;
  demand_id: string | null;
  created_at: string;
  direction: string;
  source: string | null;
  status: string;
  body_preview: string | null;
  metadata: {
    match_whatsapp_stage?: string;
    opener_attempt?: number;
    max_opener_attempts?: number;
    retries_remaining?: number;
    next_retry_at?: string | null;
    pending_response?: boolean;
  } | null;
  contacts: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    agent_id: string | null;
  } | null;
  properties: {
    id: string;
    title: string | null;
    city: string | null;
    price: number | null;
  } | null;
};

type MatchRow = {
  demand_id: string;
  property_id: string;
  status: string;
};

type PendingRow = {
  key: string;
  contactId: string;
  demandId: string | null;
  propertyId: string;
  contactName: string;
  phone: string | null;
  email: string | null;
  propertyTitle: string;
  propertyCity: string | null;
  propertyPrice: number | null;
  lastSentAt: string;
  attempt: number;
  maxAttempts: number;
  retriesRemaining: number;
  nextRetryAt: string | null;
  pendingResponse: boolean;
  hasReply: boolean;
  hasFollowUp: boolean;
  matchStatus: string | null;
};

const PAGE_SIZE = 50;

function formatRelative(date: string | null) {
  if (!date) return 'Sin fecha';
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true, locale: es });
}

function formatPrice(price: number | null) {
  if (!price) return 'Consultar';
  return `${price.toLocaleString('es-ES')}€`;
}

export default function WhatsAppPending() {
  const navigate = useNavigate();
  const { user, canViewAll } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'due' | 'exhausted' | 'answered'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);

      let query = supabase
        .from('communication_logs')
        .select(`
          id, contact_id, property_id, demand_id, created_at, direction, source, status, body_preview, metadata,
          contacts!inner(id, full_name, phone, email, agent_id),
          properties(id, title, city, price)
        `)
        .eq('channel', 'whatsapp')
        .order('created_at', { ascending: false });

      if (user?.id && !canViewAll) {
        query = query.eq('contacts.agent_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const logRows = (data ?? []) as LogRow[];
      const demandIds = Array.from(new Set(logRows.map((row) => row.demand_id).filter(Boolean))) as string[];
      const propertyIds = Array.from(new Set(logRows.map((row) => row.property_id).filter(Boolean))) as string[];

      const { data: matchesData, error: matchesError } = demandIds.length && propertyIds.length
        ? await supabase
            .from('matches')
            .select('demand_id, property_id, status')
            .in('demand_id', demandIds)
            .in('property_id', propertyIds)
        : { data: [], error: null };

      if (matchesError) throw matchesError;

      const matchMap = new Map<string, MatchRow>();
      for (const match of (matchesData ?? []) as MatchRow[]) {
        matchMap.set(`${match.demand_id}_${match.property_id}`, match);
      }

      const latestInboundByContact = new Map<string, string>();
      for (const row of logRows) {
        if (row.direction !== 'inbound') continue;
        const prev = latestInboundByContact.get(row.contact_id);
        if (!prev || new Date(row.created_at).getTime() > new Date(prev).getTime()) {
          latestInboundByContact.set(row.contact_id, row.created_at);
        }
      }

      const openerRows = logRows.filter((row) =>
        row.direction === 'outbound' &&
        row.source === 'cruces' &&
        row.property_id &&
        (row.metadata?.match_whatsapp_stage || 'opener') === 'opener',
      );

      const followUpSet = new Set(
        logRows
          .filter((row) => row.direction === 'outbound' && row.source === 'cruces_followup' && row.property_id)
          .map((row) => `${row.contact_id}_${row.property_id}`),
      );

      const latestOpenerByKey = new Map<string, PendingRow>();
      for (const row of openerRows) {
        const propertyId = row.property_id!;
        const key = `${row.contact_id}_${propertyId}`;
        if (latestOpenerByKey.has(key)) continue;

        const attempt = Number(row.metadata?.opener_attempt || 1);
        const maxAttempts = Number(row.metadata?.max_opener_attempts || 3);
        const retriesRemaining = Number(row.metadata?.retries_remaining ?? Math.max(0, maxAttempts - attempt));
        const latestInboundAt = latestInboundByContact.get(row.contact_id);
        const hasReply = Boolean(latestInboundAt && new Date(latestInboundAt).getTime() > new Date(row.created_at).getTime());
        const hasFollowUp = followUpSet.has(key);
        const matchKey = row.demand_id ? `${row.demand_id}_${propertyId}` : null;
        const matchStatus = matchKey ? matchMap.get(matchKey)?.status ?? null : null;

        latestOpenerByKey.set(key, {
          key,
          contactId: row.contact_id,
          demandId: row.demand_id,
          propertyId,
          contactName: row.contacts?.full_name || 'Sin nombre',
          phone: row.contacts?.phone || null,
          email: row.contacts?.email || null,
          propertyTitle: row.properties?.title || 'Propiedad',
          propertyCity: row.properties?.city || null,
          propertyPrice: row.properties?.price || null,
          lastSentAt: row.created_at,
          attempt,
          maxAttempts,
          retriesRemaining,
          nextRetryAt: row.metadata?.next_retry_at || null,
          pendingResponse: Boolean(row.metadata?.pending_response),
          hasReply,
          hasFollowUp,
          matchStatus,
        });
      }

      if (alive) {
        setRows(Array.from(latestOpenerByKey.values()));
        setLoading(false);
      }
    };

    load().catch((err) => {
      console.error('[WhatsAppPending] error loading queue:', err);
      if (alive) {
        setRows([]);
        setLoading(false);
      }
    });

    return () => {
      alive = false;
    };
  }, [canViewAll, user?.id]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();

    return rows.filter((row) => {
      const due = Boolean(row.nextRetryAt && new Date(row.nextRetryAt).getTime() <= now);
      const exhausted = !row.hasReply && !row.hasFollowUp && row.attempt >= row.maxAttempts;
      const pending = !row.hasReply && !row.hasFollowUp && !exhausted;
      const answered = row.hasReply || row.hasFollowUp;

      if (filter === 'pending' && !pending) return false;
      if (filter === 'due' && !due) return false;
      if (filter === 'exhausted' && !exhausted) return false;
      if (filter === 'answered' && !answered) return false;

      if (!needle) return true;

      const bucket = [
        row.contactName,
        row.phone,
        row.email,
        row.propertyTitle,
        row.propertyCity,
      ].filter(Boolean).join(' ').toLowerCase();

      return bucket.includes(needle);
    });
  }, [filter, rows, search]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const stats = useMemo(() => {
    const now = Date.now();
    const pending = rows.filter((row) => !row.hasReply && !row.hasFollowUp && row.attempt < row.maxAttempts).length;
    const due = rows.filter((row) => !row.hasReply && !row.hasFollowUp && row.nextRetryAt && new Date(row.nextRetryAt).getTime() <= now).length;
    const exhausted = rows.filter((row) => !row.hasReply && !row.hasFollowUp && row.attempt >= row.maxAttempts).length;
    const answered = rows.filter((row) => row.hasReply || row.hasFollowUp).length;

    return { total: rows.length, pending, due, exhausted, answered };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4 md:space-y-6">
      <AISectionGuide
        title="Pendientes de WhatsApp"
        context="Esta bandeja te enseña a quién se le escribió por cruces, en qué intento está y cuándo toca volver a intentarlo."
        doNow={`Ahora mismo hay ${stats.pending} contactos pendientes, ${stats.due} listos para reintento y ${stats.exhausted} con la secuencia agotada.`}
        dontForget="Cuando el contacto responde, el sistema manda el enlace de la vivienda y ese cruce deja de estar pendiente."
        risk="Si no controlas esta bandeja, puedes insistir de más, perder seguimiento o dejar cruces buenos sin revisar."
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <MessageSquareMore className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Seguimiento</p>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pendientes WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Control de envios automaticos, reintentos y contactos que siguen pendientes de respuesta.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            <Clock3 className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Listos hoy</p>
              <p className="text-2xl font-bold">{stats.due}</p>
            </div>
            <TimerReset className="h-5 w-5 text-sky-500" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Agotados</p>
              <p className="text-2xl font-bold">{stats.exhausted}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-rose-500" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Respondidos</p>
              <p className="text-2xl font-bold">{stats.answered}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.5fr_repeat(4,auto)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por contacto, telefono o vivienda"
              className="pl-9"
            />
          </div>
          <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>Todos</Button>
          <Button variant={filter === 'pending' ? 'default' : 'outline'} onClick={() => setFilter('pending')}>Pendientes</Button>
          <Button variant={filter === 'due' ? 'default' : 'outline'} onClick={() => setFilter('due')}>Listos</Button>
          <Button variant={filter === 'exhausted' ? 'default' : 'outline'} onClick={() => setFilter('exhausted')}>Agotados</Button>
          <Button variant={filter === 'answered' ? 'default' : 'outline'} onClick={() => setFilter('answered')}>Respondidos</Button>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bandeja de seguimiento</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando seguimiento de WhatsApp...
            </div>
          ) : pageRows.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="font-medium">No hay contactos en esta vista.</p>
              <p className="text-sm">Prueba con otro filtro o deja pasar tiempo para que aparezcan los reintentos.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Vivienda</TableHead>
                  <TableHead>Intento</TableHead>
                  <TableHead>Ultimo envio</TableHead>
                  <TableHead>Proximo reintento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => {
                  const due = Boolean(row.nextRetryAt && new Date(row.nextRetryAt).getTime() <= Date.now());
                  const exhausted = !row.hasReply && !row.hasFollowUp && row.attempt >= row.maxAttempts;
                  const answered = row.hasReply || row.hasFollowUp;

                  return (
                    <TableRow key={row.key}>
                      <TableCell>
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/contacts/${row.contactId}`)}
                            className="text-left font-medium hover:text-primary"
                          >
                            {row.contactName}
                          </button>
                          <div className="text-xs text-muted-foreground">
                            {row.phone || row.email || 'Sin telefono'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{row.propertyTitle}</div>
                          <div className="text-xs text-muted-foreground">
                            {[row.propertyCity, formatPrice(row.propertyPrice)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{row.attempt} / {row.maxAttempts}</div>
                          <div className="text-xs text-muted-foreground">
                            Quedan {row.retriesRemaining}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatRelative(row.lastSentAt)}</TableCell>
                      <TableCell>{row.nextRetryAt ? formatRelative(row.nextRetryAt) : 'Sin mas reintentos'}</TableCell>
                      <TableCell>
                        {answered ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">Respondido</Badge>
                        ) : exhausted ? (
                          <Badge className="bg-rose-100 text-rose-700 border-rose-300">Agotado</Badge>
                        ) : due ? (
                          <Badge className="bg-sky-100 text-sky-700 border-sky-300">Listo para reintento</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-300">Esperando respuesta</Badge>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          Match: {row.matchStatus || 'sin estado'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/contacts/${row.contactId}`)}>
                            <Send className="mr-2 h-4 w-4" />
                            Contacto
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={`/properties/${row.propertyId}`}>
                              <ArrowUpRight className="mr-2 h-4 w-4" />
                              Vivienda
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!loading && filteredRows.length > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredRows.length)} de {filteredRows.length}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed border-border/60">
        <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <RefreshCcw className="h-4 w-4 text-primary" />
          El control sale de `communication_logs` y de `matches`, asi que refleja el intento actual, si hubo respuesta y si el enlace ya se envio.
        </CardContent>
      </Card>
    </div>
  );
}
