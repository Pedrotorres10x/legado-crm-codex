import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Phone, ArrowLeft, CalendarClock, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

// Chat components
import ChannelList from '@/components/chat/ChannelList';
import MessageArea from '@/components/chat/MessageArea';
import FollowUpTaskDialog from '@/components/communications/FollowUpTaskDialog';
import { useFollowUpTaskDraft } from '@/hooks/useFollowUpTaskDraft';

// Calls components
import TwilioDialer from '@/components/TwilioDialer';
import CallHistory from '@/components/CallHistory';

type FollowUpItem = {
  id: string;
  kind: 'contact' | 'task' | 'match' | 'lead';
  title: string;
  summary: string;
  meta: string;
  priority: 'alta' | 'media';
  route: string;
  actionLabel: string;
  contactId?: string | null;
  propertyId?: string | null;
};

const Communications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'calls' || tabParam === 'followup' ? tabParam : 'chat';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([]);
  const [followUpLoading, setFollowUpLoading] = useState(true);
  const {
    taskDraftForItem,
    taskForm,
    setTaskForm,
    savingTask,
    openTaskDraft,
    closeTaskDraft,
    handleCreateTask,
  } = useFollowUpTaskDraft({
    userId: user?.id,
  });

  // ─── Chat state ───
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>('00000000-0000-0000-0000-000000000001');
  const [showMessages, setShowMessages] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const loadUnreadCounts = useCallback(async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from('chat_channel_members')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id);
    if (!memberships) return;
    const counts: Record<string, number> = {};
    await Promise.all(memberships.map(async (m) => {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', m.channel_id)
        .gt('created_at', m.last_read_at)
        .neq('user_id', user.id);
      counts[m.channel_id] = count || 0;
    }));
    setUnreadCounts(counts);
  }, [user]);

  useEffect(() => {
    loadUnreadCounts();
    const sub = supabase
      .channel('chat-unread-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        loadUnreadCounts();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadUnreadCounts]);

  const handleSelectChannel = (id: string) => {
    setSelectedChannelId(id);
    if (isMobile) setShowMessages(true);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams(tab === 'chat' ? {} : { tab });
  };

  useEffect(() => {
    let cancelled = false;

    const loadFollowUp = async () => {
      if (!user) return;
      setFollowUpLoading(true);

      const nowIso = new Date().toISOString();
      const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: contacts }, { data: interactions }, { data: tasks }, { data: matches }, { data: inboundLeads }] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, full_name, status, city, updated_at')
          .eq('agent_id', user.id)
          .in('status', ['nuevo', 'en_seguimiento', 'activo'])
          .limit(80),
        supabase
          .from('interactions')
          .select('contact_id, interaction_date, interaction_type')
          .eq('agent_id', user.id)
          .gte('interaction_date', sevenDaysAgoIso)
          .order('interaction_date', { ascending: false })
          .limit(200),
        supabase
          .from('tasks')
          .select('id, title, due_date, task_type, contact_id, property_id, source, contacts(full_name), properties(title)')
          .eq('agent_id', user.id)
          .eq('completed', false)
          .in('task_type', ['llamada', 'whatsapp', 'seguimiento'])
          .order('due_date', { ascending: true })
          .limit(20),
        supabase
          .from('matches')
          .select('id, notes, property_id, demand_id, properties(title), demands(contact_id, contacts(full_name))')
          .eq('agent_id', user.id)
          .eq('status', 'enviado')
          .not('notes', 'is', null)
          .ilike('notes', '%WhatsApp pendiente%')
          .limit(12),
        supabase
          .from('contacts')
          .select('id, full_name, status, city, pipeline_stage, created_at, tags')
          .eq('agent_id', user.id)
          .or('tags.cs.{web-lead},tags.cs.{portal-lead},tags.cs.{fb-lead-ads}')
          .limit(40),
      ]);

      const latestInteractionByContact = new Map<string, { interaction_date: string; interaction_type: string }>();
      ((interactions as any[]) || []).forEach((interaction) => {
        if (interaction.contact_id && !latestInteractionByContact.has(interaction.contact_id)) {
          latestInteractionByContact.set(interaction.contact_id, {
            interaction_date: interaction.interaction_date,
            interaction_type: interaction.interaction_type,
          });
        }
      });

      const staleContacts: FollowUpItem[] = (((contacts as any[]) || [])
        .filter((contact) => {
          const latest = latestInteractionByContact.get(contact.id);
          return !latest || latest.interaction_date < sevenDaysAgoIso;
        })
        .slice(0, 6)
        .map((contact) => {
          const latest = latestInteractionByContact.get(contact.id);
          return {
            id: `contact-${contact.id}`,
            kind: 'contact',
            title: contact.full_name,
            summary: latest
              ? `Sin seguimiento reciente desde hace ${formatDistanceToNow(new Date(latest.interaction_date), { addSuffix: true, locale: es })}.`
              : 'Sin interacciones recientes registradas.',
            meta: [contact.status, contact.city].filter(Boolean).join(' · ') || 'Seguimiento comercial',
            priority: contact.status === 'nuevo' ? 'alta' : 'media',
            route: `/contacts/${contact.id}`,
            actionLabel: 'Abrir contacto',
            contactId: contact.id,
          };
        }));

      const overdueTasks: FollowUpItem[] = (((tasks as any[]) || [])
        .filter((task) => isPast(new Date(task.due_date)))
        .slice(0, 6)
        .map((task) => ({
          id: `task-${task.id}`,
          kind: 'task',
          title: task.title,
          summary: `Seguimiento ${task.task_type} vencido ${formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: es })}.`,
          meta: task.contacts?.full_name || task.properties?.title || 'Tarea comercial',
          priority: 'alta',
          route: task.contact_id ? `/contacts/${task.contact_id}` : '/tasks',
          actionLabel: task.contact_id ? 'Abrir contacto' : 'Abrir tareas',
          contactId: task.contact_id,
          propertyId: task.property_id,
        })));

      const pendingWhatsapps: FollowUpItem[] = (((matches as any[]) || [])
        .slice(0, 6)
        .map((match) => ({
          id: `match-${match.id}`,
          kind: 'match',
          title: match.demands?.contacts?.full_name || 'WhatsApp pendiente',
          summary: `Pendiente de confirmar por WhatsApp el cruce con ${match.properties?.title || 'un inmueble'}.`,
          meta: 'Cruce enviado pendiente de seguimiento',
          priority: 'media',
          route: '/matches',
          actionLabel: 'Abrir cruces',
          contactId: match.demands?.contact_id,
          propertyId: match.property_id,
        })));

      const inboundLeadIds = ((inboundLeads as any[]) || []).map((lead) => lead.id);
      let leadTasksMap = new Map<string, number>();
      let leadVisitsMap = new Map<string, number>();
      let leadOffersMap = new Map<string, number>();

      if (inboundLeadIds.length > 0) {
        const [{ data: leadTasks }, { data: leadVisits }, { data: leadOffers }] = await Promise.all([
          supabase.from('tasks').select('contact_id, completed').in('contact_id', inboundLeadIds),
          supabase.from('visits').select('contact_id').in('contact_id', inboundLeadIds),
          supabase.from('offers').select('contact_id').in('contact_id', inboundLeadIds),
        ]);

        leadTasksMap = ((leadTasks as any[]) || []).reduce((map, task) => {
          if (!task.completed) map.set(task.contact_id, (map.get(task.contact_id) || 0) + 1);
          return map;
        }, new Map<string, number>());

        leadVisitsMap = ((leadVisits as any[]) || []).reduce((map, visit) => {
          map.set(visit.contact_id, (map.get(visit.contact_id) || 0) + 1);
          return map;
        }, new Map<string, number>());

        leadOffersMap = ((leadOffers as any[]) || []).reduce((map, offer) => {
          map.set(offer.contact_id, (map.get(offer.contact_id) || 0) + 1);
          return map;
        }, new Map<string, number>());
      }

      const inboundFollowUp: FollowUpItem[] = (((inboundLeads as any[]) || [])
        .filter((lead) => {
          const openTasks = leadTasksMap.get(lead.id) || 0;
          const visits = leadVisitsMap.get(lead.id) || 0;
          const offers = leadOffersMap.get(lead.id) || 0;
          return (
            openTasks === 0 &&
            visits === 0 &&
            offers === 0 &&
            (!lead.pipeline_stage || ['nuevo', 'contactado'].includes(lead.pipeline_stage))
          );
        })
        .slice(0, 6)
        .map((lead) => {
          const sourceLabel = lead.tags?.includes('fb-lead-ads')
            ? 'FB Ads'
            : lead.tags?.includes('portal-lead')
              ? 'Portal'
              : 'Web';

          return {
            id: `lead-${lead.id}`,
            kind: 'lead',
            title: lead.full_name,
            summary: 'Lead inbound sin tarea, visita ni oferta. Conviene convertirlo ya en seguimiento operativo.',
            meta: [sourceLabel, lead.status, lead.city].filter(Boolean).join(' · ') || 'Lead inbound',
            priority: lead.status === 'nuevo' ? 'alta' : 'media',
            route: `/contacts/${lead.id}`,
            actionLabel: 'Abrir lead',
            contactId: lead.id,
          };
        }));

      const nextItems = [...overdueTasks, ...pendingWhatsapps, ...inboundFollowUp, ...staleContacts]
        .sort((left, right) => (left.priority === right.priority ? 0 : left.priority === 'alta' ? -1 : 1))
        .slice(0, 12);

      if (!cancelled) {
        setFollowUpItems(nextItems);
        setFollowUpLoading(false);
      }
    };

    loadFollowUp();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const followUpSummary = {
    urgent: followUpItems.filter((item) => item.priority === 'alta').length,
    whatsapp: followUpItems.filter((item) => item.kind === 'match').length,
    stale: followUpItems.filter((item) => item.kind === 'contact').length,
    inbound: followUpItems.filter((item) => item.kind === 'lead').length,
  };

  // ─── Render ───
  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="followup" className="flex-1 gap-1.5">
            <CalendarClock className="h-4 w-4" />Seguimiento
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 gap-1.5">
            <MessageCircle className="h-4 w-4" />Chat
          </TabsTrigger>
          <TabsTrigger value="calls" className="flex-1 gap-1.5">
            <Phone className="h-4 w-4" />Llamadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="followup" className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-destructive">Alta prioridad</p>
                <p className="text-3xl font-semibold mt-2">{followUpSummary.urgent}</p>
                <p className="text-xs text-muted-foreground mt-1">Llamadas o seguimientos que no deberian esperar.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">WhatsApp pendiente</p>
                <p className="text-3xl font-semibold mt-2">{followUpSummary.whatsapp}</p>
                <p className="text-xs text-muted-foreground mt-1">Cruces enviados pendientes de confirmacion.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Contactos frios</p>
                <p className="text-3xl font-semibold mt-2">{followUpSummary.stale}</p>
                <p className="text-xs text-muted-foreground mt-1">Contactos activos sin seguimiento reciente.</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Inbound sin trabajar</p>
                <p className="text-3xl font-semibold mt-2">{followUpSummary.inbound}</p>
                <p className="text-xs text-muted-foreground mt-1">Leads web, portal o FB Ads sin seguimiento operativo.</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bandeja de seguimiento comercial</CardTitle>
              <p className="text-sm text-muted-foreground">
                Prioriza llamadas, WhatsApp y contactos sin tocar en una sola cola rápida.
              </p>
            </CardHeader>
            <CardContent>
              {followUpLoading ? (
                <p className="text-sm text-muted-foreground">Cargando seguimiento comercial...</p>
              ) : followUpItems.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    No hay seguimientos comerciales urgentes ahora mismo.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {followUpItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.route)}
                      className="w-full rounded-2xl border border-border/60 px-4 py-4 text-left hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={item.priority === 'alta' ? 'destructive' : 'outline'}>
                              {item.kind === 'task' ? 'Tarea' : item.kind === 'match' ? 'WhatsApp' : item.kind === 'lead' ? 'Lead' : 'Contacto'}
                            </Badge>
                            <Badge variant="outline">
                              {item.priority === 'alta' ? 'Prioridad alta' : 'Seguimiento'}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold mt-3">{item.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{item.summary}</p>
                          <p className="text-xs text-muted-foreground mt-2">{item.meta}</p>
                          {(item.contactId || item.propertyId) && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTaskDraft(item);
                                }}
                              >
                                Crear tarea
                              </Button>
                              {item.kind === 'lead' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate('/operations?kind=lead');
                                  }}
                                >
                                  Ir a operaciones
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {item.priority === 'alta' ? (
                            <AlertTriangle className="h-4 w-4 text-destructive ml-auto" />
                          ) : (
                            <MessageCircle className="h-4 w-4 text-primary ml-auto" />
                          )}
                          <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                            {item.actionLabel}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Chat Tab ─── */}
        <TabsContent value="chat" className="mt-4">
          {isMobile ? (
            <div className="flex flex-col h-[calc(100dvh-200px)] rounded-xl border border-border/50 overflow-hidden bg-background shadow-sm">
              {!showMessages ? (
                <ChannelList
                  selectedChannelId={selectedChannelId}
                  onSelectChannel={handleSelectChannel}
                  unreadCounts={unreadCounts}
                />
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMessages(false)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">Canales</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <MessageArea channelId={selectedChannelId} onNewMessage={loadUnreadCounts} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[calc(100vh-8rem)] rounded-xl border border-border/50 overflow-hidden bg-background shadow-sm">
              <div className="w-64 shrink-0">
                <ChannelList
                  selectedChannelId={selectedChannelId}
                  onSelectChannel={handleSelectChannel}
                  unreadCounts={unreadCounts}
                />
              </div>
              <MessageArea channelId={selectedChannelId} onNewMessage={loadUnreadCounts} />
            </div>
          )}
        </TabsContent>

        {/* ─── Calls Tab ─── */}
        <TabsContent value="calls" className="mt-4">
          <div className="max-w-2xl mx-auto space-y-4">
            <Tabs defaultValue="dialer">
              <TabsList className="w-full">
                <TabsTrigger value="dialer" className="flex-1">Marcador</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">Historial</TabsTrigger>
              </TabsList>
              <TabsContent value="dialer" className="mt-4">
                <TwilioDialer />
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                <CallHistory />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>

      <FollowUpTaskDialog
        open={Boolean(taskDraftForItem)}
        onOpenChange={(open) => {
          if (!open) closeTaskDraft();
        }}
        form={taskForm}
        setForm={setTaskForm}
        saving={savingTask}
        onSubmit={handleCreateTask}
      />
    </div>
  );
};

export default Communications;
