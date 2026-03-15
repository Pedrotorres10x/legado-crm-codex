import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Zap, Phone, CalendarCheck, FileText, CheckCircle2,
  Flame, Target, Building2, Share2, MapPin, TrendingUp, ArrowRight, Circle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, endOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { getAgentKpiSummary, getAnnualTargetToDate } from '@/lib/agent-kpis';
import { useWebLeads } from '@/hooks/useWebLeadsData';
import { buildTopReasons, extractMatchDiscardReason, extractOfferLossReason, getCommercialSuggestion } from '@/lib/commercial-loss-reasons';
import { hasDistributionReady, hasPublishBasics, isAvailablePropertyStock, isMandateExpired } from '@/lib/property-stock-health';
import type { AgentDailyPlaybook } from '@/lib/agent-daily-playbook';
import Rule42210Card from '@/components/performance/Rule42210Card';

interface Priority {
  icon: React.ElementType;
  label: string;
  detail?: string;
  count?: number;
  action?: string;
  route?: string;
  color: string;
  bgColor: string;
  type: 'urgent' | 'task' | 'coaching';
}

interface ToquesHorus {
  llamada: number;
  whatsapp: number;
  email: number;
  cafe_comida: number;
  total: number;
}

type Props = {
  playbook?: AgentDailyPlaybook;
  storageKey?: string;
};

