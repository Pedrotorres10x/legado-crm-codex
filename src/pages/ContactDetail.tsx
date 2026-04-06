import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import LogCallDialog from '@/components/LogCallDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useContactDetailData } from '@/hooks/useContactDetailData';
import { useContactDemands } from '@/hooks/useContactDemands';
import { useContactFaktura } from '@/hooks/useContactFaktura';
import { useContactInteractions } from '@/hooks/useContactInteractions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { CheckCircle, Home, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

import InternalComments from '@/components/InternalComments';
import OffersSection from '@/components/OffersSection';
import ContactTimeline from '@/components/ContactTimeline';
import AssignPropertyToContact from '@/components/contacts/AssignPropertyToContact';
import ContactOverviewCards from '@/components/contacts/ContactOverviewCards';
import ContactEditDialog from '@/components/contacts/ContactEditDialog';
import ContactFakturaDialog from '@/components/contacts/ContactFakturaDialog';
import ContactInteractionDialog from '@/components/contacts/ContactInteractionDialog';
import ContactMatchesPanel from '@/components/contacts/ContactMatchesPanel';
import ContactPropertiesPanel from '@/components/contacts/ContactPropertiesPanel';
import ContactReengagementPanel from '@/components/contacts/ContactReengagementPanel';
import ContactVisitsPanel from '@/components/contacts/ContactVisitsPanel';
import MatchEmailHistory from '@/components/MatchEmailHistory';
import ContactCommunicationHistory from '@/components/ContactCommunicationHistory';
import ContactCallsPanel from '@/components/contacts/ContactCallsPanel';
import ContactDemandDialog from '@/components/contacts/ContactDemandDialog';
import { useContactEdit } from '@/hooks/useContactEdit';
import ContactTasksPanel from '@/components/contacts/ContactTasksPanel';
import { useContactHealthColors } from '@/hooks/useHealthColors';
import AISectionGuide from '@/components/ai/AISectionGuide';
import ContactDetailHero from '@/components/contacts/ContactDetailHero';
import ContactDetailMetrics from '@/components/contacts/ContactDetailMetrics';
import ContactDetailTabsList from '@/components/contacts/ContactDetailTabsList';
import ContactDetailStatusActions from '@/components/contacts/ContactDetailStatusActions';
import ContactDemandsTab from '@/components/contacts/ContactDemandsTab';
import ContactDetailMobileFab from '@/components/contacts/ContactDetailMobileFab';

const ReactMarkdown = lazy(() => import('react-markdown'));
const ContactDocuments = lazy(() => import('@/components/ContactDocuments'));
const DocumentRelationsPanel = lazy(() => import('@/components/DocumentRelationsPanel'));
const WhatsAppComposer = lazy(() => import('@/components/WhatsAppComposer'));


const typeLabels: Record<string, string> = { prospecto: 'Prospecto (dueño sin firmar)', propietario: 'Propietario (cliente)', comprador: 'Comprador', comprador_cerrado: 'Comprador (cerrado)', vendedor_cerrado: 'Vendedor (cerrado)', ambos: 'Ambos', colaborador: 'Colaborador', statefox: 'Statefox', contacto: 'Contacto' };
const statusLabels: Record<string, string> = { nuevo: 'Nuevo', en_seguimiento: 'En seguimiento', activo: 'Activo', cerrado: 'Cerrado' };
const interactionLabels: Record<string, string> = { llamada: 'Llamada', email: 'Email', visita: 'Visita', whatsapp: 'WhatsApp', reunion: 'Reunión', nota: 'Nota' };
const CONTACT_DETAIL_TABS = ['actividad', 'agenda', 'negocio', 'pipeline', 'documentos'] as const;

// Maps legacy URL tab params to consolidated tabs for backward compat
const LEGACY_TAB_MAP: Record<string, (typeof CONTACT_DETAIL_TABS)[number]> = {
  timeline: 'actividad', calls: 'actividad', emails: 'actividad',
  tasks: 'agenda', visits: 'agenda',
  properties: 'negocio', demands: 'negocio', matches: 'negocio',
  offers: 'pipeline', reengagement: 'pipeline',
  documents: 'documentos',
};

