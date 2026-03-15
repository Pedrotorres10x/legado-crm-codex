import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import LogCallDialog from '@/components/LogCallDialog';
import { useTwilio } from '@/contexts/TwilioContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useContactDetailData } from '@/hooks/useContactDetailData';
import { useContactDemands } from '@/hooks/useContactDemands';
import { useContactFaktura } from '@/hooks/useContactFaktura';
import { useContactInteractions } from '@/hooks/useContactInteractions';
import { hapticLight } from '@/lib/haptics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft, User, Phone, Mail, MapPin, Calendar, CheckCircle, Clock,
  Home, MessageSquare, Loader2, Sparkles, XCircle, CalendarClock,
  DollarSign, Tag, Pencil, Plus, Send, Building, Eye, FileText,
  Search as SearchIcon, Power, Trash2, Zap, GitMerge, MousePointerClick, Flame, Heart, Key,
  ListTodo, AlarmClock, CheckCheck, FolderOpen, Receipt, MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/hooks/use-toast';

import InternalComments from '@/components/InternalComments';
import OffersSection from '@/components/OffersSection';
import ContactTimeline from '@/components/ContactTimeline';
import PhoneLink from '@/components/PhoneLink';
import ChangeRequestButton from '@/components/ChangeRequestButton';
import AssignPropertyToContact from '@/components/contacts/AssignPropertyToContact';
import ContactOverviewCards from '@/components/contacts/ContactOverviewCards';
import ContactEditDialog from '@/components/contacts/ContactEditDialog';
import ContactFakturaDialog from '@/components/contacts/ContactFakturaDialog';
import ContactInteractionDialog from '@/components/contacts/ContactInteractionDialog';
import ContactMatchesPanel from '@/components/contacts/ContactMatchesPanel';
import ContactPropertiesPanel from '@/components/contacts/ContactPropertiesPanel';
import ContactReengagementPanel from '@/components/contacts/ContactReengagementPanel';
import ContactVisitsPanel from '@/components/contacts/ContactVisitsPanel';
import ContactDocuments from '@/components/ContactDocuments';
import DocumentRelationsPanel from '@/components/DocumentRelationsPanel';
import MatchEmailHistory from '@/components/MatchEmailHistory';
import ContactCommunicationHistory from '@/components/ContactCommunicationHistory';
import WhatsAppComposer from '@/components/WhatsAppComposer';
import ContactCallsPanel from '@/components/contacts/ContactCallsPanel';
import ContactDemandDialog from '@/components/contacts/ContactDemandDialog';
import ContactHealthBadge from '@/components/ContactHealthBadge';
import { getCoverImage } from '@/lib/get-cover-image';
import { useContactEdit } from '@/hooks/useContactEdit';
import ContactTasksPanel from '@/components/contacts/ContactTasksPanel';
import { useContactHealthColors } from '@/hooks/useHealthColors';
import AISectionGuide from '@/components/ai/AISectionGuide';


