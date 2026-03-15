import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarPlus,
  CheckSquare,
  Clock3,
  FileWarning,
  Landmark,
  Megaphone,
  Building2,
  ShieldAlert,
  ShieldQuestion,
  Signature,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useOperationsActions } from '@/hooks/useOperationsActions';
import { useOperationsFeed, type OperationsItem } from '@/hooks/useOperationsFeed';
import { toast } from '@/hooks/use-toast';
import {
  CreateOfferDialog,
  CreateTaskDialog,
  CreateVisitDialog,
  ReassignPropertyDialog,
  ResolveOfferDialog,
} from '@/components/operations/OperationsDialogs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AISectionGuide from '@/components/ai/AISectionGuide';

type Agent = {
  user_id: string;
  full_name: string;
};

type PresetKey = 'all' | 'my_urgent' | 'legal' | 'closing' | 'delegated_today';

const ISSUE_LABELS: Record<OperationsItem['kind'], string> = {
  legal: 'Legal',
  closing: 'Cierre',
  signature: 'Firma',
  deed: 'Escritura',
  postsale: 'Postventa',
  stock: 'Stock',
  task: 'Tarea',
  visit: 'Visita',
  offer: 'Oferta',
  lead: 'Lead',
};

const PRESET_LABELS: Record<PresetKey, string> = {
  all: 'Todo',
  my_urgent: 'Mis urgentes',
  legal: 'Legal',
  closing: 'Cierre',
  delegated_today: 'Delegadas hoy',
};

const VALID_ISSUE_FILTERS: Array<'all' | OperationsItem['kind']> = ['all', 'legal', 'closing', 'signature', 'deed', 'postsale', 'stock', 'visit', 'offer', 'task', 'lead'];
const VALID_PRESETS: PresetKey[] = ['all', 'my_urgent', 'legal', 'closing', 'delegated_today'];

const getOperationsCenterPrefsKey = (userId?: string) => `operations-center-prefs:${userId || 'anonymous'}`;

const getIssueIcon = (kind: OperationsItem['kind']) => {
  if (kind === 'legal') return ShieldAlert;
  if (kind === 'closing') return FileWarning;
  if (kind === 'signature') return Signature;
  if (kind === 'deed') return Landmark;
  if (kind === 'postsale') return FileWarning;
  if (kind === 'stock') return Building2;
  if (kind === 'visit') return CalendarPlus;
  if (kind === 'offer') return ArrowUpRight;
  if (kind === 'lead') return Megaphone;
  return CheckSquare;
};

const getIssueBadgeVariant = (item: OperationsItem) => {
  if (item.severity === 'alta') return 'destructive' as const;
  if (item.kind === 'legal') return 'secondary' as const;
  return 'outline' as const;
};