function resolveTab(raw: string | null): (typeof CONTACT_DETAIL_TABS)[number] {
  if (!raw) return 'actividad';
  if (CONTACT_DETAIL_TABS.includes(raw as (typeof CONTACT_DETAIL_TABS)[number])) {
    return raw as (typeof CONTACT_DETAIL_TABS)[number];
  }
  return LEGACY_TAB_MAP[raw] ?? 'actividad';
}

// Tipos de interacción y tarea adaptados al tipo de contacto
const INTERACTION_TYPES_BY_CONTACT: Record<string, { value: string; label: string }[]> = {
  propietario: [
    { value: 'llamada', label: '📞 Llamada' },
    { value: 'email', label: '✉️ Email' },
    { value: 'whatsapp', label: '💬 WhatsApp' },
    { value: 'reunion', label: '👥 Reunión' },
    { value: 'visita', label: '🏠 Visita al inmueble' },
    { value: 'nota', label: '📝 Nota interna' },
  ],
  prospecto: [
    { value: 'llamada', label: '📞 Llamada de prospección' },
    { value: 'email', label: '✉️ Email' },
    { value: 'whatsapp', label: '💬 WhatsApp' },
    { value: 'reunion', label: '👥 Reunión de captación' },
    { value: 'visita', label: '🏠 Visita al inmueble' },
    { value: 'nota', label: '📝 Nota interna' },
  ],
  comprador: [
    { value: 'llamada', label: '📞 Llamada' },
    { value: 'email', label: '✉️ Email' },
    { value: 'whatsapp', label: '💬 WhatsApp' },
    { value: 'visita', label: '🏠 Visita a inmueble' },
    { value: 'reunion', label: '👥 Reunión' },
    { value: 'nota', label: '📝 Nota interna' },
  ],
  comprador_cerrado: [
    { value: 'llamada', label: '📞 Llamada postventa' },
    { value: 'email', label: '✉️ Email' },
    { value: 'nota', label: '📝 Nota interna' },
  ],
  vendedor_cerrado: [
    { value: 'llamada', label: '📞 Llamada postventa' },
    { value: 'email', label: '✉️ Email' },
    { value: 'nota', label: '📝 Nota interna' },
  ],
};
const DEFAULT_INTERACTION_TYPES = Object.entries(interactionLabels).map(([k, v]) => ({ value: k, label: v }));

type ContactRow = Database['public']['Tables']['contacts']['Row'];
type ContactUpdate = Database['public']['Tables']['contacts']['Update'];
type ContactType = ContactRow['contact_type'];
type PipelineStage = ContactRow['pipeline_stage'];
type DemandUpdate = Database['public']['Tables']['demands']['Update'];
type MatchUpdate = Database['public']['Tables']['matches']['Update'];
type MatchStatus = Database['public']['Tables']['matches']['Row']['status'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];
type DemandRow = Database['public']['Tables']['demands']['Row'];
type AnnouncementInsert = Database['public']['Tables']['announcements']['Insert'];

const isAutomaticTask = (task: { source?: string | null }) => Boolean(task.source && task.source !== 'manual');