const TodayPriorities = ({ playbook, storageKey = 'agent-playbook' }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: inboundLeadsData = [] } = useWebLeads();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [toquesDetalle, setToquesDetalle] = useState<ToquesHorus>({ llamada: 0, whatsapp: 0, email: 0, cafe_comida: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const completedStorageKey = `${storageKey}:${user?.id || 'guest'}:${todayKey}`;
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    if (!playbook) {
      setCompleted([]);
      return;
    }

    const raw = window.localStorage.getItem(completedStorageKey);
    if (!raw) {
      setCompleted([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setCompleted(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCompleted([]);
    }
  }, [completedStorageKey, playbook]);

  const toggleDone = (key: string) => {
    setCompleted((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      window.localStorage.setItem(completedStorageKey, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const fetchPriorities = async () => {
      const now = new Date();
      const uid = user?.id;
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const sevenDaysAgo = addDays(now, -7).toISOString();
      const threeDaysAgo = addDays(now, -3).toISOString();

      // Build queries
      let matchesQ = supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'pendiente');
      let whatsappQ = supabase.from('matches').select('id', { count: 'exact', head: true })
        .eq('status', 'enviado').not('notes', 'is', null).ilike('notes', '%WhatsApp pendiente%');
      let todayVisitsQ = supabase.from('visits').select('id', { count: 'exact', head: true })
        .gte('visit_date', todayStart).lte('visit_date', todayEnd);
      let visitsSinQ = supabase.from('visits').select('id', { count: 'exact', head: true })
        .lt('visit_date', todayStart).gte('visit_date', sevenDaysAgo).is('result', null);
      let offersQ = supabase.from('offers').select('id', { count: 'exact', head: true })
        .eq('status', 'pendiente');
      let overdueTasks = supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('completed', false).lt('due_date', todayStart);
      let todayTasks = supabase.from('tasks').select('id, title, due_date, task_type, priority, contacts(full_name)')
        .eq('completed', false).gte('due_date', todayStart).lte('due_date', todayEnd).order('due_date');
      let closingTasksQ = supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('completed', false)
        .in('source', ['closing_blocked', 'closing_signature_pending', 'closing_deed_due']);
      let todayInteractionsQ = supabase.from('interactions').select('interaction_type')
        .in('interaction_type', ['llamada', 'whatsapp', 'email', 'cafe_comida'])
        .gte('interaction_date', todayStart).lte('interaction_date', todayEnd);
      let availablePropsQ = supabase.from('properties').select('id', { count: 'exact', head: true })
        .eq('status', 'disponible');
      let hotAlertsQ = supabase.from('interactions').select('id, contact_id, subject, contacts(full_name)')
        .eq('interaction_type', 'nota').ilike('subject', '%ALTO INTERÉS%')
        .gte('interaction_date', threeDaysAgo)
        .order('interaction_date', { ascending: false }).limit(5);

      if (uid) {
        matchesQ = matchesQ.eq('agent_id', uid);
        whatsappQ = whatsappQ.eq('agent_id', uid);
        todayVisitsQ = todayVisitsQ.eq('agent_id', uid);
        visitsSinQ = visitsSinQ.eq('agent_id', uid);
        offersQ = offersQ.eq('agent_id', uid);
        overdueTasks = overdueTasks.eq('agent_id', uid);
        todayTasks = todayTasks.eq('agent_id', uid);
        closingTasksQ = closingTasksQ.eq('agent_id', uid);
        todayInteractionsQ = todayInteractionsQ.eq('agent_id', uid);
        availablePropsQ = availablePropsQ.eq('agent_id', uid);
        hotAlertsQ = hotAlertsQ.eq('agent_id', uid);
      }

      const [
        pendingMatches,
        pendingWhatsapp,
        todayVisits,
        visitsSinResultado,
        offersActivas,
        closingTasks,
        todayInteractions,
        availableProps,
        hotAlerts,
        overdueTasksRes,
        todayTasksRes,
        matchLossesRes,
        offerLossesRes,
        stockRes,
        postSalePropertiesRes,
      ] = await Promise.all([
        matchesQ,
        whatsappQ,
        todayVisitsQ,
        visitsSinQ,
        offersQ,
        closingTasksQ,
        todayInteractionsQ,
        availablePropsQ,
        hotAlertsQ,
        overdueTasks,
        todayTasks,
        uid
          ? supabase.from('matches').select('notes').eq('agent_id', uid).eq('status', 'descartado')
          : Promise.resolve({ data: [] }),
        uid
          ? supabase.from('offers').select('notes').eq('agent_id', uid).in('status', ['rechazada', 'retirada', 'expirada'])
          : Promise.resolve({ data: [] }),
        uid
          ? supabase.from('properties').select('id, title, status, mandate_type, mandate_end, send_to_idealista, xml_id, source, price, images, description').eq('agent_id', uid)
          : Promise.resolve({ data: [] }),
        uid
          ? supabase.from('properties').select('id, title, status, updated_at').eq('agent_id', uid).in('status', ['vendido', 'alquilado'])
          : Promise.resolve({ data: [] }),
      ]);
      const kpiSummary = uid ? await getAgentKpiSummary(uid) : null;

      const toquesData = (todayInteractions.data as any[]) || [];
      const toquesDesglose: ToquesHorus = {
        llamada: toquesData.filter(t => t.interaction_type === 'llamada').length,
        whatsapp: toquesData.filter(t => t.interaction_type === 'whatsapp').length,
        email: toquesData.filter(t => t.interaction_type === 'email').length,
        cafe_comida: toquesData.filter(t => t.interaction_type === 'cafe_comida').length,
        total: toquesData.length,
      };
      setToquesDetalle(toquesDesglose);

      const items: Priority[] = [];
      const toquesHoy = kpiSummary?.toquesHorusHoy ?? toquesDesglose.total;
      const stockCount = availableProps.count || 0;
      const ventasAno = kpiSummary?.ventasAno ?? 0;
      const citasSemana = kpiSummary?.citasSemana ?? 0;
      const ofertasActivasCount = kpiSummary?.ofertasActivas ?? 0;
      const oportunidadesCalientes = kpiSummary?.oportunidadesCalientes ?? 0;
      const visitasSinOferta = kpiSummary?.visitasSinOferta ?? (visitsSinResultado.count || 0);
      const inboundSinTrabajar = inboundLeadsData.filter((lead) => lead.agent_id === uid && lead.needs_follow_up).length;
      const topMatchLossReason = buildTopReasons(((matchLossesRes.data as any[]) || []).map((row) => extractMatchDiscardReason(row.notes)))[0]?.[0] || null;
      const topOfferLossReason = buildTopReasons(((offerLossesRes.data as any[]) || []).map((row) => extractOfferLossReason(row.notes)))[0]?.[0] || null;
      const dominantCommercialReason = topOfferLossReason || topMatchLossReason;
      const stockRows = ((stockRes.data as any[]) || []).filter((property) => isAvailablePropertyStock(property));
      const expiredMandates = stockRows.filter((property) => isMandateExpired(property));
      const weakListings = stockRows.filter((property) => !hasPublishBasics(property));
      const distributionPending = stockRows.filter((property) => hasPublishBasics(property) && !hasDistributionReady(property));
      const postSaleRows = ((postSalePropertiesRes.data as any[]) || []) as Array<{ id: string; title?: string | null; status?: string | null }>;
      const targets = {
        ventas_ano: kpiSummary?.targets.ventas_ano ?? 10,
        citas_semana: kpiSummary?.targets.citas_semana ?? 2,
        toques_horus_dia: kpiSummary?.targets.toques_horus_dia ?? 4,
      };

      let postSalePendingCount = 0;
      if (postSaleRows.length > 0) {
        const propertyIds = postSaleRows.map((property) => property.id);
        const [{ data: postSaleCommissions }, { data: postSaleInvoices }] = await Promise.all([
          supabase.from('commissions').select('property_id, status, agency_commission').in('property_id', propertyIds),
          supabase.from('contact_invoices').select('property_id, status, amount').in('property_id', propertyIds),
        ]);

        const commissionMap = new Map<string, any>();
        for (const row of (postSaleCommissions as any[]) || []) {
          if (!commissionMap.has(row.property_id)) commissionMap.set(row.property_id, row);
        }

        const invoiceMap = new Map<string, any[]>();
        for (const row of (postSaleInvoices as any[]) || []) {
          const current = invoiceMap.get(row.property_id) || [];
          current.push(row);
          invoiceMap.set(row.property_id, current);
        }

        postSalePendingCount = postSaleRows.filter((property) => {
          const invoices = invoiceMap.get(property.id) || [];
          const pendingInvoices = invoices.filter((invoice) => !['pagada', 'cobrada', 'abonada'].includes((invoice.status || '').toLowerCase()));
          const commission = commissionMap.get(property.id);
          return !commission || invoices.length === 0 || pendingInvoices.length > 0;
        }).length;
      }

      // ═══════════════════════════════════════
      // 🔥 URGENT: High interest contacts
      // ═══════════════════════════════════════
      if ((hotAlerts.data?.length || 0) > 0) {
        const names = hotAlerts.data!.slice(0, 3).map((a: any) => a.contacts?.full_name || 'Contacto').join(', ');
        items.push({
          icon: Flame, label: `${hotAlerts.data!.length} contacto${hotAlerts.data!.length > 1 ? 's' : ''} con alto interés`,
          detail: `${names} — ¡Llama ya!`,
          count: hotAlerts.data!.length,
          action: 'Ver', route: '/contacts', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30',
          type: 'urgent',
        });
      }

      // Overdue tasks
      const overdueCount = overdueTasksRes.count || 0;
      if (overdueCount > 0) {
        items.push({
          icon: Flame, label: `${overdueCount} tarea${overdueCount > 1 ? 's' : ''} vencida${overdueCount > 1 ? 's' : ''}`,
          detail: '¡Tienes recordatorios sin completar!',
          count: overdueCount,
          action: 'Ver', route: '/tasks', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30',
          type: 'urgent',
        });
      }

      // Today's tasks
      const todayTasksList = (todayTasksRes.data as any[]) || [];
      if (todayTasksList.length > 0) {
        const names = todayTasksList.slice(0, 2).map((t: any) => t.title).join(', ');
        items.push({
          icon: CalendarCheck, label: `${todayTasksList.length} tarea${todayTasksList.length > 1 ? 's' : ''} para hoy`,
          detail: names,
          count: todayTasksList.length,
          action: 'Ver', route: '/tasks', color: 'text-primary', bgColor: 'bg-primary/10',
          type: 'task',
        });
      }

      if ((closingTasks.count || 0) > 0) {
        items.push({
          icon: FileText,
          label: `${closingTasks.count} cierre${closingTasks.count > 1 ? 's' : ''} o firma${closingTasks.count > 1 ? 's' : ''} por resolver`,
          detail: 'Hay operaciones con bloqueo, firma pendiente o escritura cercana.',
          count: closingTasks.count || 0,
          action: 'Ver',
          route: '/tasks',
          color: 'text-rose-600',
          bgColor: 'bg-rose-100 dark:bg-rose-900/30',
          type: 'urgent',
        });
      }

      if (oportunidadesCalientes > 0) {
        items.push({
          icon: TrendingUp,
          label: `${oportunidadesCalientes} oportunidad${oportunidadesCalientes > 1 ? 'es' : ''} caliente${oportunidadesCalientes > 1 ? 's' : ''}`,
          detail: 'Hay contraofertas u ofertas aceptadas listas para empujar a cierre.',
          count: oportunidadesCalientes,
          action: 'Resolver',
          route: '/operations?kind=offer',
          color: 'text-rose-600',
          bgColor: 'bg-rose-100 dark:bg-rose-900/30',
          type: 'urgent',
        });
      }

      if (inboundSinTrabajar > 0) {
        items.push({
          icon: Building2,
          label: `${inboundSinTrabajar} lead${inboundSinTrabajar > 1 ? 's' : ''} inbound sin trabajar`,
          detail: 'Hay leads web, portal o FB Ads todavía sin tarea, visita ni oferta.',
          count: inboundSinTrabajar,
          action: 'Resolver',
          route: '/operations?kind=lead',
          color: 'text-violet-600',
          bgColor: 'bg-violet-100 dark:bg-violet-900/30',
          type: 'urgent',
        });
      }

      if (expiredMandates.length > 0) {
        items.push({
          icon: FileText,
          label: `${expiredMandates.length} mandato${expiredMandates.length === 1 ? '' : 's'} vencido${expiredMandates.length === 1 ? '' : 's'}`,
          detail: 'Renueva exclusividad o redefine salida comercial del stock disponible.',
          count: expiredMandates.length,
          action: 'Revisar',
          route: '/operations?kind=stock',
          color: 'text-red-600',
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          type: 'urgent',
        });
      }

      if (weakListings.length > 0) {
        items.push({
          icon: Building2,
          label: `${weakListings.length} ficha${weakListings.length === 1 ? '' : 's'} floja${weakListings.length === 1 ? '' : 's'} para publicar`,
          detail: 'Faltan básicos de publicación como fotos, precio o descripción.',
          count: weakListings.length,
          action: 'Completar',
          route: '/operations?kind=stock',
          color: 'text-amber-600',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          type: 'task',
        });
      }

      if (distributionPending.length > 0) {
        items.push({
          icon: Share2,
          label: `${distributionPending.length} inmueble${distributionPending.length === 1 ? '' : 's'} sin difusión`,
          detail: 'La ficha está lista, pero sigue sin Idealista o feed activo.',
          count: distributionPending.length,
          action: 'Publicar',
          route: '/operations?kind=stock',
          color: 'text-sky-600',
          bgColor: 'bg-sky-100 dark:bg-sky-900/30',
          type: 'task',
        });
      }

      if (postSalePendingCount > 0) {
        items.push({
          icon: FileText,
          label: `${postSalePendingCount} operación${postSalePendingCount === 1 ? '' : 'es'} cerrada${postSalePendingCount === 1 ? '' : 's'} con postventa pendiente`,
          detail: 'Falta comisión, factura final o cierre de cobro en parte de las operaciones ya firmadas.',
          count: postSalePendingCount,
          action: 'Revisar',
          route: '/operations?kind=postsale',
          color: 'text-rose-600',
          bgColor: 'bg-rose-100 dark:bg-rose-900/30',
          type: 'urgent',
        });
      }

      // ═══════════════════════════════════════
      // 📋 OPERATIONAL TASKS
      // ═══════════════════════════════════════
      if ((todayVisits.count || 0) > 0) {
        items.push({
          icon: CalendarCheck, label: 'Visitas programadas hoy', count: todayVisits.count || 0,
          action: 'Ver', route: '/contacts', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          type: 'task',
        });
      }
      if ((pendingMatches.count || 0) > 0) {
        items.push({
          icon: Send, label: 'Matches por enviar', count: pendingMatches.count || 0,
          action: 'Enviar', route: '/matches', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30',
          type: 'task',
        });
      }
      if ((pendingWhatsapp.count || 0) > 0) {
        items.push({
          icon: MessageCircle, label: 'WhatsApp pendientes de enviar', count: pendingWhatsapp.count || 0,
          detail: 'Propiedades enviadas por email — confirma por WhatsApp',
          action: 'Enviar', route: '/matches', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30',
          type: 'task',
        });
      }
      if (visitasSinOferta > 0) {
        items.push({
          icon: Phone, label: 'Visitas sin oferta — haz seguimiento', count: visitasSinOferta,
          detail: 'Hay visitas hechas que no se han convertido en oferta ni siguiente paso comercial.',
          action: 'Revisar', route: '/operations?kind=visit', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          type: 'task',
        });
      }
      if (ofertasActivasCount > 0) {
        items.push({
          icon: FileText, label: 'Ofertas activas en seguimiento', count: ofertasActivasCount,
          detail: 'Revisa pendientes, presentadas y contraofertas desde la cola operativa.',
          action: 'Ver', route: '/operations?kind=offer', color: 'text-rose-600', bgColor: 'bg-rose-100 dark:bg-rose-900/30',
          type: 'task',
        });
      }

      if (dominantCommercialReason) {
        items.push({
          icon: TrendingUp,
          label: 'Fricción comercial dominante',
          detail: `${dominantCommercialReason} · ${getCommercialSuggestion(dominantCommercialReason)}`,
          action: 'Revisar',
          route: '/matches',
          color: 'text-rose-600',
          bgColor: 'bg-rose-100 dark:bg-rose-900/30',
          type: 'coaching',
        });
      }

      // ═══════════════════════════════════════
      // 🎯 COACHING: Daily habits & KPIs
      // ═══════════════════════════════════════

      // Stock alert
      if (stockCount < 5) {
        items.push({
          icon: Flame, label: '¡Stock crítico! Necesitas captar',
          detail: `Solo ${stockCount} inmueble${stockCount !== 1 ? 's' : ''} disponibles. Mínimo 5 para vender.`,
          action: 'Captar', route: '/properties', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30',
          type: 'urgent',
        });
      }

      // Toques Horus — se renderiza como widget dedicado (ver JSX), no como Priority item



      // Zona diaria
      items.push({
        icon: MapPin, label: '¿Has salido a hacer zona hoy?',
        detail: 'Recorre tu zona, busca carteles, habla con porteros.',
        action: 'Inmuebles', route: '/properties', color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
        type: 'coaching',
      });

      // KPI: Ventas año a ritmo
      const annualPace = getAnnualTargetToDate(targets.ventas_ano);
      if (ventasAno < annualPace) {
        items.push({
          icon: Target, label: `Ritmo anual de arras: ${ventasAno}/${targets.ventas_ano}`,
          detail: `A esta fecha deberías ir aprox. por ${annualPace}. Revisa ofertas activas y compradores calientes.`,
          action: 'Resolver', route: '/operations?kind=offer', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30',
          type: 'coaching',
        });
      }


      // KPI: Citas captación semana
      if (citasSemana < targets.citas_semana) {
        items.push({
          icon: CalendarCheck, label: `Citas captación semana: ${citasSemana}/${targets.citas_semana}`,
          detail: `Necesitas ${targets.citas_semana - citasSemana} cita${targets.citas_semana - citasSemana > 1 ? 's' : ''} más.`,
          color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30',
          type: 'coaching',
        });
      }

      // RRSS reminder (morning hours)
      const hour = now.getHours();
      if (hour >= 9 && hour <= 14) {
        items.push({
          icon: Share2, label: 'RRSS: comparte y crea contenido',
          detail: 'Publica un post de la agencia y crea contenido propio.',
          color: 'text-violet-600', bgColor: 'bg-violet-100 dark:bg-violet-900/30',
          type: 'coaching',
        });
      }

      setPriorities(items);
      setLoading(false);
    };
    fetchPriorities();
  }, [inboundLeadsData, user]);

  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  const urgentItems = priorities.filter(p => p.type === 'urgent');
  const taskItems = priorities.filter(p => p.type === 'task');
  const coachingItems = priorities.filter(p => p.type === 'coaching');
  const orderedQueue = playbook
    ? [playbook.primaryAction, ...playbook.steps].map((item, index) => ({
        ...item,
        label: index === 0 ? 'Mision principal' : `Paso ${index}`,
      }))
    : [];
  const completedCount = orderedQueue.filter((item) => completed.includes(item.key)).length;
  const homeScreen = playbook
    ? playbook.primaryAction.route.startsWith('/contacts')
      ? {
          label: 'Pantalla base de hoy: Personas',
          detail: 'Tu negocio hoy nace de relaciones, toques, prospectos y siguiente paso.',
          route: '/contacts',
          cta: 'Ir a Personas',
        }
        : playbook.primaryAction.route.startsWith('/matches')
          ? {
            label: 'Pantalla base de hoy: Compradores y cruces',
            detail: 'Tu negocio hoy nace de visitas, ofertas, negociación y empuje a arras.',
            route: '/matches',
            cta: 'Ir a Compradores y cruces',
          }
        : {
            label: 'Pantalla base de hoy: Operaciones',
            detail: 'Hoy manda la cola del día: bloqueos, tareas, leads y cierres vivos.',
            route: '/operations',
            cta: 'Ir a Operaciones',
          }
    : null;

  return (
    <div className="space-y-4">
      <Rule42210Card compact />

      <Card className="animate-fade-in-up border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-lg font-display">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600">
            <Zap className="h-4 w-4" />
          </div>
          ¿Qué toca hoy?
          <span className="text-sm font-normal text-muted-foreground capitalize ml-1">— {today}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {playbook && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Bandeja unica del dia</p>
                    <p className="mt-2 text-base font-semibold">{playbook.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{playbook.intro}</p>
                  </div>
                  <Badge variant="secondary">
                    {completedCount}/{orderedQueue.length} hechos
                  </Badge>
                </div>
                {homeScreen && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-background/80 p-4">
                    <p className="text-sm font-medium">{homeScreen.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{homeScreen.detail}</p>
                    <div className="mt-3">
                      <Button size="sm" onClick={() => navigate(homeScreen.route)}>
                        <ArrowRight className="mr-1 h-4 w-4" />
                        {homeScreen.cta}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  {orderedQueue.map((item, index) => {
                    const isDone = completed.includes(item.key);
                    return (
                      <div key={item.key} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <Button
                            type="button"
                            variant={isDone ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-full"
                            onClick={() => toggleDone(item.key)}
                          >
                            {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                          </Button>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {index === 0 ? 'Mision principal' : `Paso ${index}`}
                            </p>
                            <p className="mt-1 text-sm font-semibold">{item.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate(item.route)}>
                          <ArrowRight className="mr-1 h-4 w-4" />
                          {item.cta}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <p className="font-medium">Si haces esto, vas en ritmo</p>
                    <p className="mt-1 text-xs">{playbook.outcomePromise}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-medium">Si no lo haces hoy</p>
                    <p className="mt-1 text-xs">{playbook.riskIfSkipped}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Urgent */}
            {urgentItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bloqueos y urgencias reales</p>
                {urgentItems.map((p, i) => (
                  <PriorityRow key={`u-${i}`} p={p} navigate={navigate} />
                ))}
              </div>
            )}

            {/* Operational tasks */}
            {taskItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Siguiente cola operativa</p>
                {taskItems.map((p, i) => (
                  <PriorityRow key={`t-${i}`} p={p} navigate={navigate} />
                ))}
              </div>
            )}

            {/* Coaching */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hábitos y objetivos</p>

              {/* Toques Horus — tracker visual siempre visible */}
              <ToquesHorusTracker toques={toquesDetalle} navigate={navigate} />

              {coachingItems.map((p, i) => (
                <PriorityRow key={`c-${i}`} p={p} navigate={navigate} />
              ))}
            </div>


            {urgentItems.length === 0 && taskItems.length === 0 && (
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Sin tareas urgentes — ¡buen trabajo! Revisa los hábitos.</p>
              </div>
            )}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
};

const PriorityRow = ({ p, navigate }: { p: Priority; navigate: (route: string) => void }) => {
  const Icon = p.icon;
  return (
    <div
      className={`flex items-center justify-between rounded-xl border border-border/50 p-3 hover:bg-muted/30 transition-colors ${
        p.type === 'urgent' ? 'border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/10' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${p.bgColor} ${p.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{p.label}</p>
            {p.count && <Badge variant="secondary" className="text-xs shrink-0">{p.count}</Badge>}
          </div>
          {p.detail && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.detail}</p>}
        </div>
      </div>
      {p.action && p.route && (
        <Button size="sm" variant="outline" className="ml-2 shrink-0" onClick={() => navigate(p.route!)}>
          {p.action}
        </Button>
      )}
    </div>
  );
};

const SLOTS = [
  { tipo: 'llamada' as const, icon: '📞', label: 'Llamada' },
  { tipo: 'whatsapp' as const, icon: '💬', label: 'WhatsApp' },
  { tipo: 'email' as const, icon: '📧', label: 'Email' },
  { tipo: 'cafe_comida' as const, icon: '☕', label: 'Café / Comida' },
];

const ToquesHorusTracker = ({ toques, navigate }: { toques: ToquesHorus; navigate: (r: string) => void }) => {
  const total = toques.total;
  const meta = 4;
  const minimo = 2;

  const statusLabel =
    total === 0 ? '¡Empieza ya!' :
    total < minimo ? `Faltan ${minimo - total} para el mínimo` :
    total < meta ? `Puedes hacer ${meta - total} más` :
    '🎯 ¡Objetivo cumplido!';

  const headerColor = total >= meta
    ? 'text-emerald-700 dark:text-emerald-400'
    : total >= minimo
      ? 'text-emerald-600 dark:text-emerald-500'
      : 'text-amber-600 dark:text-amber-500';

  const borderColor = total >= meta
    ? 'border-emerald-200 dark:border-emerald-800/50'
    : total >= minimo
      ? 'border-emerald-200 dark:border-emerald-800/40'
      : 'border-amber-200 dark:border-amber-800/40';

  const bgColor = total >= meta
    ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
    : total >= minimo
      ? 'bg-emerald-50/40 dark:bg-emerald-950/10'
      : 'bg-amber-50/60 dark:bg-amber-950/20';

  return (
    <div
      className={`rounded-xl border p-3 transition-colors cursor-pointer hover:bg-muted/30 ${borderColor} ${bgColor}`}
      onClick={() => navigate('/contacts')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${
            total >= meta ? 'bg-emerald-200 dark:bg-emerald-800/40' : total >= minimo ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            <Phone className={`h-3.5 w-3.5 ${headerColor}`} />
          </div>
          <span className={`text-sm font-semibold ${headerColor}`}>
            Toques Horus — {total}/{meta}
          </span>
        </div>
        <span className={`text-xs font-medium ${headerColor}`}>{statusLabel}</span>
      </div>

      {/* 4 Slots */}
      <div className="grid grid-cols-4 gap-2">
        {SLOTS.map(({ tipo, icon, label }) => {
          const count = toques[tipo];
          const filled = count > 0;
          return (
            <div
              key={tipo}
              className={`flex flex-col items-center gap-1 rounded-lg py-2 px-1 transition-all ${
                filled
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700/50'
                  : 'bg-muted/40 border border-border/50'
              }`}
            >
              <span className={`text-xl leading-none ${filled ? '' : 'grayscale opacity-40'}`}>{icon}</span>
              <span className={`text-[10px] font-medium text-center leading-tight ${
                filled ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
              }`}>{label}</span>
              {count > 1 && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">×{count}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Recordatorio contextual */}
      <div className="mt-3 rounded-md border border-amber-400/50 bg-amber-400/10 px-3 py-2 flex items-start gap-2">
        <span className="text-sm leading-none mt-0.5">📋</span>
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 leading-snug">
          Aquí solo <span className="font-bold">anotamos</span> la gestión — el trabajo se hace en <span className="font-bold">Horus</span>
        </p>
      </div>
    </div>
  );
};

export default TodayPriorities;