const OperationsCenter = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, canViewAll } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('all');
  const [issueFilter, setIssueFilter] = useState<'all' | OperationsItem['kind']>('all');
  const [activePreset, setActivePreset] = useState<PresetKey>('all');
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const { items, setItems, loading } = useOperationsFeed({
    userId: user?.id,
    canViewAll,
    selectedAgentId,
    refreshToken,
  });
  const {
    reassigningProperty,
    setReassigningProperty,
    agentToAssign,
    setAgentToAssign,
    savingAgent,
    taskDraftForItem,
    setTaskDraftForItem,
    taskForm,
    setTaskForm,
    savingTask,
    visitDraftItem,
    setVisitDraftItem,
    visitForm,
    setVisitForm,
    savingVisit,
    offerDraftForVisit,
    setOfferDraftForVisit,
    offerForm,
    setOfferForm,
    savingOffer,
    offerResolutionItem,
    setOfferResolutionItem,
    offerResolutionStatus,
    setOfferResolutionStatus,
    savingOfferResolution,
    openTaskDialog,
    handleCreateTask,
    openOfferDialogFromVisit,
    openVisitDialog,
    handleCreateVisit,
    handleCreateOffer,
    openOfferResolutionDialog,
    handleResolveOffer,
    openReassignDialog,
    handleReassignAgent,
  } = useOperationsActions({
    user,
    canViewAll,
    selectedAgentId,
    agents,
    setItems,
    bumpRefresh: () => setRefreshToken((current) => current + 1),
  });

  useEffect(() => {
    if (!user) return;

    const queryPreset = searchParams.get('preset');
    const queryKind = searchParams.get('kind');
    const queryAgent = searchParams.get('agent');
    const hasQueryPrefs = !!(queryPreset || queryKind || queryAgent);

    if (hasQueryPrefs) {
      const nextPreset = VALID_PRESETS.includes((queryPreset || 'all') as PresetKey)
        ? (queryPreset || 'all') as PresetKey
        : 'all';
      const nextIssueFilter = VALID_ISSUE_FILTERS.includes((queryKind || 'all') as 'all' | OperationsItem['kind'])
        ? (queryKind || 'all') as 'all' | OperationsItem['kind']
        : 'all';
      const nextAgentId = canViewAll ? (queryAgent || 'all') : 'all';

      setActivePreset((current) => (current === nextPreset ? current : nextPreset));
      setIssueFilter((current) => (current === nextIssueFilter ? current : nextIssueFilter));
      setSelectedAgentId((current) => (current === nextAgentId ? current : nextAgentId));
      return;
    }

    try {
      const raw = window.localStorage.getItem(getOperationsCenterPrefsKey(user.id));
      if (!raw) return;

      const prefs = JSON.parse(raw) as {
        preset?: PresetKey;
        issueFilter?: 'all' | OperationsItem['kind'];
        selectedAgentId?: string;
      };

      if (prefs.preset && VALID_PRESETS.includes(prefs.preset)) setActivePreset(prefs.preset);
      if (prefs.issueFilter && VALID_ISSUE_FILTERS.includes(prefs.issueFilter)) setIssueFilter(prefs.issueFilter);
      if (canViewAll && prefs.selectedAgentId) setSelectedAgentId(prefs.selectedAgentId);
    } catch {
      // ignore malformed local preferences
    }
  }, [canViewAll, searchParams, user]);

  useEffect(() => {
    if (!user) return;

    const prefs = {
      preset: activePreset,
      issueFilter,
      selectedAgentId,
    };

    window.localStorage.setItem(getOperationsCenterPrefsKey(user.id), JSON.stringify(prefs));
  }, [activePreset, issueFilter, selectedAgentId, user]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (activePreset === 'all') next.delete('preset');
    else next.set('preset', activePreset);

    if (issueFilter === 'all') next.delete('kind');
    else next.set('kind', issueFilter);

    if (!canViewAll || selectedAgentId === 'all') next.delete('agent');
    else next.set('agent', selectedAgentId);

    const currentString = searchParams.toString();
    const nextString = next.toString();
    if (currentString !== nextString) {
      setSearchParams(next, { replace: true });
    }
  }, [activePreset, canViewAll, issueFilter, searchParams, selectedAgentId, setSearchParams]);

  useEffect(() => {
    if (!canViewAll) return;

    supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name')
      .then(({ data }) => {
        setAgents(((data || []) as Agent[]).filter((agent) => agent.full_name));
      });
  }, [canViewAll]);

  const completeManualTask = async (item: OperationsItem) => {
    if (!item.taskId || item.taskAutomatic) return;

    setResolvingTaskId(item.taskId);
    const { error } = await supabase
      .from('tasks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', item.taskId);

    if (error) {
      toast({
        title: 'No se pudo completar la tarea',
        description: error.message,
        variant: 'destructive',
      });
      setResolvingTaskId(null);
      return;
    }

    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setResolvingTaskId(null);
    toast({
      title: 'Tarea completada',
      description: 'La tarea manual ha salido de la cola operativa.',
    });
  };

  const visibleItems = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return items.filter((item) => {
      if (issueFilter !== 'all' && item.kind !== issueFilter) return false;

      if (activePreset === 'all') return true;
      if (activePreset === 'my_urgent') {
        return item.severity === 'alta' && (!user || item.agentId === user.id);
      }
      if (activePreset === 'legal') {
        return item.kind === 'legal';
      }
      if (activePreset === 'closing') {
        return ['closing', 'signature', 'deed', 'postsale', 'visit', 'offer', 'lead'].includes(item.kind);
      }
      if (activePreset === 'delegated_today') {
        return item.kind === 'task' && !item.taskAutomatic && !!item.createdAt && new Date(item.createdAt).getTime() >= startOfToday;
      }

      return true;
    });
  }, [activePreset, items, issueFilter, user]);

  const summary = useMemo(() => ({
    urgent: items.filter((item) => item.severity === 'alta').length,
    closing: items.filter((item) => ['closing', 'signature', 'deed', 'postsale'].includes(item.kind)).length,
    legal: items.filter((item) => item.kind === 'legal').length,
    commercialFollowup: items.filter((item) => ['task', 'visit', 'offer', 'lead'].includes(item.kind)).length,
  }), [items]);

  return (
    <div className="space-y-6">
      <AISectionGuide
        title="Centro de operaciones: esta es la cola real del dia"
        context="Aqui se juntan bloqueos, cierres, firmas, escritura, leads, ofertas, visitas y tareas. Es la bandeja donde se resuelve lo que ya esta vivo."
        doNow={`Ahora mismo tienes ${summary.urgent} bloqueo${summary.urgent === 1 ? '' : 's'} urgente${summary.urgent === 1 ? '' : 's'}, ${summary.closing} asunto${summary.closing === 1 ? '' : 's'} de cierre y ${summary.legal} tema${summary.legal === 1 ? '' : 's'} legal${summary.legal === 1 ? '' : 'es'}. Empieza por ahi.`}
        dontForget="Esta pantalla no es para leer por encima. Es para quitar bloqueos y dejar cada asunto con siguiente paso claro."
        risk="Si no resuelves esta cola, se enfria el negocio caliente, se retrasan firmas y se acumulan errores de cierre."
        actions={[
          { label: 'Que hago primero aqui', description: 'Ordena por urgencia y ataca lo que bloquea firma, arras o leads calientes.' },
          { label: 'Para que sirve de verdad', description: 'Para que un agente o un director no tenga que adivinar donde esta el fuego del dia.' },
          { label: 'Que error evitar', description: 'Usarla como panel de lectura. Aqui cada item deberia acabar resuelto, delegado o con tarea creada.' },
        ]}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1 tracking-wide">Pantalla diaria principal</p>
          <h1 className="text-3xl font-display font-bold tracking-tight">Centro de operaciones</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
            Esta es la cola principal de trabajo del CRM: legal, cierres, firmas, escrituras y presion comercial en un solo sitio.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canViewAll ? (
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Todos los agentes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los agentes</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.user_id} value={agent.user_id}>
                    {agent.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={issueFilter} onValueChange={(value) => setIssueFilter(value as 'all' | OperationsItem['kind'])}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Todos los asuntos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="legal">Legal</SelectItem>
              <SelectItem value="closing">Cierre</SelectItem>
              <SelectItem value="signature">Firma</SelectItem>
              <SelectItem value="deed">Escritura</SelectItem>
              <SelectItem value="postsale">Postventa</SelectItem>
              <SelectItem value="stock">Stock</SelectItem>
              <SelectItem value="visit">Visitas</SelectItem>
              <SelectItem value="offer">Ofertas</SelectItem>
              <SelectItem value="lead">Leads inbound</SelectItem>
              <SelectItem value="task">Tareas vencidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)] bg-primary/5">
        <CardContent className="p-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Empieza aquí el día</p>
            <p className="text-xs text-muted-foreground mt-1">
              Usa `Operaciones` para priorizar y resolver trabajo. `Planificación` queda para agenda, recurrencias y mantenimiento fino de tareas.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
            Ir a planificación
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">Alta prioridad</p>
            </div>
            <p className="text-3xl font-semibold mt-2">{summary.urgent}</p>
            <p className="text-xs text-muted-foreground mt-1">Asuntos que no deberian esperar.</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-primary">
              <Landmark className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">Cierre y firma</p>
            </div>
            <p className="text-3xl font-semibold mt-2">{summary.closing}</p>
            <p className="text-xs text-muted-foreground mt-1">Bloqueos, firmas y escrituras en curso.</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">Legal</p>
            </div>
            <p className="text-3xl font-semibold mt-2">{summary.legal}</p>
            <p className="text-xs text-muted-foreground mt-1">Riesgo alto, medio o expedientes sin analizar.</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sky-700">
              <Clock3 className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">Seguimiento comercial</p>
            </div>
            <p className="text-3xl font-semibold mt-2">{summary.commercialFollowup}</p>
            <p className="text-xs text-muted-foreground mt-1">Tareas vencidas, visitas, ofertas y leads inbound sin trabajar.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'my_urgent', 'legal', 'closing', 'delegated_today'] as PresetKey[]).map((preset) => (
          <Button
            key={preset}
            variant={activePreset === preset ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActivePreset(preset)}
          >
            {PRESET_LABELS[preset]}
          </Button>
        ))}
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cola operativa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Priorizada por gravedad, filtrable por vista de trabajo y con acceso directo al origen real del problema.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando centro de operaciones...</p>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                <ShieldQuestion className="h-4 w-4" />
                No hay asuntos abiertos con este filtro ahora mismo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleItems.slice(0, 24).map((item) => {
                const Icon = getIssueIcon(item.kind);
                return (
                  <div key={item.id} className="rounded-2xl border border-border/60 px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getIssueBadgeVariant(item)}>
                            {ISSUE_LABELS[item.kind]}
                          </Badge>
                          <Badge variant="outline">
                            {item.severity === 'alta' ? 'Prioridad alta' : 'Seguimiento'}
                          </Badge>
                        </div>
                        <div className="flex items-start gap-3 mt-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{item.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{item.summary}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                              <span>{item.meta}</span>
                              {canViewAll && item.agentId ? (
                                <span>Agente: {agentNameMap.get(item.agentId) || 'Asignado'}</span>
                              ) : null}
                              {item.updatedAt ? (
                                <span>
                                  Actualizado {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true, locale: es })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:justify-end lg:shrink-0">
                        {item.kind === 'lead' ? (
                          <Button variant="outline" onClick={() => openTaskDialog(item)}>
                            <CalendarPlus className="mr-1.5 h-4 w-4" />
                            Crear seguimiento
                          </Button>
                        ) : null}
                        {item.kind === 'stock' && item.id.startsWith('stock-mandate-') ? (
                          <Button variant="outline" onClick={() => navigate(item.route)}>
                            Renovar mandato
                          </Button>
                        ) : null}
                        {item.kind === 'stock' && item.id.startsWith('stock-publish-') ? (
                          <Button variant="outline" onClick={() => navigate(item.route)}>
                            Completar ficha
                          </Button>
                        ) : null}
                        {item.kind === 'stock' && item.id.startsWith('stock-distribution-') ? (
                          <Button variant="outline" onClick={() => navigate(item.route)}>
                            Activar difusión
                          </Button>
                        ) : null}
                        {['offer', 'visit'].includes(item.kind) && item.propertyId && item.contactId ? (
                          <Button variant="outline" onClick={() => openVisitDialog(item)}>
                            Programar visita
                          </Button>
                        ) : null}
                        {item.kind === 'visit' && item.propertyId && item.contactId ? (
                          <Button variant="outline" onClick={() => openOfferDialogFromVisit(item)}>
                            Registrar oferta
                          </Button>
                        ) : null}
                        {item.kind === 'offer' && item.offerId ? (
                          <Button variant="outline" onClick={() => openOfferResolutionDialog(item)}>
                            Resolver oferta
                          </Button>
                        ) : null}
                        {item.kind !== 'task' ? (
                          <Button variant="outline" onClick={() => openTaskDialog(item)}>
                            <CalendarPlus className="h-4 w-4 mr-1.5" />
                            Crear tarea
                          </Button>
                        ) : null}
                        {canViewAll && item.propertyId ? (
                          <Button variant="outline" onClick={() => openReassignDialog(item)}>
                            Reasignar agente
                          </Button>
                        ) : null}
                        {item.kind === 'task' && !item.taskAutomatic && item.taskId ? (
                          <Button
                            variant="outline"
                            onClick={() => completeManualTask(item)}
                            disabled={resolvingTaskId === item.taskId}
                          >
                            {resolvingTaskId === item.taskId ? 'Resolviendo...' : 'Completar'}
                          </Button>
                        ) : null}
                        {item.secondaryRoute && item.secondaryLabel ? (
                          <Button variant="outline" onClick={() => navigate(item.secondaryRoute || item.route)}>
                            {item.secondaryLabel}
                          </Button>
                        ) : null}
                        <Button variant="outline" onClick={() => navigate(item.route)}>
                          {item.routeLabel}
                        </Button>
                        <Button onClick={() => navigate(item.route)}>
                          Abrir
                          <ArrowUpRight className="h-4 w-4 ml-1.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ReassignPropertyDialog
        open={Boolean(reassigningProperty)}
        onOpenChange={(open) => {
          if (!open) {
            setReassigningProperty(null);
            setAgentToAssign('');
          }
        }}
        property={reassigningProperty}
        agents={agents}
        agentToAssign={agentToAssign}
        onAgentChange={setAgentToAssign}
        saving={savingAgent}
        onSubmit={handleReassignAgent}
      />

      <CreateTaskDialog
        open={Boolean(taskDraftForItem)}
        onOpenChange={(open) => {
          if (!open) {
            setTaskDraftForItem(null);
            setTaskForm({ title: '', due_date: '', description: '', priority: 'media' });
          }
        }}
        item={taskDraftForItem}
        form={taskForm}
        onFormChange={(updater) => setTaskForm((current) => updater(current))}
        saving={savingTask}
        onSubmit={handleCreateTask}
      />

      <CreateVisitDialog
        open={Boolean(visitDraftItem)}
        onOpenChange={(open) => {
          if (!open) {
            setVisitDraftItem(null);
            setVisitForm({ visit_date: '', notes: '' });
          }
        }}
        item={visitDraftItem}
        form={visitForm}
        onFormChange={(updater) => setVisitForm((current) => updater(current))}
        saving={savingVisit}
        onSubmit={handleCreateVisit}
      />

      <CreateOfferDialog
        open={Boolean(offerDraftForVisit)}
        onOpenChange={(open) => {
          if (!open) {
            setOfferDraftForVisit(null);
            setOfferForm({ amount: '', notes: '', status: 'pendiente' });
          }
        }}
        item={offerDraftForVisit}
        form={offerForm}
        onFormChange={(updater) => setOfferForm((current) => updater(current))}
        saving={savingOffer}
        onSubmit={handleCreateOffer}
      />

      <ResolveOfferDialog
        open={Boolean(offerResolutionItem)}
        onOpenChange={(open) => {
          if (!open) {
            setOfferResolutionItem(null);
            setOfferResolutionStatus('pendiente');
          }
        }}
        item={offerResolutionItem}
        status={offerResolutionStatus}
        onStatusChange={setOfferResolutionStatus}
        saving={savingOfferResolution}
        onSubmit={handleResolveOffer}
      />
    </div>
  );
};

export default OperationsCenter;
