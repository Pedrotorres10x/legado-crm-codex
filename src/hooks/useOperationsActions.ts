import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { OperationsItem } from '@/hooks/useOperationsFeed';

type UserLike = {
  id: string;
};

type Agent = {
  user_id: string;
  full_name: string;
};

const REASSIGN_OPERATION_TABLES = [
  'visits',
  'offers',
  'matches',
  'generated_contracts',
  'communication_logs',
  'interactions',
] as const;

const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let index = 0; index < 32; index += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const useOperationsActions = ({
  user,
  canViewAll,
  selectedAgentId,
  agents,
  setItems,
  bumpRefresh,
}: {
  user: UserLike | null;
  canViewAll: boolean;
  selectedAgentId: string;
  agents: Agent[];
  setItems: React.Dispatch<React.SetStateAction<OperationsItem[]>>;
  bumpRefresh: () => void;
}) => {
  const [reassigningProperty, setReassigningProperty] = useState<{ propertyId: string; title: string; currentAgentId: string | null } | null>(null);
  const [agentToAssign, setAgentToAssign] = useState<string>('');
  const [savingAgent, setSavingAgent] = useState(false);
  const [taskDraftForItem, setTaskDraftForItem] = useState<OperationsItem | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', description: '', priority: 'media' });
  const [savingTask, setSavingTask] = useState(false);
  const [visitDraftItem, setVisitDraftItem] = useState<OperationsItem | null>(null);
  const [visitForm, setVisitForm] = useState({ visit_date: '', notes: '' });
  const [savingVisit, setSavingVisit] = useState(false);
  const [offerDraftForVisit, setOfferDraftForVisit] = useState<OperationsItem | null>(null);
  const [offerForm, setOfferForm] = useState({ amount: '', notes: '', status: 'pendiente' });
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerResolutionItem, setOfferResolutionItem] = useState<OperationsItem | null>(null);
  const [offerResolutionStatus, setOfferResolutionStatus] = useState('pendiente');
  const [savingOfferResolution, setSavingOfferResolution] = useState(false);

  const agentNameMap = useMemo(
    () => new Map(agents.map((agent) => [agent.user_id, agent.full_name] as const)),
    [agents],
  );

  const openTaskDialog = (item: OperationsItem) => {
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 24);

    setTaskDraftForItem(item);
    setTaskForm({
      title: `Seguimiento: ${item.title}`,
      due_date: dueDate.toISOString().slice(0, 16),
      description: item.summary,
      priority: item.severity === 'alta' ? 'alta' : 'media',
    });
  };

  const handleCreateTask = async () => {
    if (!user || !taskDraftForItem || !taskForm.title.trim() || !taskForm.due_date) return;

    setSavingTask(true);

    const payload = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      due_date: new Date(taskForm.due_date).toISOString(),
      priority: taskForm.priority,
      task_type: 'seguimiento',
      contact_id: taskDraftForItem.contactId || null,
      property_id: taskDraftForItem.propertyId || null,
      agent_id: taskDraftForItem.agentId || user.id,
      source: 'manual',
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      toast({
        title: 'No se pudo crear la tarea',
        description: error.message,
        variant: 'destructive',
      });
      setSavingTask(false);
      return;
    }

    setSavingTask(false);
    setTaskDraftForItem(null);
    toast({
      title: 'Tarea creada',
      description: 'He dejado el seguimiento manual vinculado a este asunto.',
    });

    if (taskDraftForItem.agentId === user.id || !canViewAll || selectedAgentId === 'all' || selectedAgentId === taskDraftForItem.agentId) {
      setItems((current) => [
        {
          id: `task-${data.id}`,
          kind: 'task',
          severity: taskForm.priority === 'alta' ? 'alta' : 'media',
          title: `Manual: ${taskForm.title.trim()}`,
          summary: taskForm.description.trim() || 'Seguimiento manual creado desde el centro de operaciones.',
          meta: `Vence ${formatDistanceToNow(new Date(taskForm.due_date), { addSuffix: true, locale: es })}`,
          route: '/tasks',
          routeLabel: 'Abrir tareas',
          secondaryRoute: taskDraftForItem.contactId
            ? `/contacts/${taskDraftForItem.contactId}`
            : taskDraftForItem.propertyId
              ? `/properties/${taskDraftForItem.propertyId}`
              : null,
          secondaryLabel: taskDraftForItem.contactId ? 'Contacto' : taskDraftForItem.propertyId ? 'Inmueble' : null,
          agentId: taskDraftForItem.agentId || user.id,
          updatedAt: new Date(taskForm.due_date).toISOString(),
          createdAt: new Date().toISOString(),
          taskId: data.id,
          taskAutomatic: false,
          propertyId: taskDraftForItem.propertyId,
          contactId: taskDraftForItem.contactId,
        },
        ...current,
      ]);
    }
  };

  const openOfferDialogFromVisit = (item: OperationsItem) => {
    if (!item.propertyId || !item.contactId) return;
    setOfferDraftForVisit(item);
    setOfferForm({
      amount: '',
      notes: item.summary,
      status: 'pendiente',
    });
  };

  const openVisitDialog = (item: OperationsItem) => {
    if (!item.propertyId || !item.contactId) return;
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setHours(12, 0, 0, 0);

    setVisitDraftItem(item);
    setVisitForm({
      visit_date: defaultDate.toISOString().slice(0, 16),
      notes: item.summary,
    });
  };

  const handleCreateVisit = async () => {
    if (!user || !visitDraftItem?.propertyId || !visitDraftItem.contactId || !visitForm.visit_date) return;

    setSavingVisit(true);
    const confirmationToken = generateToken();
    const { error } = await supabase.from('visits').insert({
      property_id: visitDraftItem.propertyId,
      contact_id: visitDraftItem.contactId,
      visit_date: new Date(visitForm.visit_date).toISOString(),
      notes: visitForm.notes.trim() || null,
      agent_id: visitDraftItem.agentId || user.id,
      confirmation_token: confirmationToken,
      confirmation_status: 'pendiente',
    });

    if (error) {
      toast({
        title: 'No se pudo programar la visita',
        description: error.message,
        variant: 'destructive',
      });
      setSavingVisit(false);
      return;
    }

    setSavingVisit(false);
    setVisitDraftItem(null);
    bumpRefresh();
    toast({
      title: 'Visita programada',
      description: 'La visita ya entra en seguimiento dentro de la cola operativa.',
    });
  };

  const handleCreateOffer = async () => {
    if (!user || !offerDraftForVisit?.propertyId || !offerDraftForVisit.contactId || !offerForm.amount.trim()) return;

    setSavingOffer(true);
    const { error } = await supabase.from('offers').insert({
      property_id: offerDraftForVisit.propertyId,
      contact_id: offerDraftForVisit.contactId,
      amount: parseFloat(offerForm.amount),
      notes: offerForm.notes.trim() || null,
      status: offerForm.status,
      agent_id: offerDraftForVisit.agentId || user.id,
    });

    if (error) {
      toast({
        title: 'No se pudo registrar la oferta',
        description: error.message,
        variant: 'destructive',
      });
      setSavingOffer(false);
      return;
    }

    setSavingOffer(false);
    setOfferDraftForVisit(null);
    bumpRefresh();
    toast({
      title: 'Oferta registrada',
      description: 'La negociacion ya entra en la cola operativa como oferta activa.',
    });
  };

  const openOfferResolutionDialog = (item: OperationsItem) => {
    if (!item.offerId) return;
    setOfferResolutionItem(item);
    setOfferResolutionStatus(item.offerStatus || 'pendiente');
  };

  const handleResolveOffer = async () => {
    if (!offerResolutionItem?.offerId) return;

    setSavingOfferResolution(true);
    const payload: Record<string, string> = { status: offerResolutionStatus };
    if (['aceptada', 'rechazada', 'retirada', 'expirada'].includes(offerResolutionStatus)) {
      payload.response_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from('offers')
      .update(payload)
      .eq('id', offerResolutionItem.offerId);

    if (error) {
      toast({
        title: 'No se pudo actualizar la oferta',
        description: error.message,
        variant: 'destructive',
      });
      setSavingOfferResolution(false);
      return;
    }

    setSavingOfferResolution(false);
    setOfferResolutionItem(null);
    bumpRefresh();
    toast({
      title: 'Oferta actualizada',
      description: 'La negociacion se ha refrescado en la cola operativa.',
    });
  };

  const openReassignDialog = (item: OperationsItem) => {
    if (!item.propertyId) return;

    setReassigningProperty({
      propertyId: item.propertyId,
      title: item.title,
      currentAgentId: item.agentId,
    });
    setAgentToAssign(item.agentId || '');
  };

  const handleReassignAgent = async () => {
    if (!reassigningProperty || !agentToAssign) return;

    setSavingAgent(true);

    const propertyUpdate = supabase
      .from('properties')
      .update({ agent_id: agentToAssign })
      .eq('id', reassigningProperty.propertyId);

    const openTasksUpdate = supabase
      .from('tasks')
      .update({ agent_id: agentToAssign })
      .eq('property_id', reassigningProperty.propertyId)
      .eq('completed', false);

    const linkedOperationUpdates = REASSIGN_OPERATION_TABLES.map((table) => (
      supabase
        .from(table)
        .update({ agent_id: agentToAssign })
        .eq('property_id', reassigningProperty.propertyId)
    ));

    const reassignResults = await Promise.all([
      propertyUpdate,
      openTasksUpdate,
      ...linkedOperationUpdates,
    ]);

    const failedResult = reassignResults.find((result) => result.error);

    if (failedResult?.error) {
      toast({
        title: 'No se pudo reasignar',
        description: failedResult.error.message || 'La reasignacion del inmueble ha fallado.',
        variant: 'destructive',
      });
      setSavingAgent(false);
      return;
    }

    const assignedAgentName = agentNameMap.get(agentToAssign) || 'nuevo agente';

    setItems((current) => {
      const updated = current.map((item) => (
        item.propertyId === reassigningProperty.propertyId || item.taskId && item.propertyId === reassigningProperty.propertyId
          ? { ...item, agentId: agentToAssign }
          : item
      ));

      if (canViewAll && selectedAgentId !== 'all') {
        return updated.filter((item) => item.agentId === selectedAgentId || (!item.propertyId && item.agentId === selectedAgentId));
      }

      return updated;
    });

    setSavingAgent(false);
    setReassigningProperty(null);
    toast({
      title: 'Inmueble reasignado',
      description: `La operacion y su seguimiento vinculado pasan ahora a ${assignedAgentName}.`,
    });
  };

  return {
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
  };
};
