import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Phone,
  Search,
  Sparkles,
  UserRoundSearch,
} from 'lucide-react';
import AISectionGuide from '@/components/ai/AISectionGuide';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type BuyerIntent = {
  score?: number | null;
  stage?: string | null;
  topCities?: string[] | null;
  topTopic?: string | null;
  topAreaSlug?: string | null;
};

type ContactRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  agent_id: string | null;
  contact_type: string;
  status: string;
  pipeline_stage: string | null;
  intent_stage: string | null;
  intent_score: number | null;
  intent_top_area_slug: string | null;
  intent_top_topic: string | null;
  buyer_intent: BuyerIntent | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
};

type InteractionRow = {
  contact_id: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role: string;
};

type BuyerWithoutDemandRow = ContactRow & {
  assignedAgentName: string | null;
  demandCount: number;
  lastTouchAt: string | null;
  hasContext: boolean;
  signalSummary: string;
};

const PAGE_SIZE = 50;

function formatRelative(date: string | null) {
  if (!date) return 'Sin actividad';
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true, locale: es });
}

function hasBuyerSignal(contact: ContactRow) {
  const fields = [
    contact.contact_type,
    contact.status,
    contact.pipeline_stage,
    contact.intent_stage,
    JSON.stringify(contact.buyer_intent ?? {}),
    ...(Array.isArray(contact.tags) ? contact.tags : []),
  ]
    .map((value) => String(value ?? '').toLowerCase())
    .filter(Boolean);

  return fields.some((value) =>
    value.includes('comprador') ||
    value.includes('buyer') ||
    value.includes('demanda') ||
    value.includes('demand')
  );
}

function hasStructuredContext(contact: ContactRow) {
  const topCities = Array.isArray(contact.buyer_intent?.topCities) ? contact.buyer_intent?.topCities : [];
  return Boolean(
    topCities.length ||
      contact.intent_top_area_slug ||
      contact.intent_top_topic ||
      contact.buyer_intent?.topTopic ||
      (contact.notes && contact.notes.trim().length >= 30)
  );
}

function buildSignalSummary(contact: ContactRow) {
  const tags = contact.tags ?? [];
  const topCities = Array.isArray(contact.buyer_intent?.topCities) ? contact.buyer_intent?.topCities : [];
  const signals = [
    topCities.length ? topCities.slice(0, 2).join(', ') : null,
    contact.intent_top_topic || contact.buyer_intent?.topTopic || null,
    contact.intent_stage ? `Intent ${contact.intent_stage}` : null,
    contact.intent_score ? `Score ${contact.intent_score}` : null,
    tags.includes('portal-lead') ? 'Portal' : null,
    tags.includes('web-lead') ? 'Web' : null,
  ].filter(Boolean);

  return signals.slice(0, 3).join(' · ') || 'Solo ficha comprador, sin briefing estructurado';
}

