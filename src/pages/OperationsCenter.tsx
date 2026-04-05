import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
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
import OperationsCenterHeader from '@/components/operations/OperationsCenterHeader';
import { useOperationsCenterPreferences, type OperationsCenterPresetKey } from '@/hooks/useOperationsCenterPreferences';
import { useOperationsActions } from '@/hooks/useOperationsActions';
import { useOperationsFeed, type OperationsItem } from '@/hooks/useOperationsFeed';
import { countDelegatedToday, filterOperationsItems, summarizeOperationsItems } from '@/lib/operations-feed';
import { toast } from '@/hooks/use-toast';
import OperationsNextFocusCard from '@/components/operations/OperationsNextFocusCard';
import OperationsPresetCards from '@/components/operations/OperationsPresetCards';
import OperationsQueue from '@/components/operations/OperationsQueue';
import {
  CreateOfferDialog,
  CreateTaskDialog,
  CreateVisitDialog,
  ReassignPropertyDialog,
  ResolveOfferDialog,
} from '@/components/operations/OperationsDialogs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AISectionGuide from '@/components/ai/AISectionGuide';

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

const PRESET_LABELS: Record<OperationsCenterPresetKey, string> = {
  all: 'Todo',
  my_urgent: 'Mis urgentes',
  legal: 'Legal',
  closing: 'Cierre',
  delegated_today: 'Delegadas hoy',
};

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
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const {
    agents,
    selectedAgentId,
    setSelectedAgentId,
    issueFilter,
    setIssueFilter,
    activePreset,
    setActivePreset,
  } = useOperationsCenterPreferences({
    userId: user?.id,
    canViewAll,
    searchParams,
    setSearchParams,
  });
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
  const agentNameMap = useMemo(
    () => new Map(agents.map((agent) => [agent.user_id, agent.full_name])),
    [agents],
  );

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
    return filterOperationsItems({
      items,
      issueFilter,
      activePreset,
      currentUserId: user?.id,
    });
  }, [activePreset, items, issueFilter, user?.id]);

  const summary = useMemo(() => summarizeOperationsItems(items), [items]);
  const delegatedTodayCount = useMemo(() => countDelegatedToday(items), [items]);
  const nextFocus = visibleItems[0] || items[0] || null;

  return (
    <div className="space-y-6">
      <OperationsCenterHeader
        canViewAll={canViewAll}
        selectedAgentId={selectedAgentId}
        setSelectedAgentId={setSelectedAgentId}
        agents={agents}
        issueFilter={issueFilter}
        setIssueFilter={setIssueFilter}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <OperationsNextFocusCard
          nextFocus={nextFocus}
          canViewAll={canViewAll}
          activePreset={activePreset}
          setActivePreset={setActivePreset}
          navigate={navigate}
          issueLabels={ISSUE_LABELS}
          getIssueBadgeVariant={getIssueBadgeVariant}
          agentNameMap={agentNameMap}
        />

        <OperationsPresetCards
          activePreset={activePreset}
          setActivePreset={setActivePreset}
          urgent={summary.urgent}
          commercialFollowup={summary.commercialFollowup}
          delegatedTodayCount={delegatedTodayCount}
        />
      </div>

      <AISectionGuide
        title="Centro de operaciones: esta es la cola real del dia"
        context="Aqui se juntan bloqueos, cierres, firmas, escritura, leads, ofertas, visitas y tareas. Es la bandeja donde se resuelve lo que ya esta vivo."
        doNow={`Ahora mismo tienes ${summary.urgent} bloqueo${summary.urgent === 1 ? '' : 's'} urgente${summary.urgent === 1 ? '' : 's'}, ${summary.closing} asunto${summary.closing === 1 ? '' : 's'} de cierre y ${summary.legal} tema${summary.legal === 1 ? '' : 's'} legal${summary.legal === 1 ? '' : 'es'}. Empieza por ahi.`}
        dontForget="Esta pantalla no es para leer por encima. Es para resolver, delegar o dejar siguiente paso claro."
        risk="Si no resuelves esta cola, se enfria el negocio caliente, se retrasan firmas y se acumulan errores de cierre."
        actions={[
          { label: 'Que hago primero aqui', description: 'Ordena por urgencia y ataca lo que bloquea firma, arras o leads calientes.' },
          { label: 'Para que sirve de verdad', description: 'Para que un agente o un director no tenga que adivinar donde esta el fuego del dia.' },
          { label: 'Que error evitar', description: 'Usarla como panel de lectura. Aqui cada item deberia acabar resuelto, delegado o con tarea creada.' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/60 bg-gradient-to-r from-card via-card to-muted/15 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-primary">
              <Landmark className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">Cierre y firma</p>
            </div>
            <p className="text-3xl font-semibold mt-2">{summary.closing}</p>
            <p className="text-xs text-muted-foreground mt-1">Bloqueos, firmas y escrituras en curso.</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-r from-card via-card to-muted/15 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs font-medium uppercase tracking-wide">Legal</p>
            </div>
            <p className="text-3xl font-semibold mt-2">{summary.legal}</p>
            <p className="text-xs text-muted-foreground mt-1">Riesgo alto, medio o expedientes sin analizar.</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-gradient-to-r from-card via-card to-muted/15 shadow-sm">
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
        {(['all', 'my_urgent', 'legal', 'closing', 'delegated_today'] as OperationsCenterPresetKey[]).map((preset) => (
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

      <OperationsQueue
        loading={loading}
        visibleItems={visibleItems}
        canViewAll={canViewAll}
        issueLabels={ISSUE_LABELS}
        getIssueBadgeVariant={getIssueBadgeVariant}
        getIssueIcon={getIssueIcon}
        agentNameMap={agentNameMap}
        openTaskDialog={openTaskDialog}
        openVisitDialog={openVisitDialog}
        openOfferDialogFromVisit={openOfferDialogFromVisit}
        openOfferResolutionDialog={openOfferResolutionDialog}
        openReassignDialog={openReassignDialog}
        completeManualTask={completeManualTask}
        resolvingTaskId={resolvingTaskId}
        navigate={navigate}
      />

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
