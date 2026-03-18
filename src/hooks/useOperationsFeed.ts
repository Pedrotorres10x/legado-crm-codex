import { useEffect, useState } from 'react';
import { formatDistanceToNow, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { buildClosingOperationalBlockers } from '@/lib/closing-ops';
import { hasDistributionReady, hasPublishBasics, isAvailablePropertyStock, isMandateExpired } from '@/lib/property-stock-health';

type PropertyRow = {
  id: string;
  title: string;
  city: string | null;
  status: string;
  agent_id: string | null;
  mandate_type?: string | null;
  mandate_end?: string | null;
  xml_id?: string | null;
  source?: string | null;
  price?: number | null;
  images?: string[] | null;
  description?: string | null;
  legal_risk_level: string | null;
  legal_risk_summary: string | null;
  legal_risk_updated_at: string | null;
  reservation_date: string | null;
  reservation_amount: number | null;
  arras_status: string | null;
  arras_date: string | null;
  arras_amount: number | null;
  arras_buyer_id: string | null;
  deed_date: string | null;
  deed_notary: string | null;
  updated_at: string;
};

type TaskRow = {
  id: string;
  title: string;
  created_at: string;
  due_date: string;
  priority: string;
  source: string | null;
  contact_id: string | null;
  property_id: string | null;
  agent_id: string;
  contacts?: { full_name: string } | null;
  properties?: { title: string } | null;
};

type VisitRow = {
  id: string;
  visit_date: string;
  confirmation_status: string | null;
  result: string | null;
  notes?: string | null;
  agent_id: string | null;
  contact_id: string | null;
  property_id: string | null;
  contacts?: { full_name: string } | null;
  properties?: { title: string } | null;
};

type OfferRow = {
  id: string;
  created_at: string;
  updated_at?: string | null;
  amount: number | null;
  counter_amount?: number | null;
  expiry_date?: string | null;
  response_date?: string | null;
  status: string | null;
  agent_id: string | null;
  contact_id: string | null;
  property_id: string | null;
  contacts?: { full_name: string } | null;
  properties?: { title: string } | null;
};

type PostSalePropertyRow = {
  id: string;
  title: string;
  city: string | null;
  status: string;
  agent_id: string | null;
  owner_id?: string | null;
  arras_buyer_id?: string | null;
  updated_at: string;
};

export type OperationsItem = {
  id: string;
  kind: 'legal' | 'closing' | 'signature' | 'deed' | 'postsale' | 'task' | 'visit' | 'offer' | 'lead' | 'stock';
  severity: 'alta' | 'media';
  title: string;
  summary: string;
  meta: string;
  route: string;
  routeLabel: string;
  agentId: string | null;
  updatedAt: string | null;
  createdAt?: string | null;
  secondaryRoute?: string | null;
  secondaryLabel?: string | null;
  taskId?: string | null;
  taskAutomatic?: boolean;
  propertyId?: string | null;
  contactId?: string | null;
  offerId?: string | null;
  offerStatus?: string | null;
  offerAmount?: number | null;
};

type LeadContactRow = {
  id: string;
  full_name: string;
  status: string;
  pipeline_stage: string | null;
  created_at: string;
  updated_at: string;
  agent_id: string | null;
  tags: string[] | null;
};

const AUTO_TASK_SOURCE_LABELS: Record<string, string> = {
  closing_blocked: 'Auto cierre',
  closing_signature_pending: 'Auto firma',
  closing_deed_due: 'Auto escritura',
};

const getAutomaticTaskRoute = (task: Pick<TaskRow, 'source' | 'property_id' | 'contact_id'>) => {
  if (task.property_id && ['closing_blocked', 'closing_signature_pending', 'closing_deed_due'].includes(task.source || '')) {
    return `/properties/${task.property_id}#cierre`;
  }

  if (task.contact_id) {
    return `/contacts/${task.contact_id}`;
  }

  return '/tasks';
};

const formatMoney = (amount: number | null | undefined) => {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return 'Importe pendiente';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const useOperationsFeed = ({
  userId,
  canViewAll,
  selectedAgentId,
  refreshToken,
}: {
  userId?: string;
  canViewAll: boolean;
  selectedAgentId: string;
  refreshToken: number;
}) => {
  const [items, setItems] = useState<OperationsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchOperations = async () => {
      if (!userId) return;

      setLoading(true);

      const agentScope = canViewAll ? (selectedAgentId === 'all' ? null : selectedAgentId) : userId;

      let legalQuery = supabase
        .from('properties')
        .select('id, title, city, status, agent_id, mandate_type, mandate_end, xml_id, source, price, images, description, legal_risk_level, legal_risk_summary, legal_risk_updated_at, reservation_date, reservation_amount, arras_status, arras_date, arras_amount, arras_buyer_id, deed_date, deed_notary, updated_at')
        .in('legal_risk_level', ['alto', 'medio', 'sin_datos'])
        .order('legal_risk_updated_at', { ascending: true, nullsFirst: true })
        .limit(10);

      let closingQuery = supabase
        .from('properties')
        .select('id, title, city, status, agent_id, mandate_type, mandate_end, xml_id, source, price, images, description, legal_risk_level, legal_risk_summary, legal_risk_updated_at, reservation_date, reservation_amount, arras_status, arras_date, arras_amount, arras_buyer_id, deed_date, deed_notary, updated_at')
        .or('reservation_date.not.is.null,arras_status.neq.sin_arras,deed_date.not.is.null,status.eq.arras,status.eq.reservado')
        .order('updated_at', { ascending: false })
        .limit(12);

      let tasksQuery = supabase
        .from('tasks')
        .select('id, title, created_at, due_date, priority, source, contact_id, property_id, agent_id, contacts(full_name), properties(title)')
        .eq('completed', false)
        .lt('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(12);

      let visitsQuery = supabase
        .from('visits')
        .select('id, visit_date, confirmation_status, result, notes, agent_id, contact_id, property_id, contacts(full_name), properties(title)')
        .or(`confirmation_status.eq.pendiente,and(visit_date.lt.${new Date().toISOString()},result.is.null)`)
        .order('visit_date', { ascending: true })
        .limit(12);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      let realizedVisitsQuery = supabase
        .from('visits')
        .select('id, visit_date, confirmation_status, result, notes, agent_id, contact_id, property_id, contacts(full_name), properties(title)')
        .lt('visit_date', threeDaysAgo)
        .or('confirmation_status.eq.confirmado,result.not.is.null')
        .order('visit_date', { ascending: false })
        .limit(18);

      let offersQuery = supabase
        .from('offers')
        .select('id, created_at, updated_at, amount, counter_amount, expiry_date, response_date, status, agent_id, contact_id, property_id, contacts(full_name), properties(title)')
        .in('status', ['pendiente', 'presentada', 'contraoferta', 'aceptada'])
        .order('updated_at', { ascending: false })
        .limit(12);

      let inboundLeadsQuery = supabase
        .from('contacts')
        .select('id, full_name, status, pipeline_stage, created_at, updated_at, agent_id, tags')
        .or('tags.cs.{web-lead},tags.cs.{portal-lead},tags.cs.{fb-lead-ads}')
        .order('created_at', { ascending: false })
        .limit(40);

      let postSaleQuery = supabase
        .from('properties')
        .select('id, title, city, status, agent_id, owner_id, arras_buyer_id, updated_at')
        .in('status', ['vendido', 'alquilado'])
        .order('updated_at', { ascending: false });

      let offerCoverageQuery = supabase
        .from('offers')
        .select('id, created_at, contact_id, property_id, agent_id')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(100);

      if (agentScope) {
        legalQuery = legalQuery.eq('agent_id', agentScope);
        closingQuery = closingQuery.eq('agent_id', agentScope);
        tasksQuery = tasksQuery.eq('agent_id', agentScope);
        visitsQuery = visitsQuery.eq('agent_id', agentScope);
        realizedVisitsQuery = realizedVisitsQuery.eq('agent_id', agentScope);
        offersQuery = offersQuery.eq('agent_id', agentScope);
        offerCoverageQuery = offerCoverageQuery.eq('agent_id', agentScope);
        inboundLeadsQuery = inboundLeadsQuery.eq('agent_id', agentScope);
        postSaleQuery = postSaleQuery.eq('agent_id', agentScope);
      }

      const [
        { data: legalProperties },
        { data: closingProperties },
        { data: overdueTasks },
        { data: staleVisits },
        { data: realizedVisits },
        { data: activeOffers },
        { data: offerCoverage },
        { data: inboundLeads },
        { data: postSaleProperties },
      ] = await Promise.all([
        legalQuery,
        closingQuery,
        tasksQuery,
        visitsQuery,
        realizedVisitsQuery,
        offersQuery,
        offerCoverageQuery,
        inboundLeadsQuery,
        postSaleQuery,
      ]);

      const closingRows = (closingProperties || []) as PropertyRow[];
      const legalRows = (legalProperties || []) as PropertyRow[];
      const taskRows = (overdueTasks || []) as unknown as TaskRow[];
      const visitRows = (staleVisits || []) as unknown as VisitRow[];
      const realizedVisitRows = (realizedVisits || []) as unknown as VisitRow[];
      const offerRows = (activeOffers || []) as unknown as OfferRow[];
      const offerCoverageRows = (offerCoverage || []) as Array<Pick<OfferRow, 'created_at' | 'contact_id' | 'property_id'>>;
      const inboundLeadRows = (inboundLeads || []) as LeadContactRow[];
      const postSaleRows = (postSaleProperties || []) as PostSalePropertyRow[];

      const inboundLeadIds = inboundLeadRows.map((lead) => lead.id);
      const [leadTasksRes, leadVisitsRes, leadOffersRes, leadInteractionsRes] = inboundLeadIds.length > 0
        ? await Promise.all([
            supabase.from('tasks').select('contact_id, completed').in('contact_id', inboundLeadIds),
            supabase.from('visits').select('contact_id').in('contact_id', inboundLeadIds),
            supabase.from('offers').select('contact_id').in('contact_id', inboundLeadIds),
            supabase.from('interactions').select('contact_id, interaction_date').in('contact_id', inboundLeadIds).order('interaction_date', { ascending: false }),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

      const leadTasksMap = new Map<string, number>();
      for (const task of (leadTasksRes.data || []) as Array<{ contact_id: string; completed: boolean | null }>) {
        if (task.completed) continue;
        leadTasksMap.set(task.contact_id, (leadTasksMap.get(task.contact_id) || 0) + 1);
      }

      const leadVisitsMap = new Map<string, number>();
      for (const visit of (leadVisitsRes.data || []) as Array<{ contact_id: string }>) {
        leadVisitsMap.set(visit.contact_id, (leadVisitsMap.get(visit.contact_id) || 0) + 1);
      }

      const leadOffersMap = new Map<string, number>();
      for (const offer of (leadOffersRes.data || []) as Array<{ contact_id: string }>) {
        leadOffersMap.set(offer.contact_id, (leadOffersMap.get(offer.contact_id) || 0) + 1);
      }

      const leadInteractionMap = new Map<string, string>();
      for (const interaction of (leadInteractionsRes.data || []) as Array<{ contact_id: string; interaction_date: string }>) {
        if (!leadInteractionMap.has(interaction.contact_id)) {
          leadInteractionMap.set(interaction.contact_id, interaction.interaction_date);
        }
      }

      const closingAnalyses = await Promise.all(closingRows.map(async (property) => {
        const [docsRes, signaturesRes, ownersRes] = await Promise.all([
          supabase.from('property_documents').select('doc_type').eq('property_id', property.id),
          supabase
            .from('documents')
            .select('generated_contracts(signature_status), document_properties!inner(property_id)')
            .eq('document_properties.property_id', property.id),
          supabase.from('property_owners').select('id', { count: 'exact', head: true }).eq('property_id', property.id),
        ]);

        const uploadedDocTypes = Array.from(new Set((docsRes.data || []).map((doc: any) => doc.doc_type).filter(Boolean)));
        const pendingSignatureCount = (signaturesRes.data || [])
          .filter((doc: any) => doc.generated_contracts?.signature_status === 'pendiente')
          .length;
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

      const nextItems: OperationsItem[] = [];

      for (const property of legalRows) {
        const severity = property.legal_risk_level === 'alto' ? 'alta' : 'media';
        const riskLabel = property.legal_risk_level === 'alto'
          ? 'Riesgo alto'
          : property.legal_risk_level === 'medio'
            ? 'Riesgo medio'
            : 'Sin analisis';

        nextItems.push({
          id: `legal-${property.id}`,
          kind: 'legal',
          severity,
          title: `${riskLabel}: ${property.title || 'Inmueble'}`,
          summary: property.legal_risk_summary || 'Pendiente de revisar nota simple, escritura o catastro.',
          meta: [property.city, property.status].filter(Boolean).join(' · ') || 'Expediente legal',
          route: `/properties/${property.id}#expediente`,
          routeLabel: property.legal_risk_level === 'sin_datos' ? 'Analizar expediente' : 'Abrir expediente',
          secondaryRoute: `/properties/${property.id}`,
          secondaryLabel: 'Ficha',
          agentId: property.agent_id,
          updatedAt: property.legal_risk_updated_at || property.updated_at,
          propertyId: property.id,
        });
      }

      const stockRows = [...new Map([...legalRows, ...closingRows].map((property) => [property.id, property])).values()]
        .filter((property) => isAvailablePropertyStock(property as any));

      for (const property of stockRows) {
        if (isMandateExpired(property as any)) {
          nextItems.push({
            id: `stock-mandate-${property.id}`,
            kind: 'stock',
            severity: 'alta',
            title: `Mandato vencido: ${property.title || 'Inmueble'}`,
            summary: 'El inmueble sigue disponible pero el mandato ya ha vencido. Conviene renovar o redefinir salida comercial.',
            meta: [property.city, property.mandate_type || 'Sin mandato'].filter(Boolean).join(' · ') || 'Stock activo',
            route: `/properties/${property.id}#mandato`,
            routeLabel: 'Renovar mandato',
            secondaryRoute: `/properties/${property.id}#expediente`,
            secondaryLabel: 'Expediente',
            agentId: property.agent_id,
            updatedAt: property.mandate_end || property.updated_at,
            propertyId: property.id,
          });
        }

        if (!hasPublishBasics(property as any)) {
          nextItems.push({
            id: `stock-publish-${property.id}`,
            kind: 'stock',
            severity: 'media',
            title: `Ficha floja: ${property.title || 'Inmueble'}`,
            summary: 'Faltan básicos de publicación como precio, fotos o descripción consistente para mover mejor este stock.',
            meta: [property.city, hasDistributionReady(property as any) ? 'Feed activo' : 'Sin feed'].filter(Boolean).join(' · ') || 'Stock publicable',
            route: `/properties/${property.id}#ficha`,
            routeLabel: 'Completar ficha',
            secondaryRoute: `/properties/${property.id}#fotos`,
            secondaryLabel: 'Subir fotos',
            agentId: property.agent_id,
            updatedAt: property.updated_at,
            propertyId: property.id,
          });
        }

        if (hasPublishBasics(property as any) && !hasDistributionReady(property as any)) {
          nextItems.push({
            id: `stock-distribution-${property.id}`,
            kind: 'stock',
            severity: 'media',
            title: `Sin difusión: ${property.title || 'Inmueble'}`,
            summary: 'La ficha ya está lista para publicar, pero aún no tiene feed activo.',
            meta: [property.city, 'Publicación pendiente'].filter(Boolean).join(' · ') || 'Stock publicable',
            route: `/properties/${property.id}#publicacion`,
            routeLabel: 'Activar difusión',
            secondaryRoute: `/properties/${property.id}#ficha`,
            secondaryLabel: 'Ficha',
            agentId: property.agent_id,
            updatedAt: property.updated_at,
            propertyId: property.id,
          });
        }
      }

      if (postSaleRows.length > 0) {
        const propertyIds = postSaleRows.map((property) => property.id);
        const [{ data: commissionRows }, { data: invoiceRows }] = await Promise.all([
          supabase
            .from('commissions')
            .select('property_id, status, agency_commission')
            .in('property_id', propertyIds),
          supabase
            .from('contact_invoices')
            .select('property_id, status, amount')
            .in('property_id', propertyIds),
        ]);

        const commissionMap = new Map<string, { status?: string | null; agency_commission?: number | null }>();
        for (const row of (commissionRows || []) as Array<{ property_id: string; status?: string | null; agency_commission?: number | null }>) {
          if (!commissionMap.has(row.property_id)) {
            commissionMap.set(row.property_id, row);
          }
        }

        const invoiceMap = new Map<string, Array<{ status?: string | null; amount?: number | null }>>();
        for (const row of (invoiceRows || []) as Array<{ property_id: string; status?: string | null; amount?: number | null }>) {
          const current = invoiceMap.get(row.property_id) || [];
          current.push(row);
          invoiceMap.set(row.property_id, current);
        }

        for (const property of postSaleRows) {
          const invoices = invoiceMap.get(property.id) || [];
          const pendingInvoices = invoices.filter((invoice) => !['pagada', 'cobrada', 'abonada'].includes((invoice.status || '').toLowerCase()));
          const commission = commissionMap.get(property.id);
          const billingContactId = property.arras_buyer_id || property.owner_id || null;

          if (!commission || invoices.length === 0 || pendingInvoices.length > 0) {
            nextItems.push({
              id: `postsale-${property.id}`,
              kind: 'postsale',
              severity: !commission || invoices.length === 0 ? 'alta' : 'media',
              title: `Postventa pendiente: ${property.title || 'Inmueble'}`,
              summary: !commission
                ? 'La operación está cerrada, pero todavía no hay comisión registrada.'
                : invoices.length === 0
                  ? 'La operación está cerrada, pero falta generar la facturación final.'
                  : `${pendingInvoices.length} factura(s) siguen abiertas o pendientes de cobro.`,
              meta: [property.city, property.status].filter(Boolean).join(' · ') || 'Postventa',
              route: `/properties/${property.id}#cierre`,
              routeLabel: 'Revisar postventa',
              secondaryRoute: billingContactId ? `/contacts/${billingContactId}` : `/properties/${property.id}`,
              secondaryLabel: billingContactId ? 'Abrir Faktura' : 'Ficha',
              agentId: property.agent_id,
              updatedAt: property.updated_at,
              propertyId: property.id,
              contactId: billingContactId,
            });
          }
        }
      }

      for (const { property, pendingSignatureCount, blockers } of closingAnalyses) {
        if (blockers.length > 0) {
          nextItems.push({
            id: `closing-${property.id}`,
            kind: 'closing',
            severity: property.legal_risk_level === 'alto' ? 'alta' : 'media',
            title: `Cierre bloqueado: ${property.title || 'Inmueble'}`,
            summary: blockers[0],
            meta: [property.city, property.status].filter(Boolean).join(' · ') || 'Operacion en curso',
            route: `/properties/${property.id}#cierre`,
            routeLabel: 'Ir a cierre',
            secondaryRoute: property.arras_buyer_id ? `/contacts/${property.arras_buyer_id}` : `/properties/${property.id}#expediente`,
            secondaryLabel: property.arras_buyer_id ? 'Comprador' : 'Expediente',
            agentId: property.agent_id,
            updatedAt: property.updated_at,
            propertyId: property.id,
            contactId: property.arras_buyer_id,
          });
        }

        if (pendingSignatureCount > 0) {
          nextItems.push({
            id: `signature-${property.id}`,
            kind: 'signature',
            severity: pendingSignatureCount > 1 ? 'alta' : 'media',
            title: `Firma pendiente: ${property.title || 'Inmueble'}`,
            summary: `${pendingSignatureCount} documento(s) del cierre siguen pendientes de firma.`,
            meta: [property.city, property.status].filter(Boolean).join(' · ') || 'Firma transaccional',
            route: `/properties/${property.id}#expediente`,
            routeLabel: 'Ver firmas',
            secondaryRoute: `/properties/${property.id}#cierre`,
            secondaryLabel: 'Cierre',
            agentId: property.agent_id,
            updatedAt: property.updated_at,
            propertyId: property.id,
          });
        }

        if (property.deed_date && !['vendido', 'alquilado'].includes(property.status)) {
          const deedDate = new Date(property.deed_date);
          const isOverdue = isPast(deedDate) && !isToday(deedDate);

          nextItems.push({
            id: `deed-${property.id}`,
            kind: 'deed',
            severity: isOverdue ? 'alta' : 'media',
            title: `${isOverdue ? 'Escritura vencida' : 'Escritura proxima'}: ${property.title || 'Inmueble'}`,
            summary: isOverdue
              ? 'La fecha de escritura ya ha pasado y la operacion sigue abierta.'
              : `Escritura prevista ${formatDistanceToNow(deedDate, { addSuffix: true, locale: es })}.`,
            meta: [property.city, property.status].filter(Boolean).join(' · ') || 'Cierre en notaria',
            route: `/properties/${property.id}#cierre`,
            routeLabel: 'Revisar escritura',
            secondaryRoute: `/properties/${property.id}#expediente`,
            secondaryLabel: 'Expediente',
            agentId: property.agent_id,
            updatedAt: property.deed_date,
            propertyId: property.id,
          });
        }
      }

      for (const task of taskRows) {
        const automatic = task.source && task.source !== 'manual';
        const scopeLabel = automatic
          ? AUTO_TASK_SOURCE_LABELS[task.source || ''] || 'Automatica'
          : 'Manual';

        nextItems.push({
          id: `task-${task.id}`,
          kind: 'task',
          severity: task.priority === 'alta' ? 'alta' : 'media',
          title: `${scopeLabel}: ${task.title}`,
          summary: task.properties?.title
            ? `Relacionado con ${task.properties.title}.`
            : task.contacts?.full_name
              ? `Relacionado con ${task.contacts.full_name}.`
              : 'Seguimiento pendiente fuera de plazo.',
          meta: `Vencida ${formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: es })}`,
          route: automatic ? getAutomaticTaskRoute(task) : '/tasks',
          routeLabel: automatic ? 'Abrir origen' : 'Abrir tareas',
          secondaryRoute: task.contact_id
            ? `/contacts/${task.contact_id}`
            : task.property_id
              ? `/properties/${task.property_id}`
              : null,
          secondaryLabel: task.contact_id ? 'Contacto' : task.property_id ? 'Inmueble' : null,
          agentId: task.agent_id,
          updatedAt: task.due_date,
          createdAt: task.created_at,
          taskId: task.id,
          taskAutomatic: Boolean(automatic),
          propertyId: task.property_id,
          contactId: task.contact_id,
        });
      }

      for (const visit of visitRows) {
        const pendingConfirmation = visit.confirmation_status === 'pendiente';
        const visitDate = new Date(visit.visit_date);
        const propertyTitle = visit.properties?.title || 'Inmueble';
        const contactName = visit.contacts?.full_name || 'contacto';

        nextItems.push({
          id: `visit-${visit.id}`,
          kind: 'visit',
          severity: pendingConfirmation ? 'media' : 'alta',
          title: pendingConfirmation
            ? `Visita por confirmar: ${propertyTitle}`
            : `Visita sin feedback: ${propertyTitle}`,
          summary: pendingConfirmation
            ? `Falta confirmar con ${contactName} la visita prevista ${formatDistanceToNow(visitDate, { addSuffix: true, locale: es })}.`
            : `La visita con ${contactName} ya pasó y sigue sin resultado registrado.`,
          meta: pendingConfirmation
            ? 'Agenda comercial'
            : `Pendiente desde ${formatDistanceToNow(visitDate, { addSuffix: true, locale: es })}`,
          route: visit.property_id ? `/properties/${visit.property_id}` : '/matches',
          routeLabel: visit.property_id ? 'Abrir inmueble' : 'Ir a cruces',
          secondaryRoute: visit.contact_id ? `/contacts/${visit.contact_id}` : '/matches',
          secondaryLabel: visit.contact_id ? 'Contacto' : 'Cruces',
          agentId: visit.agent_id,
          updatedAt: visit.visit_date,
          propertyId: visit.property_id,
          contactId: visit.contact_id,
        });
      }

      const offerCoverageSet = new Set(
        offerCoverageRows
          .filter((offer) => offer.property_id && offer.contact_id)
          .map((offer) => `${offer.property_id}:${offer.contact_id}`),
      );

      for (const visit of realizedVisitRows) {
        if (!visit.property_id || !visit.contact_id) continue;
        const coverageKey = `${visit.property_id}:${visit.contact_id}`;
        if (offerCoverageSet.has(coverageKey)) continue;

        const visitDate = new Date(visit.visit_date);
        const propertyTitle = visit.properties?.title || 'Inmueble';
        const contactName = visit.contacts?.full_name || 'contacto';

        nextItems.push({
          id: `visit-followup-${visit.id}`,
          kind: 'visit',
          severity: 'media',
          title: `Visita realizada sin oferta: ${propertyTitle}`,
          summary: `${contactName} ya visitó el inmueble y siguen sin registrarse oferta ni siguiente paso comercial claro.`,
          meta: `Visita ${formatDistanceToNow(visitDate, { addSuffix: true, locale: es })}`,
          route: '/matches',
          routeLabel: 'Mover negociacion',
          secondaryRoute: `/contacts/${visit.contact_id}`,
          secondaryLabel: 'Contacto',
          agentId: visit.agent_id,
          updatedAt: visit.visit_date,
          propertyId: visit.property_id,
          contactId: visit.contact_id,
        });
      }

      for (const offer of offerRows) {
        const offerStatus = offer.status || 'pendiente';
        const propertyTitle = offer.properties?.title || 'Inmueble';
        const contactName = offer.contacts?.full_name || 'contacto';
        const amountText = formatMoney(offer.amount);
        const counterAmountText = formatMoney(offer.counter_amount);
        const expiryDate = offer.expiry_date ? new Date(offer.expiry_date) : null;
        const expirySoon = expiryDate
          ? expiryDate.getTime() - Date.now() <= 48 * 60 * 60 * 1000
          : false;
        const expiryPassed = expiryDate ? expiryDate.getTime() < Date.now() : false;

        let title = offerStatus === 'contraoferta'
          ? `Contraoferta activa: ${propertyTitle}`
          : offerStatus === 'aceptada'
            ? `Oferta aceptada: ${propertyTitle}`
            : `Oferta pendiente: ${propertyTitle}`;

        let summary = offerStatus === 'contraoferta'
          ? `${contactName} tiene una contraoferta abierta. Último importe base: ${amountText}.`
          : offerStatus === 'aceptada'
            ? `${contactName} ya tiene una oferta aceptada por ${amountText}. Conviene empujar reserva o arras.`
            : `${contactName} mantiene una oferta en curso por ${amountText}.`;

        let meta = offerStatus === 'contraoferta'
          ? 'Negociacion activa'
          : offerStatus === 'aceptada'
            ? 'Operacion caliente'
            : 'Oferta pendiente de respuesta';

        let severity: OperationsItem['severity'] = offerStatus === 'aceptada' || offerStatus === 'contraoferta'
          ? 'alta'
          : 'media';

        if (offerStatus === 'contraoferta' && expiryDate) {
          title = `${expiryPassed ? 'Contraoferta vencida' : expirySoon ? 'Contraoferta venciendo' : 'Contraoferta activa'}: ${propertyTitle}`;
          summary = expiryPassed
            ? `${contactName} tenía una contraoferta por ${counterAmountText} y la fecha límite ya pasó.`
            : `${contactName} tiene una contraoferta por ${counterAmountText} ${formatDistanceToNow(expiryDate, { addSuffix: true, locale: es })}.`;
          meta = expiryPassed || expirySoon ? 'Negociacion urgente' : 'Negociacion activa';
          severity = 'alta';
        }

        nextItems.push({
          id: `offer-${offer.id}`,
          kind: 'offer',
          severity,
          title,
          summary,
          meta,
          route: offerStatus === 'aceptada' && offer.property_id ? `/properties/${offer.property_id}#cierre` : '/matches',
          routeLabel: offerStatus === 'aceptada' && offer.property_id ? 'Empujar cierre' : 'Ir a cruces',
          secondaryRoute: offer.contact_id
            ? `/contacts/${offer.contact_id}`
            : offer.property_id
              ? `/properties/${offer.property_id}`
              : null,
          secondaryLabel: offer.contact_id ? 'Contacto' : offer.property_id ? 'Inmueble' : null,
          agentId: offer.agent_id,
          updatedAt: offer.updated_at || offer.created_at,
          propertyId: offer.property_id,
          contactId: offer.contact_id,
          offerId: offer.id,
          offerStatus,
          offerAmount: offer.amount,
        });
      }

      for (const lead of inboundLeadRows) {
        const openTasks = leadTasksMap.get(lead.id) || 0;
        const visits = leadVisitsMap.get(lead.id) || 0;
        const offers = leadOffersMap.get(lead.id) || 0;
        const latestInteraction = leadInteractionMap.get(lead.id) || null;
        const staleSince = latestInteraction || lead.created_at;
        const needsFollowUp =
          openTasks === 0 &&
          visits === 0 &&
          offers === 0 &&
          (!lead.pipeline_stage || ['nuevo', 'contactado'].includes(lead.pipeline_stage));

        if (!needsFollowUp) continue;

        const sourceLabel = lead.tags?.includes('fb-lead-ads')
          ? 'FB Ads'
          : lead.tags?.includes('portal-lead')
            ? 'Portal'
            : 'Web';

        nextItems.push({
          id: `lead-${lead.id}`,
          kind: 'lead',
          severity: lead.status === 'nuevo' || lead.pipeline_stage === 'nuevo' ? 'alta' : 'media',
          title: `Lead sin seguimiento: ${lead.full_name}`,
          summary: 'Lead inbound sin tarea, visita ni oferta registrada. Conviene convertirlo ya en seguimiento operativo.',
          meta: `${sourceLabel} · ${lead.status}${latestInteraction ? ` · última interacción ${formatDistanceToNow(new Date(staleSince), { addSuffix: true, locale: es })}` : ''}`,
          route: `/contacts/${lead.id}`,
          routeLabel: 'Abrir contacto',
          secondaryRoute: '/web-leads',
          secondaryLabel: 'WebLeads',
          agentId: lead.agent_id,
          updatedAt: staleSince,
          contactId: lead.id,
        });
      }

      const severityWeight = { alta: 0, media: 1 };
      const kindWeight = { closing: 0, signature: 1, deed: 2, offer: 3, visit: 4, lead: 5, legal: 6, task: 7 };

      nextItems.sort((left, right) => {
        const severityDiff = severityWeight[left.severity] - severityWeight[right.severity];
        if (severityDiff !== 0) return severityDiff;

        const kindDiff = kindWeight[left.kind] - kindWeight[right.kind];
        if (kindDiff !== 0) return kindDiff;

        return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
      });

      if (cancelled) return;

      setItems(nextItems);
      setLoading(false);
    };

    fetchOperations();

    return () => {
      cancelled = true;
    };
  }, [canViewAll, refreshToken, selectedAgentId, userId]);

  return {
    items,
    setItems,
    loading,
  };
};