export default function BuyersWithoutDemand() {
  const navigate = useNavigate();
  const { user, canViewAll } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BuyerWithoutDemandRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'context' | 'assigned' | 'unassigned'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);

      let contactsQuery = supabase
        .from('contacts')
        .select(`
          id, full_name, email, phone, agent_id, contact_type, status, pipeline_stage,
          intent_stage, intent_score, intent_top_area_slug, intent_top_topic,
          buyer_intent, tags, notes, created_at
        `)
        .order('created_at', { ascending: false });

      if (user?.id && !canViewAll) {
        contactsQuery = contactsQuery.eq('agent_id', user.id);
      }

      const [{ data: contacts, error: contactsError }, { data: demands, error: demandsError }, { data: profiles, error: profilesError }] = await Promise.all([
        contactsQuery,
        supabase.from('demands').select('id, contact_id'),
        supabase.from('profiles').select('id, full_name, role'),
      ]);

      if (contactsError) throw contactsError;
      if (demandsError) throw demandsError;
      if (profilesError) throw profilesError;

      const typedContacts = (contacts ?? []) as ContactRow[];
      const demandRows = demands ?? [];
      const profileMap = new Map<string, ProfileRow>(
        ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
      );
      const demandCountByContact = new Map<string, number>();

      for (const demand of demandRows) {
        const current = demandCountByContact.get(String(demand.contact_id)) ?? 0;
        demandCountByContact.set(String(demand.contact_id), current + 1);
      }

      const candidateContacts = typedContacts.filter((contact) => hasBuyerSignal(contact));
      const orphanContacts = candidateContacts.filter((contact) => !demandCountByContact.has(contact.id));
      const orphanIds = orphanContacts.map((contact) => contact.id);

      const { data: interactions, error: interactionsError } = orphanIds.length
        ? await supabase
            .from('interactions')
            .select('contact_id, created_at')
            .in('contact_id', orphanIds)
            .order('created_at', { ascending: false })
        : { data: [], error: null };

      if (interactionsError) throw interactionsError;

      const lastTouchMap = new Map<string, string>();
      for (const item of (interactions ?? []) as InteractionRow[]) {
        if (!lastTouchMap.has(item.contact_id)) {
          lastTouchMap.set(item.contact_id, item.created_at);
        }
      }

      const mapped = orphanContacts.map((contact) => ({
        ...contact,
        assignedAgentName: contact.agent_id ? profileMap.get(contact.agent_id)?.full_name ?? null : null,
        demandCount: 0,
        lastTouchAt: lastTouchMap.get(contact.id) ?? null,
        hasContext: hasStructuredContext(contact),
        signalSummary: buildSignalSummary(contact),
      }));

      if (alive) {
        setRows(mapped);
        setLoading(false);
      }
    };

    load().catch((error) => {
      console.error('[BuyersWithoutDemand] error loading:', error);
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

    return rows.filter((row) => {
      if (filter === 'context' && !row.hasContext) return false;
      if (filter === 'assigned' && !row.agent_id) return false;
      if (filter === 'unassigned' && row.agent_id) return false;

      if (!needle) return true;

      const searchBucket = [
        row.full_name,
        row.email,
        row.phone,
        row.signalSummary,
        row.contact_type,
        row.status,
        row.pipeline_stage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchBucket.includes(needle);
    });
  }, [filter, rows, search]);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      withContext: rows.filter((row) => row.hasContext).length,
      assigned: rows.filter((row) => row.agent_id).length,
      unassigned: rows.filter((row) => !row.agent_id).length,
    };
  }, [rows]);

  return (
    <div className="space-y-4 md:space-y-6">
      <AISectionGuide
        title="Compradores sin demanda"
        context="Aquí se ve el agujero real del embudo: compradores dados de alta en CRM que todavía no tienen una demanda estructurada para cruzar."
        doNow={`Ahora mismo hay ${stats.total} compradores sin demanda. ${stats.withContext} ya traen contexto útil y ${stats.unassigned} siguen sin asignar.`}
        dontForget="Si el comprador no tiene demanda, el motor no puede cruzarlo aunque el contacto exista y esté asignado."
        risk="Si no conviertes estas fichas en demanda, se quedan fuera de cruces, WhatsApp y seguimiento comercial."
        actions={[
          { label: 'Qué mirar primero', description: 'Empieza por los que sí tienen contexto y por los que entraron por portal o web.' },
          { label: 'Qué significa contexto', description: 'Hay señales suficientes en buyer_intent, notas o zona para crear la demanda sin partir de cero.' },
          { label: 'Qué hacer después', description: 'Abre la ficha del contacto directamente en Demandas y registra lo que busca.' },
        ]}
      />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <UserRoundSearch className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bandeja</p>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Compradores sin demanda</h1>
        <p className="text-sm text-muted-foreground">
          Lista operativa para convertir contactos compradores en demandas reales y meterlos por fin en el motor de cruces.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Sin demanda</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Con contexto</p>
              <p className="text-2xl font-bold">{stats.withContext}</p>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Asignados</p>
              <p className="text-2xl font-bold">{stats.assigned}</p>
            </div>
            <BriefcaseBusiness className="h-5 w-5 text-emerald-600" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Sin asignar</p>
              <p className="text-2xl font-bold">{stats.unassigned}</p>
            </div>
            <Clock3 className="h-5 w-5 text-rose-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtro rápido</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, email, teléfono o señales..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
              Todos
            </Button>
            <Button variant={filter === 'context' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('context')}>
              Con contexto
            </Button>
            <Button variant={filter === 'assigned' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('assigned')}>
              Asignados
            </Button>
            <Button variant={filter === 'unassigned' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('unassigned')}>
              Sin asignar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Fichas a convertir en demanda</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando compradores...
            </div>
          ) : pagedRows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No hay compradores sin demanda con esos filtros.
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona</TableHead>
                    <TableHead>Comercial</TableHead>
                    <TableHead>Señales</TableHead>
                    <TableHead>Actividad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="font-medium">{row.full_name}</div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {row.phone ? (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {row.phone}
                              </div>
                            ) : null}
                            {row.email ? (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {row.email}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {row.agent_id ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{row.assignedAgentName || 'Asignado'}</div>
                            <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-700">
                              Asignado
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="outline" className="border-rose-300 bg-rose-100 text-rose-700">
                            Sin asignar
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <p className="text-sm">{row.signalSummary}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{row.contact_type}</Badge>
                            <Badge variant="secondary">{row.status}</Badge>
                            {row.hasContext ? (
                              <Badge variant="outline" className="border-sky-300 bg-sky-100 text-sky-700">
                                Con contexto
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-muted bg-muted/40 text-muted-foreground">
                                Falta briefing
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <div>{formatRelative(row.lastTouchAt)}</div>
                          <div className="text-xs text-muted-foreground">
                            Alta {formatRelative(row.created_at)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {row.hasContext ? (
                          <div className="flex items-center gap-1 text-sm text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Lista para demanda
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm text-amber-700">
                            <Clock3 className="h-3.5 w-3.5" />
                            Hay que completar búsqueda
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => navigate(`/contacts/${row.id}?tab=demands`)}
                          >
                            Crear demanda
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/contacts/${row.id}`)}
                          >
                            Abrir ficha
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredRows.length > PAGE_SIZE ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filteredRows.length)} de {filteredRows.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {safePage} de {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
