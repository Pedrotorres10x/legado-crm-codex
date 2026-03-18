import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Calendar, MessageSquare, AlertTriangle,
  Building2, Target, Share2, Phone, Flame, TrendingUp, CheckCircle, FileWarning, Landmark, Signature
} from 'lucide-react';
import { addDays, startOfDay, endOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { format, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import { buildClosingOperationalBlockers } from '@/lib/closing-ops';
import { syncClosingAutomationTasks } from '@/lib/closing-task-sync';
import { getAgentKpiSummary, getAnnualTargetToDate } from '@/lib/agent-kpis';
import { useWebLeads } from '@/hooks/useWebLeadsData';
import { buildTopReasons, extractMatchDiscardReason, extractOfferLossReason, getCommercialSuggestion } from '@/lib/commercial-loss-reasons';
import { hasDistributionReady, hasPublishBasics, isAvailablePropertyStock, isMandateExpired } from '@/lib/property-stock-health';

export interface Notification {
  id: string;
  type: 'upcoming_visit' | 'no_feedback' | 'unconfirmed' | 'coaching' | 'high_interest' | 'closing_blocked' | 'signature_pending' | 'deed_due' | 'hot_offer' | 'visit_followup' | 'inbound_followup' | 'stock_issue' | 'postsale_issue';
  title: string;
  description: string;
  icon: typeof Calendar;
  color: string;
  priority?: number;
  action?: () => void;
}

export function useNotifications() {
  const { user } = useAuth();
  const { data: inboundLeads = [] } = useWebLeads();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const now = new Date();
    const in48h = addDays(now, 2);
    const results: Notification[] = [];

    const weekAgo = addDays(now, -7);
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const threeDaysAgo = addDays(now, -3).toISOString();

    const [
      { data: upcoming },
      { data: noFeedback },
      { count: availablePropsCount },
      { data: todayInteractions },
      { data: highInterestAlerts },
      { data: closingProperties },
      { data: matchLosses },
      { data: offerLosses },
      { data: stockRows },
      { data: postSaleRows },
    ] = await Promise.all([
      supabase.from('visits').select('id, visit_date, property_id, contact_id, confirmation_status, properties(title), contacts(full_name)')
        .eq('agent_id', user.id)
        .gte('visit_date', now.toISOString()).lte('visit_date', in48h.toISOString()).order('visit_date', { ascending: true }),
      supabase.from('visits').select('id, visit_date, property_id, contact_id, result, properties(title), contacts(full_name)')
        .eq('agent_id', user.id)
        .lt('visit_date', now.toISOString()).gte('visit_date', weekAgo.toISOString()).is('result', null).order('visit_date', { ascending: false }).limit(10),
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'disponible').eq('agent_id', user.id),
      supabase.from('interactions').select('id').gte('interaction_date', todayStart).lte('interaction_date', todayEnd).eq('agent_id', user.id),
      supabase.from('interactions').select('id, contact_id, subject, description, interaction_date, contacts(full_name)')
        .eq('interaction_type', 'nota').ilike('subject', '%ALTO INTERÉS%')
        .gte('interaction_date', threeDaysAgo).order('interaction_date', { ascending: false }).limit(10),
      supabase
        .from('properties')
        .select('id, title, status, legal_risk_level, reservation_date, arras_status, arras_date, arras_amount, arras_buyer_id, deed_date, deed_notary')
        .eq('agent_id', user.id)
        .or('reservation_date.not.is.null,arras_status.neq.sin_arras,deed_date.not.is.null,status.eq.arras,status.eq.reservado')
        .limit(12),
      supabase.from('matches').select('notes').eq('agent_id', user.id).eq('status', 'descartado'),
      supabase.from('offers').select('notes').eq('agent_id', user.id).in('status', ['rechazada', 'retirada', 'expirada']),
      supabase.from('properties').select('id, title, status, mandate_type, mandate_end, xml_id, source, price, images, description').eq('agent_id', user.id),
      supabase.from('properties').select('id, title, status, updated_at').eq('agent_id', user.id).in('status', ['vendido', 'alquilado']),
    ]);
    const kpiSummary = await getAgentKpiSummary(user.id);

    const stockCount = availablePropsCount || 0;
    const toquesHoy = kpiSummary.toquesHorusHoy;
    const inboundPending = inboundLeads.filter((lead) => lead.agent_id === user.id && lead.needs_follow_up).length;
    const topMatchLossReason = buildTopReasons(((matchLosses as any[]) || []).map((row) => extractMatchDiscardReason(row.notes)))[0]?.[0] || null;
    const topOfferLossReason = buildTopReasons(((offerLosses as any[]) || []).map((row) => extractOfferLossReason(row.notes)))[0]?.[0] || null;
    const dominantCommercialReason = topOfferLossReason || topMatchLossReason;
    const availableStock = ((stockRows as any[]) || []).filter((property) => isAvailablePropertyStock(property));
    const expiredMandates = availableStock.filter((property) => isMandateExpired(property));
    const weakListings = availableStock.filter((property) => !hasPublishBasics(property));
    const distributionPending = availableStock.filter((property) => hasPublishBasics(property) && !hasDistributionReady(property));
    const postSaleProperties = ((postSaleRows as any[]) || []) as Array<{ id: string }>;

    let postSalePendingCount = 0;
    if (postSaleProperties.length > 0) {
      const propertyIds = postSaleProperties.map((property) => property.id);
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

      postSalePendingCount = postSaleProperties.filter((property) => {
        const invoices = invoiceMap.get(property.id) || [];
        const pendingInvoices = invoices.filter((invoice) => !['pagada', 'cobrada', 'abonada'].includes((invoice.status || '').toLowerCase()));
        const commission = commissionMap.get(property.id);
        return !commission || invoices.length === 0 || pendingInvoices.length > 0;
      }).length;
    }

    // Stock alerts
    if (stockCount < 5) {
      results.push({
        id: 'coaching-stock-critical',
        type: 'coaching',
        title: '🔥 ¡Stock crítico! Necesitas captar YA',
        description: `Solo ${stockCount} inmueble${stockCount !== 1 ? 's' : ''} en exclusiva. Por debajo de 5 no se puede vender.`,
        icon: Flame,
        color: 'text-destructive',
        priority: 1,
        action: () => navigate('/properties'),
      });
    } else if (stockCount < 10) {
      results.push({
        id: 'coaching-stock-medium',
        type: 'coaching',
        title: `📊 Stock aceptable (${stockCount}/10) — sigue captando`,
        description: `El óptimo son 10 exclusivas. Te faltan ${10 - stockCount}.`,
        icon: TrendingUp,
        color: 'text-warning',
        priority: 2,
        action: () => navigate('/properties'),
      });
    } else if (stockCount > 15) {
      results.push({
        id: 'coaching-stock-overload',
        type: 'coaching',
        title: `⚠️ Demasiado stock (${stockCount}/15 máx)`,
        description: 'Con exclusivas, más de 15 no se pueden gestionar bien.',
        icon: AlertTriangle,
        color: 'text-warning',
        priority: 3,
      });
    }

    const ventasAno = kpiSummary.ventasAno;
    const citasCaptacionSemana = kpiSummary.citasSemana;
    const ofertasActivas = kpiSummary.ofertasActivas;
    const oportunidadesCalientes = kpiSummary.oportunidadesCalientes;
    const visitasSinOferta = kpiSummary.visitasSinOferta;
    const targets = {
      ventas_ano: kpiSummary.targets.ventas_ano,
      citas_semana: kpiSummary.targets.citas_semana,
      toques_horus_dia: kpiSummary.targets.toques_horus_dia,
    };

    const annualPace = getAnnualTargetToDate(targets.ventas_ano, now);
    if (ventasAno < annualPace) {
      results.push({
        id: 'kpi-ventas',
        type: 'coaching',
        title: `🎯 Ritmo anual de arras: ${ventasAno}/${targets.ventas_ano}`,
        description: `A esta fecha deberías ir aprox. por ${annualPace}. Revisa ofertas activas y compradores más calientes.`,
        icon: Target,
        color: 'text-destructive',
        priority: 2,
        action: () => navigate('/matches'),
      });
    } else {
      results.push({
        id: 'kpi-ventas-ok',
        type: 'coaching',
        title: `✅ Ritmo anual cumplido (${ventasAno}/${targets.ventas_ano})`,
        description: ventasAno > targets.ventas_ano ? `¡${ventasAno} arras este año! Excepcional.` : 'Vas en ritmo para el objetivo anual.',
        icon: CheckCircle,
        color: 'text-success',
        priority: 10,
      });
    }


    results.push({
      id: 'kpi-citas-captacion',
      type: 'coaching',
      title: `${citasCaptacionSemana >= targets.citas_semana ? '✅' : '📅'} Citas captación esta semana: ${citasCaptacionSemana}/${targets.citas_semana}`,
      description: citasCaptacionSemana >= targets.citas_semana
        ? '¡Objetivo semanal de citas de captación cumplido!'
        : `Necesitas ${targets.citas_semana - citasCaptacionSemana} cita${targets.citas_semana - citasCaptacionSemana > 1 ? 's' : ''} más esta semana.`,
      icon: citasCaptacionSemana >= targets.citas_semana ? CheckCircle : Calendar,
      color: citasCaptacionSemana >= targets.citas_semana ? 'text-success' : 'text-warning',
      priority: citasCaptacionSemana >= targets.citas_semana ? 10 : 3,
    });

    if (oportunidadesCalientes > 0) {
      results.push({
        id: 'commercial-hot-offers',
        type: 'hot_offer',
        title: `🔥 ${oportunidadesCalientes} oportunidad${oportunidadesCalientes > 1 ? 'es' : ''} caliente${oportunidadesCalientes > 1 ? 's' : ''}`,
        description: 'Hay contraofertas u ofertas aceptadas que conviene empujar hoy.',
        icon: TrendingUp,
        color: 'text-rose-600',
        priority: 2,
        action: () => navigate('/operations?kind=offer'),
      });
    }

    if (visitasSinOferta > 0) {
      results.push({
        id: 'commercial-visit-followup',
        type: 'visit_followup',
        title: `📝 ${visitasSinOferta} visita${visitasSinOferta > 1 ? 's' : ''} sin oferta`,
        description: 'Haz seguimiento de visitas ya realizadas que aún no han avanzado.',
        icon: MessageSquare,
        color: 'text-amber-600',
        priority: 4,
        action: () => navigate('/operations?kind=visit'),
      });
    }

    if (inboundPending > 0) {
      results.push({
        id: 'commercial-inbound-followup',
        type: 'inbound_followup',
        title: `🌐 ${inboundPending} lead${inboundPending > 1 ? 's' : ''} inbound sin trabajar`,
        description: 'Tienes leads web, portal o FB Ads sin tarea, visita ni oferta.',
        icon: MessageSquare,
        color: 'text-violet-600',
        priority: 2,
        action: () => navigate('/operations?kind=lead'),
      });
    }

    if (dominantCommercialReason) {
      results.push({
        id: 'commercial-loss-pattern',
        type: 'coaching',
        title: 'Fricción comercial dominante detectada',
        description: `${dominantCommercialReason}. ${getCommercialSuggestion(dominantCommercialReason)}`,
        icon: TrendingUp,
        color: 'text-rose-600',
        priority: 4,
        action: () => navigate('/matches'),
      });
    }

    if (expiredMandates.length > 0) {
      results.push({
        id: 'stock-mandate-expired',
        type: 'stock_issue',
        title: `📄 ${expiredMandates.length} mandato${expiredMandates.length === 1 ? '' : 's'} vencido${expiredMandates.length === 1 ? '' : 's'}`,
        description: 'Hay stock disponible con exclusividad o mandato ya vencido.',
        icon: AlertTriangle,
        color: 'text-destructive',
        priority: 2,
        action: () => navigate('/operations?kind=stock'),
      });
    }

    if (weakListings.length > 0) {
      results.push({
        id: 'stock-weak-listings',
        type: 'stock_issue',
        title: `🧱 ${weakListings.length} ficha${weakListings.length === 1 ? '' : 's'} floja${weakListings.length === 1 ? '' : 's'} para publicar`,
        description: 'Faltan básicos de publicación como fotos, precio o descripción en parte del stock activo.',
        icon: Building2,
        color: 'text-amber-600',
        priority: 4,
        action: () => navigate('/operations?kind=stock'),
      });
    }

    if (distributionPending.length > 0) {
      results.push({
        id: 'stock-distribution-pending',
        type: 'stock_issue',
        title: `🌐 ${distributionPending.length} inmueble${distributionPending.length === 1 ? '' : 's'} sin difusión`,
        description: 'Hay fichas ya listas que aún no tienen feed activo.',
        icon: Building2,
        color: 'text-sky-600',
        priority: 4,
        action: () => navigate('/operations?kind=stock'),
      });
    }

    if (postSalePendingCount > 0) {
      results.push({
        id: 'postsale-pending',
        type: 'postsale_issue',
        title: `🧾 ${postSalePendingCount} operación${postSalePendingCount === 1 ? '' : 'es'} cerrada${postSalePendingCount === 1 ? '' : 's'} con postventa pendiente`,
        description: 'Falta comisión, factura final o cierre de cobro en operaciones ya firmadas.',
        icon: FileWarning,
        color: 'text-rose-600',
        priority: 3,
        action: () => navigate('/operations?kind=postsale'),
      });
    }

    if (ofertasActivas > 0) {
      results.push({
        id: 'commercial-active-offers',
        type: 'coaching',
        title: `💶 ${ofertasActivas} oferta${ofertasActivas > 1 ? 's' : ''} activa${ofertasActivas > 1 ? 's' : ''}`,
        description: 'Tienes negociaciones vivas para revisar desde Operaciones.',
        icon: FileWarning,
        color: 'text-primary',
        priority: 5,
        action: () => navigate('/operations?kind=offer'),
      });
    }

    if (toquesHoy < targets.toques_horus_dia) {
      const remaining = targets.toques_horus_dia - toquesHoy;
      results.push({
        id: 'coaching-toques',
        type: 'coaching',
        title: `📞 Te faltan ${remaining} toque${remaining > 1 ? 's' : ''} hoy`,
        description: toquesHoy === 0
          ? 'Haz tus 3-4 toques del día. Cada toque cuenta para captar.'
          : `Llevas ${toquesHoy} toque${toquesHoy > 1 ? 's' : ''} hoy. ¡Haz ${remaining} más!`,
        icon: Phone,
        color: 'text-success',
        priority: 3,
        action: () => navigate('/contacts'),
      });
    } else {
      results.push({
        id: 'coaching-toques-done',
        type: 'coaching',
        title: '✅ Toques del día completados',
        description: `${toquesHoy} toques hoy. ¡Buen trabajo!`,
        icon: CheckCircle,
        color: 'text-success',
        priority: 10,
      });
    }

    results.push({
      id: 'coaching-zona',
      type: 'coaching',
      title: '🗺️ ¿Has salido a hacer zona hoy?',
      description: 'Recorre tu zona, busca carteles, habla con porteros.',
      icon: Target,
      color: 'text-primary',
      priority: 4,
      action: () => navigate('/properties'),
    });

    const hour = now.getHours();
    if (hour >= 9 && hour <= 14) {
      results.push({
        id: 'coaching-rrss',
        type: 'coaching',
        title: '📱 RRSS: comparte y crea contenido',
        description: 'Comparte un post de la agencia y crea contenido propio.',
        icon: Share2,
        color: 'text-accent',
        priority: 5,
      });
    }


    // High interest
    highInterestAlerts?.forEach(alert => {
      const contactName = (alert as any).contacts?.full_name || 'Contacto';
      results.push({
        id: `high-interest-${alert.id}`,
        type: 'high_interest',
        title: `🔥 ${contactName} — Alto interés`,
        description: alert.description || 'Ha interactuado con tus emails múltiples veces. ¡Llámale ahora!',
        icon: Flame,
        color: 'text-orange-500',
        priority: 1,
        action: () => navigate(`/contacts/${alert.contact_id}`),
      });
    });

    // Upcoming visits
    upcoming?.forEach(v => {
      const date = new Date(v.visit_date);
      const when = isToday(date) ? 'Hoy' : isTomorrow(date) ? 'Mañana' : format(date, "EEEE", { locale: es });
      results.push({
        id: `upcoming-${v.id}`,
        type: 'upcoming_visit',
        title: `📅 Visita ${when} a las ${format(date, 'HH:mm')}`,
        description: `${(v as any).properties?.title} — ${(v as any).contacts?.full_name}`,
        icon: Calendar,
        color: isToday(date) ? 'text-orange-500' : 'text-primary',
        priority: 6,
        action: () => navigate(`/properties/${v.property_id}`),
      });
    });

    // Unconfirmed
    const unconfirmed = upcoming?.filter(v => v.confirmation_status === 'pendiente') || [];
    unconfirmed.forEach(v => {
      results.push({
        id: `unconfirmed-${v.id}`,
        type: 'unconfirmed',
        title: '⚠️ Visita sin confirmar',
        description: `${(v as any).contacts?.full_name} no ha confirmado la visita a ${(v as any).properties?.title}`,
        icon: AlertTriangle,
        color: 'text-warning',
        priority: 5,
        action: () => navigate(`/contacts/${v.contact_id}`),
      });
    });

    // No feedback
    noFeedback?.forEach(v => {
      results.push({
        id: `nofeedback-${v.id}`,
        type: 'no_feedback',
        title: '📝 Feedback pendiente',
        description: `Visita del ${format(new Date(v.visit_date), "dd MMM", { locale: es })} a ${(v as any).properties?.title} con ${(v as any).contacts?.full_name}`,
        icon: MessageSquare,
        color: 'text-info',
        priority: 7,
        action: () => navigate(`/properties/${v.property_id}`),
      });
    });

    const enrichedClosing = await Promise.all((closingProperties || []).map(async (property: any) => {
      const [docsRes, signaturesRes, ownersRes] = await Promise.all([
        supabase.from('property_documents').select('doc_type').eq('property_id', property.id),
        supabase
          .from('documents')
          .select('generated_contracts(signature_status), document_properties!inner(property_id)')
          .eq('document_properties.property_id', property.id),
        supabase.from('property_owners').select('id', { count: 'exact', head: true }).eq('property_id', property.id),
      ]);

      const uploadedDocTypes = Array.from(new Set((docsRes.data || []).map((doc: any) => doc.doc_type).filter(Boolean)));
      const pendingSignatureCount = (signaturesRes.data || []).filter((doc: any) => doc.generated_contracts?.signature_status === 'pendiente').length;
      const ownerCount = ownersRes.count || 0;
      const analysis = buildClosingOperationalBlockers({
        property,
        propertyOwnerCount: ownerCount,
        uploadedDocTypes,
        pendingSignatureCount,
      });

      return {
        property,
        pendingSignatureCount,
        blockers: analysis.blockers,
      };
    }));

    try {
      await syncClosingAutomationTasks({
        agentId: user.id,
        analyses: enrichedClosing,
      });
    } catch (error) {
      console.error('No se pudieron sincronizar las tareas automaticas de cierre', error);
    }

    enrichedClosing
      .filter(({ pendingSignatureCount }) => pendingSignatureCount > 0)
      .slice(0, 2)
      .forEach(({ property, pendingSignatureCount }) => {
        results.push({
          id: `signature-pending-${property.id}`,
          type: 'signature_pending',
          title: `✍️ Firma pendiente en ${property.title || 'inmueble'}`,
          description: `${pendingSignatureCount} documento(s) siguen pendientes de firma dentro del cierre.`,
          icon: Signature,
          color: 'text-sky-600',
          priority: 2,
          action: () => navigate(`/properties/${property.id}#expediente`),
        });
      });

    enrichedClosing
      .filter(({ property }) => property.deed_date && !['vendido', 'alquilado'].includes(property.status))
      .sort((left, right) => new Date(left.property.deed_date).getTime() - new Date(right.property.deed_date).getTime())
      .slice(0, 2)
      .forEach(({ property }) => {
        const deedDate = new Date(property.deed_date);
        results.push({
          id: `deed-due-${property.id}`,
          type: 'deed_due',
          title: `${deedDate < now ? '⚠️ Escritura vencida' : '🏛️ Escritura próxima'}: ${property.title || 'inmueble'}`,
          description: `${deedDate < now ? 'La fecha de escritura ya ha pasado.' : `Escritura programada para ${format(deedDate, "dd MMM HH:mm", { locale: es })}.`}`,
          icon: Landmark,
          color: deedDate < now ? 'text-destructive' : 'text-amber-600',
          priority: deedDate < now ? 1 : 4,
          action: () => navigate(`/properties/${property.id}#cierre`),
        });
      });

    enrichedClosing
      .filter(({ blockers }) => blockers.length > 0)
      .slice(0, 3)
      .forEach(({ property, blockers }) => {
        results.push({
          id: `closing-blocked-${property.id}`,
          type: 'closing_blocked',
          title: `📌 Cierre bloqueado: ${property.title || 'inmueble'}`,
          description: blockers[0],
          icon: FileWarning,
          color: 'text-destructive',
          priority: property.legal_risk_level === 'alto' ? 1 : 3,
          action: () => navigate(`/properties/${property.id}#cierre`),
        });
      });

    results.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    setNotifications(results);
    setLoading(false);
  }, [inboundLeads, user, navigate]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const dismiss = (id: string) => setDismissed(prev => new Set([...prev, id]));
  const dismissAll = () => setDismissed(new Set(notifications.map(n => n.id)));

  const visibleNotifications = notifications.filter(n => !dismissed.has(n.id));

  return { notifications, visibleNotifications, dismissed, dismiss, dismissAll, loading };
}