const getAutomaticTaskRoute = (task: { source?: string | null; property_id?: string | null; contact_id?: string | null }) => {
  if (task.property_id && ['closing_blocked', 'closing_signature_pending', 'closing_deed_due'].includes(task.source || '')) {
    return `/properties/${task.property_id}#cierre`;
  }

  if (task.contact_id) {
    return `/contacts/${task.contact_id}`;
  }

  return '/tasks';
};

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = resolveTab(requestedTab);
  const [activeTab, setActiveTab] = useState<(typeof CONTACT_DETAIL_TABS)[number]>(initialTab);
  const { user, isAdmin, isCoordinadora, canViewAll } = useAuth();
  const isMobile = useIsMobile();

  // Auto-open LogCallDialog when navigated from a call detection
  const [logCallOpen, setLogCallOpen] = useState(false);
  const { toast } = useToast();
  const {
    contact,
    setContact,
    visits,
    setVisits,
    offers,
    interactions,
    ownedProperties,
    demands,
    setDemands,
    contactMatches,
    reengagementHistory,
    arrasBuyerProperties,
    contactTasks,
    communicationLogs,
    contactInvoices,
    loading,
    loadData,
  } = useContactDetailData(id, {
    viewerUserId: user?.id,
    canViewAll,
  });

  // Quick interaction state
  const [waComposerOpen, setWaComposerOpen] = useState(false);
  const [callFilter, setCallFilter] = useState('all');
  const contactHealth = useContactHealthColors(contact ? [contact] : []);

  // Task form state
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggleTask = async (task: TaskRow) => {
    const { error } = await supabase.from('tasks').update({
      completed: !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
    }).eq('id', task.id);
    if (!error) loadData();
  };

  const handleDeleteTask = async (taskId: string) => {
    const task = contactTasks.find((item) => item.id === taskId);
    if (task && isAutomaticTask(task)) {
      toast({ title: 'Tarea automatica', description: 'Se resuelve desde su origen o marcandola como completada.' });
      return;
    }
    await supabase.from('tasks').delete().eq('id', taskId);
    loadData();
  };

  const handleMatchStatusChange = async (matchId: string, status: string) => {
    const payload: MatchUpdate = { status: status as MatchStatus };
    await supabase.from('matches').update(payload).eq('id', matchId);
    loadData();
    toast({ title: 'Estado actualizado' });
  };

  const openTasksForContact = () => {
    navigate(`/tasks?contact_id=${id}`);
  };

  const openNewTaskInCentralTray = () => {
    navigate(`/tasks?new=1&contact_id=${id}`);
  };

  const propertyTypes = ['piso', 'casa', 'chalet', 'adosado', 'atico', 'duplex', 'estudio', 'local', 'oficina', 'nave', 'terreno'] as const;
  const {
    demandDialogOpen,
    setDemandDialogOpen,
    demandEditId,
    demandForm,
    setDemandForm,
    demandSaving,
    demandExtracting,
    openNewDemand,
    openEditDemand,
    handleDemandSubmit,
    extractDemandFromScreenshot,
    toggleDemandActive,
    deleteDemand,
  } = useContactDemands({
    contactId: id,
    toast,
    onReload: loadData,
  });
  const {
    interactionOpen,
    setInteractionOpen,
    intForm,
    setIntForm,
    intSaving,
    summaryLoading,
    summary,
    handleAddInteraction,
    fetchSummary,
  } = useContactInteractions({
    contactId: id,
    agentId: user?.id,
    toast,
    onReload: loadData,
  });
  const {
    fakturaDialogOpen,
    setFakturaDialogOpen,
    fakturaLoading,
    fakturaProperties,
    selectedFakturaProperty,
    setSelectedFakturaProperty,
    openFakturaDialog,
    handleGenerateFaktura,
  } = useContactFaktura({
    contactId: id,
    contact,
    ownedProperties,
    agentId: user?.id,
    toast,
    onReload: loadData,
  });
  const {
    editOpen,
    setEditOpen,
    editForm,
    setEditForm,
    saving,
    tagInput,
    setTagInput,
    openEdit,
    handleSave,
    addTag,
    removeTag,
  } = useContactEdit({
    contactId: id,
    contact,
    toast,
    onReload: loadData,
  });

  // Auto-open call log dialog when navigated from call detection (?log_call=1)
  useEffect(() => {
    if (searchParams.get('log_call') === '1' && contact) {
      setLogCallOpen(true);
      // Remove the param from URL without triggering a navigation
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('log_call');
        return params;
      }, { replace: true });
    }
  }, [contact, searchParams, setSearchParams]);

  useEffect(() => {
    setActiveTab(resolveTab(searchParams.get('tab')));
  }, [searchParams]);
  const handleDeleteContact = async () => {
    if (!id) return;
    setDeleting(true);
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    setDeleting(false);
    if (error) { toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Contacto eliminado' });
    navigate('/contacts');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">
          {canViewAll ? 'Contacto no encontrado' : 'No puedes ver contactos de otros agentes'}
        </p>
        <Button variant="link" onClick={() => navigate('/contacts')}>Volver a contactos</Button>
      </div>
    );
  }

  const sectionFallback = (
    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Cargando seccion...
    </div>
  );
  const pendingTasksCount = contactTasks.filter((task) => !task.completed).length;
  const hasDirectChannel = Boolean(contact.phone || contact.email);
  const primaryAction = (() => {
    if (pendingTasksCount > 0) {
      return {
        label: 'Resolver siguiente paso',
        description: 'Este contacto ya tiene trabajo vivo. Empieza por la tarea que hoy lo puede mover.',
        onClick: openTasksForContact,
      };
    }

    if (contact.contact_type === 'comprador' && contactMatches.length > 0) {
      return {
        label: 'Ver cruces activos',
        description: 'Hay inmuebles compatibles listos para trabajar con este comprador.',
        onClick: () => setActiveTab('negocio'),
      };
    }

    if (contact.phone) {
      return {
        label: 'Enviar WhatsApp',
        description: 'La forma mas rapida de reactivar este contacto ahora mismo es escribirle.',
        onClick: () => setWaComposerOpen(true),
      };
    }

    return {
      label: 'Registrar interacción',
      description: 'Deja claro que ha pasado y que toca despues para que la ficha siga viva.',
      onClick: () => setInteractionOpen(true),
    };
  })();

  const topBlockers = [
    !hasDirectChannel ? 'Falta un canal directo de contacto' : null,
    pendingTasksCount === 0 ? 'No hay tarea viva ahora mismo' : null,
    interactions.length === 0 ? 'Aun no hay interacciones registradas' : null,
    (contact.contact_type === 'comprador' || contact.contact_type === 'ambos') && demands.length === 0 ? 'No hay demanda definida' : null,
    (contact.contact_type === 'propietario' || contact.contact_type === 'prospecto') && ownedProperties.length === 0 ? 'No tiene inmueble vinculado todavia' : null,
  ].filter(Boolean).slice(0, 3) as string[];

  return (
    <div className="space-y-6">
      <ContactDetailHero
        contact={contact}
        contactHealthInfo={contactHealth[contact.id]}
        typeLabels={typeLabels}
        statusLabels={statusLabels}
        isMobile={isMobile}
        isAdmin={isAdmin}
        isCoordinadora={isCoordinadora}
        deleteOpen={deleteOpen}
        deleting={deleting}
        ownedPropertiesCount={ownedProperties.length}
        primaryAction={primaryAction}
        topBlockers={topBlockers}
        onBack={() => navigate(-1)}
        onOpenWhatsApp={() => setWaComposerOpen(true)}
        onOpenInteraction={() => setInteractionOpen(true)}
        onOpenEdit={openEdit}
        onOpenDeleteChange={setDeleteOpen}
        onDeleteContact={handleDeleteContact}
        onOpenTask={openNewTaskInCentralTray}
        onOpenFaktura={openFakturaDialog}
        onOpenPropertiesTab={() => setActiveTab('negocio')}
        onNeedsMortgageChange={async (checked) => {
          const payload: ContactUpdate = { needs_mortgage: checked };
          setContact((current) => (current ? { ...current, needs_mortgage: checked } : current));
          await supabase.from('contacts').update(payload).eq('id', id!);
          if (checked) {
            const agentName = user?.user_metadata?.full_name || user?.email || 'Un agente';
            const announcement: AnnouncementInsert = {
              title: `🏦 ${contact.full_name} necesita hipoteca`,
              content: `El contacto **${contact.full_name}** ha sido marcado como "Necesita hipoteca" por ${agentName}. Revisar ficha: /contacts/${id}`,
              category: 'alerta',
              created_by: user?.id,
            };
            await supabase.from('announcements').insert(announcement);
            toast({ title: 'Aviso enviado al admin', description: 'Se ha notificado que el cliente necesita hipoteca' });
          }
        }}
        onFetchSummary={fetchSummary}
        summaryLoading={summaryLoading}
      />

      {!isMobile && (
        <ContactDetailMetrics
          interactionsCount={interactions.length}
          pendingTasksCount={pendingTasksCount}
          visitsCount={visits.length}
          matchesCount={contactMatches.length}
        />
      )}

      <AISectionGuide
        title={`Ficha de ${contact.full_name || 'contacto'}`}
        context={
          contact.contact_type === 'prospecto'
            ? 'Este contacto es un dueno sin firmar. Aqui debes convertir interes en visita de captacion y luego en cliente.'
            : contact.contact_type === 'propietario'
              ? 'Este contacto ya es cliente propietario. Aqui debes cuidar captacion, producto y cierre.'
              : contact.contact_type === 'comprador'
                ? 'Este contacto es comprador. Aqui debes mover visitas, seguimiento, oferta y cierre.'
                : 'Esta ficha concentra relacion, seguimiento y siguiente paso comercial.'
        }
        doNow={
          contact.contact_type === 'prospecto'
            ? `Tiene ${interactions.length} interaccion${interactions.length === 1 ? '' : 'es'}, ${pendingTasksCount} tarea${pendingTasksCount === 1 ? '' : 's'} pendiente${pendingTasksCount === 1 ? '' : 's'} y ${ownedProperties.length} inmueble${ownedProperties.length === 1 ? '' : 's'} vinculado${ownedProperties.length === 1 ? '' : 's'}. Tu objetivo es llevarlo a firma.`
            : contact.contact_type === 'comprador'
              ? `Tiene ${visits.length} visita${visits.length === 1 ? '' : 's'}, ${offers.length} oferta${offers.length === 1 ? '' : 's'} y ${contactMatches.length} cruce${contactMatches.length === 1 ? '' : 's'} activo${contactMatches.length === 1 ? '' : 's'}. Empieza por lo mas caliente.`
              : `Tiene ${pendingTasksCount} tarea${pendingTasksCount === 1 ? '' : 's'} pendiente${pendingTasksCount === 1 ? '' : 's'}, ${interactions.length} interaccion${interactions.length === 1 ? '' : 'es'} y ${ownedProperties.length} inmueble${ownedProperties.length === 1 ? '' : 's'} asociado${ownedProperties.length === 1 ? '' : 's'}. Empieza por el siguiente paso pendiente.`
        }
        dontForget="Cada llamada, visita o WhatsApp debe dejar resultado y siguiente paso. Si no, esta ficha se convierte en una agenda muda."
        risk="Si esta ficha no esta viva, el contacto se enfria y se pierde captacion, venta o recomendacion."
        actions={[
          { label: 'Que haria un buen agente aqui', description: 'Dejar claro que ha pasado, que toca despues y si este contacto esta mas cerca de captar, comprar o recomendar.' },
          { label: 'Que mira direccion aqui', description: 'Si el contacto avanza, si esta bien trabajado y si hay trazabilidad real del seguimiento.' },
          { label: 'Que error evitar', description: 'Tener muchas interacciones pero ninguna decision clara ni tarea viva.' },
        ]}
      />

      {!isMobile && (
        <ContactDetailStatusActions
          contact={contact}
          isAdmin={isAdmin}
          deleting={deleting}
          onMarkCaptured={async () => {
            const payload: ContactUpdate = { contact_type: 'propietario' as ContactType, pipeline_stage: 'captado' as PipelineStage };
            const { error } = await supabase.from('contacts').update(payload).eq('id', id!);
            if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
            toast({ title: 'Cliente captado', description: `${contact.full_name} ya figura como propietario cliente.` });
            loadData();
          }}
          onClosePurchase={async () => {
            const payload: ContactUpdate = { contact_type: 'comprador_cerrado' as ContactType, purchase_date: new Date().toISOString().slice(0, 10) };
            const { error } = await supabase.from('contacts').update(payload).eq('id', id!);
            if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
            toast({ title: 'Compra cerrada', description: `${contact.full_name} ahora es comprador cerrado con fecha de compra hoy` });
            loadData();
          }}
          onCloseSale={async () => {
            const payload: ContactUpdate = { contact_type: 'vendedor_cerrado' as ContactType, sale_date: new Date().toISOString().slice(0, 10) };
            const { error } = await supabase.from('contacts').update(payload).eq('id', id!);
            if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
            toast({ title: 'Venta cerrada', description: `${contact.full_name} ahora es vendedor cerrado con fecha de venta hoy` });
            loadData();
          }}
          onDeleteContact={handleDeleteContact}
        />
      )}
      {/* AI Summary */}
      {summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Resumen IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Suspense fallback={sectionFallback}>
                <ReactMarkdown>{summary}</ReactMarkdown>
              </Suspense>
            </div>
          </CardContent>
        </Card>
      )}

      <ContactOverviewCards
        contact={contact}
        visits={visits}
        offers={offers}
        interactions={interactions}
        onLogged={loadData}
        canManagePrivacy={isAdmin || isCoordinadora}
        onRegisterConsent={async () => {
          const payload: ContactUpdate = {
            gdpr_consent: true,
            gdpr_consent_at: new Date().toISOString(),
            gdpr_legal_basis: 'explicit_consent',
          };
          const { error } = await supabase.from('contacts').update(payload).eq('id', id!);
          if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            return;
          }
          toast({ title: '✅ Consentimiento registrado' });
          loadData();
        }}
        onToggleOptOut={async (checked) => {
          const payload: ContactUpdate = { opt_out: checked };
          setContact((current) => (current ? { ...current, opt_out: checked } : current));
          await supabase.from('contacts').update(payload).eq('id', id!);
          toast({ title: checked ? '🔇 Contacto excluido de comunicaciones' : '🔔 Comunicaciones reactivadas' });
        }}
      />

      {/* Internal Comments */}
      {id && <InternalComments entityType="contact" entityId={id} />}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const nextValue = value as (typeof CONTACT_DETAIL_TABS)[number];
          setActiveTab(nextValue);
          setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            if (nextValue === 'actividad') params.delete('tab');
            else params.set('tab', nextValue);
            return params;
          }, { replace: true });
        }}
      >
        <ContactDetailTabsList
          contact={contact}
          demandsCount={demands.length}
          matchesCount={contactMatches.length}
          callsCount={interactions.filter((interaction) => interaction.interaction_type === 'llamada').length}
          visitsCount={visits.length}
          offersCount={offers.length}
          tasks={contactTasks as TaskRow[]}
          reengagementCount={reengagementHistory.length}
        />

        {/* ACTIVIDAD: timeline + llamadas + comunicaciones */}
        <TabsContent value="actividad" className="space-y-6">
          <ContactTimeline
            interactions={interactions}
            visits={visits}
            offers={offers}
            tasks={contactTasks}
            matches={contactMatches}
            reengagement={reengagementHistory}
            communicationLogs={communicationLogs}
          />
          <ContactCallsPanel
            interactions={interactions}
            callFilter={callFilter}
            onCallFilterChange={setCallFilter}
          />
          <ContactCommunicationHistory contactId={id!} />
        </TabsContent>

        {/* AGENDA: tareas + visitas */}
        <TabsContent value="agenda" className="space-y-6">
          <ContactTasksPanel
            tasks={contactTasks}
            taskFilter={taskFilter}
            onTaskFilterChange={setTaskFilter}
            onOpenTasks={openTasksForContact}
            onOpenNewTask={openNewTaskInCentralTray}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            getAutomaticTaskRoute={getAutomaticTaskRoute}
            onOpenAutomaticTask={navigate}
          />
          <ContactVisitsPanel
            visits={visits}
            contactName={contact?.full_name}
            onOpenProperty={(propertyId) => navigate(`/properties/${propertyId}`)}
          />
        </TabsContent>

        {/* NEGOCIO: propiedades + demandas + cruces */}
        <TabsContent value="negocio" className="space-y-6">
          <div className="space-y-4">
            <AssignPropertyToContact contactId={id!} contactName={contact.full_name} contactType={contact.contact_type} onAssigned={loadData} />
            <ContactPropertiesPanel
              contactType={contact.contact_type}
              ownedProperties={ownedProperties}
              arrasBuyerProperties={arrasBuyerProperties}
              visits={visits}
              offers={offers}
              onOpenProperty={(propertyId) => navigate(`/properties/${propertyId}`)}
            />
          </div>
          <ContactDemandsTab
            demands={demands as DemandRow[]}
            onOpenNewDemand={openNewDemand}
            onEditDemand={openEditDemand}
            onToggleDemandActive={toggleDemandActive}
            onDeleteDemand={deleteDemand}
            onToggleAutoMatch={async (demandId, checked) => {
              const payload: DemandUpdate = { auto_match: checked };
              await supabase.from('demands').update(payload).eq('id', demandId);
              setDemands((prev) => prev.map((demand) => demand.id === demandId ? { ...demand, auto_match: checked } : demand));
              toast({ title: checked ? 'Cruce automático activado' : 'Cruce automático desactivado' });
            }}
          />
          <ContactMatchesPanel
            matches={contactMatches}
            onOpenProperty={(propertyId) => navigate(`/properties/${propertyId}`)}
            onStatusChange={handleMatchStatusChange}
          />
        </TabsContent>

        {/* PIPELINE: ofertas + fidelización */}
        <TabsContent value="pipeline" className="space-y-6">
          <OffersSection
            offers={offers}
            contactId={id!}
            contactProperties={[
              ...ownedProperties,
              ...(visits.map(v => v.properties).filter(Boolean)),
              ...(contactMatches.map(m => m.properties).filter(Boolean)),
            ].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)}
            onReload={loadData}
          />
          <ContactReengagementPanel
            contact={contact}
            reengagementHistory={reengagementHistory}
          />
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documentos" className="space-y-4">
          <Suspense fallback={sectionFallback}>
            <DocumentRelationsPanel contactId={id!} />
          </Suspense>
          <Suspense fallback={sectionFallback}>
            <ContactDocuments contactId={id!} contactName={contact.full_name} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <ContactEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        form={editForm}
        setForm={setEditForm}
        tagInput={tagInput}
        setTagInput={setTagInput}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onSubmit={handleSave}
        saving={saving}
        typeLabels={typeLabels}
        statusLabels={statusLabels}
      />

      <ContactInteractionDialog
        open={interactionOpen}
        onOpenChange={setInteractionOpen}
        interactionTypes={contact ? (INTERACTION_TYPES_BY_CONTACT[contact.contact_type] || DEFAULT_INTERACTION_TYPES) : DEFAULT_INTERACTION_TYPES}
        form={intForm}
        setForm={setIntForm}
        saving={intSaving}
        onSubmit={handleAddInteraction}
      />

      <ContactDemandDialog
        open={demandDialogOpen}
        onOpenChange={setDemandDialogOpen}
        demandEditId={demandEditId}
        demandForm={demandForm}
        setDemandForm={setDemandForm}
        propertyTypes={propertyTypes}
        demandSaving={demandSaving}
        demandExtracting={demandExtracting}
        onSubmit={handleDemandSubmit}
        onExtractFromScreenshot={extractDemandFromScreenshot}
      />

      {/* Auto-open call log after navigating from call detection (?log_call=1) */}
      {contact && (
        <LogCallDialog
          open={logCallOpen}
          onOpenChange={setLogCallOpen}
          contactId={contact.id}
          contactName={contact.full_name}
          phone={contact.phone || contact.phone2 || ''}
          defaultDirection="entrante"
          onLogged={() => { setLogCallOpen(false); loadData(); }}
        />
      )}

      {contact && contact.phone && (
        <Suspense fallback={null}>
          <WhatsAppComposer
            contactId={contact.id}
            contactName={contact.full_name}
            phone={contact.phone}
            agentId={user?.id || ''}
            open={waComposerOpen}
            onOpenChange={setWaComposerOpen}
          />
        </Suspense>
      )}

      {/* FAB — mobile only: quick task */}
      {isMobile && <ContactDetailMobileFab onClick={openNewTaskInCentralTray} />}

      <ContactFakturaDialog
        open={fakturaDialogOpen}
        onOpenChange={setFakturaDialogOpen}
        loading={fakturaLoading}
        contactName={contact?.full_name}
        properties={fakturaProperties}
        invoices={contactInvoices}
        selectedPropertyId={selectedFakturaProperty}
        onSelectedPropertyChange={setSelectedFakturaProperty}
        onSubmit={handleGenerateFaktura}
      />
    </div>
  );
};

export default ContactDetail;