const typeLabels: Record<string, string> = { prospecto: 'Prospecto (dueño sin firmar)', propietario: 'Propietario (cliente)', comprador: 'Comprador', comprador_cerrado: 'Comprador (cerrado)', vendedor_cerrado: 'Vendedor (cerrado)', ambos: 'Ambos', colaborador: 'Colaborador', statefox: 'Statefox', contacto: 'Contacto' };
const statusLabels: Record<string, string> = { nuevo: 'Nuevo', en_seguimiento: 'En seguimiento', activo: 'Activo', cerrado: 'Cerrado' };
const interactionLabels: Record<string, string> = { llamada: 'Llamada', email: 'Email', visita: 'Visita', whatsapp: 'WhatsApp', reunion: 'Reunión', nota: 'Nota' };

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
  const { user, isAdmin, isCoordinadora, canViewAll } = useAuth();
  const isMobile = useIsMobile();
  const { dial, callState } = useTwilio();

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

  const handleToggleTask = async (task: any) => {
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
    await supabase.from('matches').update({ status: status as any }).eq('id', matchId);
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
    openNewDemand,
    openEditDemand,
    handleDemandSubmit,
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
      setSearchParams((prev) => { prev.delete('log_call'); return prev; }, { replace: true });
    }
  }, [searchParams, contact]);
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

  return (
    <div className="space-y-6">
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
            ? `Tiene ${interactions.length} interaccion${interactions.length === 1 ? '' : 'es'}, ${contactTasks.filter((task) => !task.completed).length} tarea${contactTasks.filter((task) => !task.completed).length === 1 ? '' : 's'} pendiente${contactTasks.filter((task) => !task.completed).length === 1 ? '' : 's'} y ${ownedProperties.length} inmueble${ownedProperties.length === 1 ? '' : 's'} vinculado${ownedProperties.length === 1 ? '' : 's'}. Tu objetivo es llevarlo a firma.`
            : contact.contact_type === 'comprador'
              ? `Tiene ${visits.length} visita${visits.length === 1 ? '' : 's'}, ${offers.length} oferta${offers.length === 1 ? '' : 's'} y ${contactMatches.length} cruce${contactMatches.length === 1 ? '' : 's'} activo${contactMatches.length === 1 ? '' : 's'}. Empieza por lo mas caliente.`
              : `Tiene ${contactTasks.filter((task) => !task.completed).length} tarea${contactTasks.filter((task) => !task.completed).length === 1 ? '' : 's'} pendiente${contactTasks.filter((task) => !task.completed).length === 1 ? '' : 's'}, ${interactions.length} interaccion${interactions.length === 1 ? '' : 'es'} y ${ownedProperties.length} inmueble${ownedProperties.length === 1 ? '' : 's'} asociado${ownedProperties.length === 1 ? '' : 's'}. Empieza por el siguiente paso pendiente.`
        }
        dontForget="Cada llamada, visita o WhatsApp debe dejar resultado y siguiente paso. Si no, esta ficha se convierte en una agenda muda."
        risk="Si esta ficha no esta viva, el contacto se enfria y se pierde captacion, venta o recomendacion."
        actions={[
          { label: 'Que haria un buen agente aqui', description: 'Dejar claro que ha pasado, que toca despues y si este contacto esta mas cerca de captar, comprar o recomendar.' },
          { label: 'Que mira direccion aqui', description: 'Si el contacto avanza, si esta bien trabajado y si hay trazabilidad real del seguimiento.' },
          { label: 'Que error evitar', description: 'Tener muchas interacciones pero ninguna decision clara ni tarea viva.' },
        ]}
      />

      {/* ── MOBILE HERO ── */}
      {isMobile && (
        <div className="rounded-3xl bg-card border border-border/60 overflow-hidden shadow-sm animate-fade-in-up -mx-0">
          {/* Avatar + nombre */}
          <div className="px-5 pt-5 pb-4 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-[18px] leading-tight truncate">{contact.full_name}</h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabels[contact.contact_type] || contact.contact_type}</Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{statusLabels[contact.status] || contact.status}</Badge>
                <ContactHealthBadge info={contactHealth[contact.id]} className="text-[10px] px-1.5 py-0" />
              </div>
            </div>
          </div>

          {/* Datos de contacto */}
          {(contact.phone || contact.email || contact.city) && (
            <div className="px-5 pb-3 space-y-1.5">
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              {contact.city && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{contact.city}</span>
                </div>
              )}
            </div>
          )}

          {/* Acciones rápidas */}
          <div className="grid grid-cols-3 gap-px bg-border/40 border-t border-border/40">
            {contact.phone && (
              <button
                onClick={() => { hapticLight(); dial(contact.phone, { contactId: contact.id, contactName: contact.full_name }); }}
                disabled={callState.status !== 'ready'}
                className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-primary/10 transition-colors disabled:opacity-40"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-[18px] w-[18px] text-primary" />
                </div>
                <span className="text-[11px] font-medium text-foreground">Llamar VoIP</span>
              </button>
            )}
            {contact.phone && (
              <button
                onClick={() => { hapticLight(); setWaComposerOpen(true); }}
                className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <MessageSquare className="h-[18px] w-[18px] text-emerald-600" />
                </div>
                <span className="text-[11px] font-medium text-foreground">WhatsApp</span>
              </button>
            )}
            {ownedProperties.length > 0 ? (
              <button
                onClick={() => { hapticLight(); document.getElementById('tab-inmuebles')?.click(); }}
                className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building className="h-[18px] w-[18px] text-primary" />
                </div>
                <span className="text-[11px] font-medium text-foreground">
                  Inmuebles {ownedProperties.length > 0 ? `(${ownedProperties.length})` : ''}
                </span>
              </button>
            ) : (
              <button
                onClick={() => { hapticLight(); setInteractionOpen(true); }}
                className="flex flex-col items-center justify-center gap-1.5 py-4 bg-card active:bg-muted transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="h-[18px] w-[18px] text-primary" />
                </div>
                <span className="text-[11px] font-medium text-foreground">Interacción</span>
              </button>
            )}
          </div>

          {/* Fila secundaria de acciones */}
          <div className="flex gap-2 px-4 py-3 bg-muted/30">
            <Button size="sm" variant="outline" className="flex-1 text-xs h-9" onClick={() => { hapticLight(); setInteractionOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />Interacción
            </Button>
            {(isAdmin || isCoordinadora) && (
              <Button size="sm" variant="outline" className="flex-1 text-xs h-9" onClick={() => { hapticLight(); openEdit(); }}>
                <Pencil className="h-3.5 w-3.5 mr-1" />Editar
              </Button>
            )}
            {isAdmin && (
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-xs h-9 text-destructive hover:text-destructive" onClick={() => hapticLight()}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
                    <AlertDialogDescription>Se eliminará permanentemente a <strong>{contact?.full_name}</strong> y no se podrá recuperar.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteContact} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <ChangeRequestButton
              entityType="contact"
              entityId={contact?.id || ''}
              entityLabel={contact?.full_name || ''}
              size="sm"
              className="flex-1 text-xs h-9"
            />
            <Button size="sm" variant="outline" className="flex-1 text-xs h-9" onClick={() => {
              hapticLight();
              const params = new URLSearchParams({ contact_id: id!, contact_name: contact?.full_name || '' });
              navigate(`/tasks?new=1&${params.toString()}`);
            }}>
              <CalendarClock className="h-3.5 w-3.5 mr-1" />Tarea
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs h-9" onClick={() => { hapticLight(); openFakturaDialog(); }}>
              <Receipt className="h-3.5 w-3.5 mr-1" />Faktura
            </Button>
          </div>
        </div>
      )}

      {/* Header (escritorio) */}
      {!isMobile && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{contact.full_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline">{typeLabels[contact.contact_type] || contact.contact_type}</Badge>
              <Badge variant="secondary">{statusLabels[contact.status] || contact.status}</Badge>
              <ContactHealthBadge info={contactHealth[contact.id]} />
              {contact.pipeline_stage && contact.pipeline_stage.toLowerCase() !== (statusLabels[contact.status] || contact.status).toLowerCase() && <Badge className="bg-primary text-primary-foreground border-0">{contact.pipeline_stage}</Badge>}
              {(contact.contact_type === 'comprador' || contact.contact_type === 'ambos') && (
                <div className="flex items-center gap-1.5 ml-2 pl-2 border-l">
                  <Checkbox
                    id="needs_mortgage"
                    checked={contact.needs_mortgage || false}
                    onCheckedChange={async (checked) => {
                      setContact((c: any) => ({ ...c, needs_mortgage: !!checked }));
                      await supabase.from('contacts').update({ needs_mortgage: !!checked } as any).eq('id', id!);
                      if (checked) {
                        const agentName = user?.user_metadata?.full_name || user?.email || 'Un agente';
                        await supabase.from('announcements').insert({
                          title: `🏦 ${contact.full_name} necesita hipoteca`,
                          content: `El contacto **${contact.full_name}** ha sido marcado como "Necesita hipoteca" por ${agentName}. Revisar ficha: /contacts/${id}`,
                          category: 'alerta',
                          created_by: user?.id,
                        } as any);
                        toast({ title: 'Aviso enviado al admin', description: 'Se ha notificado que el cliente necesita hipoteca' });
                      }
                    }}
                  />
                  <label htmlFor="needs_mortgage" className="text-xs text-muted-foreground cursor-pointer select-none">Necesita hipoteca</label>
                  {contact.needs_mortgage && <Badge variant="outline" className="text-warning border-warning text-[10px]">🏦 Hipoteca</Badge>}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {contact.contact_type === 'prospecto' && (
              <Button variant="outline" size="sm" className="text-primary border-primary/30 hover:bg-primary/5"
                onClick={async () => {
                  const { error } = await supabase.from('contacts').update({ contact_type: 'propietario' as any, pipeline_stage: 'captado' as any } as any).eq('id', id!);
                  if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
                  toast({ title: 'Cliente captado', description: `${contact.full_name} ya figura como propietario cliente.` });
                  loadData();
                }}>
                <CheckCircle className="h-4 w-4 mr-1" />Marcar como captado
              </Button>
            )}
            {contact.contact_type === 'comprador' && (
              <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                onClick={async () => {
                  const { error } = await supabase.from('contacts').update({ contact_type: 'comprador_cerrado' as any, purchase_date: new Date().toISOString().slice(0, 10) } as any).eq('id', id!);
                  if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
                  toast({ title: 'Compra cerrada', description: `${contact.full_name} ahora es comprador cerrado con fecha de compra hoy` });
                  loadData();
                }}>
                <Home className="h-4 w-4 mr-1" />Cerrar compra
              </Button>
            )}
            {contact.contact_type === 'propietario' && (
              <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                onClick={async () => {
                  const { error } = await supabase.from('contacts').update({ contact_type: 'vendedor_cerrado' as any, sale_date: new Date().toISOString().slice(0, 10) } as any).eq('id', id!);
                  if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
                  toast({ title: 'Venta cerrada', description: `${contact.full_name} ahora es vendedor cerrado con fecha de venta hoy` });
                  loadData();
                }}>
                <Home className="h-4 w-4 mr-1" />Cerrar venta
              </Button>
            )}
            {contact.phone && (
              <Button variant="outline" size="sm" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900" onClick={() => setWaComposerOpen(true)}>
                <MessageCircle className="h-4 w-4 mr-1" />WhatsApp
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setInteractionOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Interacción
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const params = new URLSearchParams({ contact_id: id!, contact_name: contact?.full_name || '' });
              navigate(`/tasks?new=1&${params.toString()}`);
            }}>
              <CalendarClock className="h-4 w-4 mr-1" />Tarea
            </Button>
            {(isAdmin || isCoordinadora) && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-4 w-4 mr-1" />Editar
              </Button>
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" />Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
                    <AlertDialogDescription>Se eliminará permanentemente a <strong>{contact?.full_name}</strong> y no se podrá recuperar.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteContact} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <ChangeRequestButton
              entityType="contact"
              entityId={contact?.id || ''}
              entityLabel={contact?.full_name || ''}
            />
            <Button variant="outline" size="sm" onClick={openFakturaDialog}>
              <Receipt className="h-4 w-4 mr-1" />Generar Faktura
            </Button>
            <Button variant="outline" size="sm" onClick={fetchSummary} disabled={summaryLoading}>
              {summaryLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Resumen IA
            </Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-1" />Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar este contacto?</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará el contacto y toda su información.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                      await supabase.from('contacts').delete().eq('id', id!);
                      toast({ title: 'Contacto eliminado' });
                      navigate('/contacts');
                    }}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}
      {/* AI Summary */}
      {summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Resumen IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      <ContactOverviewCards
        contact={contact}
        visits={visits}
        offers={offers}
        interactions={interactions}
        callReady={callState.status === 'ready'}
        onDial={(phone) => dial(phone, { contactId: contact.id, contactName: contact.full_name })}
        onLogged={loadData}
        canManagePrivacy={isAdmin || isCoordinadora}
        onRegisterConsent={async () => {
          const { error } = await supabase.from('contacts').update({
            gdpr_consent: true,
            gdpr_consent_at: new Date().toISOString(),
            gdpr_legal_basis: 'explicit_consent',
          } as any).eq('id', id!);
          if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
            return;
          }
          toast({ title: '✅ Consentimiento registrado' });
          loadData();
        }}
        onToggleOptOut={async (checked) => {
          setContact((current: any) => ({ ...current, opt_out: checked }));
          await supabase.from('contacts').update({ opt_out: checked } as any).eq('id', id!);
          toast({ title: checked ? '🔇 Contacto excluido de comunicaciones' : '🔔 Comunicaciones reactivadas' });
        }}
      />

      {/* Internal Comments */}
      {id && <InternalComments entityType="contact" entityId={id} />}

      {/* Tabs */}
      <Tabs defaultValue="timeline">
        <TabsList className="flex-wrap sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <TabsTrigger value="timeline" className="gap-2"><Clock className="h-4 w-4" />Timeline</TabsTrigger>
          <TabsTrigger value="properties" className="gap-2"><Building className="h-4 w-4" />Propiedades</TabsTrigger>
          <TabsTrigger value="demands" className="gap-2"><SearchIcon className="h-4 w-4" />Demandas ({demands.length})</TabsTrigger>
          <TabsTrigger value="matches" className="gap-2"><GitMerge className="h-4 w-4" />Cruces ({contactMatches.length})</TabsTrigger>
          <TabsTrigger value="calls" className="gap-2"><Phone className="h-4 w-4" />Llamadas ({interactions.filter(i => i.interaction_type === 'llamada').length})</TabsTrigger>
          
          <TabsTrigger value="visits" className="gap-2"><Calendar className="h-4 w-4" />Visitas ({visits.length})</TabsTrigger>
          <TabsTrigger value="offers" className="gap-2"><DollarSign className="h-4 w-4" />Ofertas ({offers.length})</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2 relative">
            <ListTodo className="h-4 w-4" />Tareas ({contactTasks.length})
            {contactTasks.some(t => !t.completed && new Date(t.due_date) < new Date()) && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
            )}
          </TabsTrigger>
          {(contact.contact_type === 'propietario' || contact.contact_type === 'comprador_cerrado' || contact.contact_type === 'vendedor_cerrado') && (
            <TabsTrigger value="reengagement" className="gap-2"><Heart className="h-4 w-4" />Fidelización ({reengagementHistory.length})</TabsTrigger>
          )}
          <TabsTrigger value="emails" className="gap-2"><Mail className="h-4 w-4" />Comunicaciones</TabsTrigger>
          <TabsTrigger value="documents" className="gap-2"><FolderOpen className="h-4 w-4" />Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <ContactTimeline
            interactions={interactions}
            visits={visits}
            offers={offers}
            tasks={contactTasks}
            matches={contactMatches}
            reengagement={reengagementHistory}
            communicationLogs={communicationLogs}
          />
        </TabsContent>

        {/* TAREAS */}
        <TabsContent value="tasks">
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
        </TabsContent>

        <TabsContent value="properties">
          <div className="space-y-4">
            {/* Assign property button + search */}
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
        </TabsContent>

        {/* Demands Tab */}
        <TabsContent value="demands">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={openNewDemand}><Plus className="h-4 w-4 mr-1" />Nueva Demanda</Button>
            </div>
            {demands.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                <SearchIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No hay demandas. Registra lo que busca este contacto.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {demands.map(d => (
                  <Card key={d.id} className={`border-0 shadow-card ${!d.is_active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2 text-sm">
                          {d.property_type && <Badge variant="outline">{d.property_type}</Badge>}
                          <Badge variant="outline">{d.operation}</Badge>
                        </div>
                        <Badge variant={d.is_active ? 'default' : 'secondary'}>{d.is_active ? 'Activa' : 'Inactiva'}</Badge>
                      </div>
                      {((d.cities && d.cities.length > 0) || (d.zones && d.zones.length > 0)) && (
                        <div className="flex flex-wrap gap-1.5">
                          {(d.cities || []).map((c: string, i: number) => (
                            <Badge key={`c-${i}`} variant="secondary" className="text-xs gap-1"><MapPin className="h-3 w-3" />{c}</Badge>
                          ))}
                          {(d.zones || []).map((z: string, i: number) => (
                            <Badge key={`z-${i}`} variant="outline" className="text-xs">{z}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <DollarSign className="h-3.5 w-3.5 text-primary" />
                        {(d.min_price || d.max_price)
                          ? <span>{d.min_price ? `${Number(d.min_price).toLocaleString('es-ES')}€` : '?'} – {d.max_price ? `${Number(d.max_price).toLocaleString('es-ES')}€` : '?'}</span>
                          : <span className="text-muted-foreground italic">Sin presupuesto definido</span>
                        }
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {d.min_surface && <p>Sup. mín: {d.min_surface}m²</p>}
                        {d.min_bedrooms && <p>Hab. mín: {d.min_bedrooms}</p>}
                      </div>
                      {d.notes && <p className="text-sm text-muted-foreground italic line-clamp-2">{d.notes}</p>}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditDemand(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleDemandActive(d.id, d.is_active)}><Power className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteDemand(d.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Zap className={`h-3 w-3 ${d.auto_match !== false ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className="text-[10px] text-muted-foreground">Cruce</span>
                          <Switch
                            checked={d.auto_match !== false}
                            onCheckedChange={async (checked) => {
                              await supabase.from('demands').update({ auto_match: checked } as any).eq('id', d.id);
                              setDemands(prev => prev.map(x => x.id === d.id ? { ...x, auto_match: checked } : x));
                              toast({ title: checked ? 'Cruce automático activado' : 'Cruce automático desactivado' });
                            }}
                            className="scale-[0.6]"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calls">
          <ContactCallsPanel
            interactions={interactions}
            callFilter={callFilter}
            onCallFilterChange={setCallFilter}
          />
        </TabsContent>

        <TabsContent value="visits">
          <ContactVisitsPanel
            visits={visits}
            contactName={contact?.full_name}
            onOpenProperty={(propertyId) => navigate(`/properties/${propertyId}`)}
          />
        </TabsContent>

        <TabsContent value="matches">
          <ContactMatchesPanel
            matches={contactMatches}
            onOpenProperty={(propertyId) => navigate(`/properties/${propertyId}`)}
            onStatusChange={handleMatchStatusChange}
          />
        </TabsContent>

        <TabsContent value="offers">
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
        </TabsContent>

        {/* Reengagement / Fidelización tab for propietarios */}
        {(contact.contact_type === 'propietario' || contact.contact_type === 'comprador_cerrado' || contact.contact_type === 'vendedor_cerrado') && (
          <TabsContent value="reengagement">
            <ContactReengagementPanel
              contact={contact}
              reengagementHistory={reengagementHistory}
            />
          </TabsContent>
        )}

        {/* HISTORIAL DE COMUNICACIONES */}
        <TabsContent value="emails">
          <ContactCommunicationHistory contactId={id!} />
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documents">
                      <div className="space-y-4">
                        <DocumentRelationsPanel contactId={id!} />
                        <ContactDocuments contactId={id!} contactName={contact.full_name} />
                      </div>
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
        onSubmit={handleDemandSubmit}
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
        <WhatsAppComposer
          contactId={contact.id}
          contactName={contact.full_name}
          phone={contact.phone}
          agentId={user?.id || ''}
          open={waComposerOpen}
          onOpenChange={setWaComposerOpen}
        />
      )}

      {/* FAB — mobile only: quick task */}
      {isMobile && (
        <button
          onClick={() => { hapticLight(); openNewTaskInCentralTray(); }}
          className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Nueva tarea"
        >
          <ListTodo className="h-6 w-6" />
        </button>
      )}

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
