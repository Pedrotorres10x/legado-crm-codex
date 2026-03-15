import { startOfDay, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export type AgentKpiTargets = {
  ventas_ano: number;
  captaciones_mes: number;
  citas_semana: number;
  toques_horus_dia: number;
};

export type AgentKpiSummary = {
  agentId: string;
  ventasMes: number;
  ventasAno: number;
  captacionesMes: number;
  citasSemana: number;
  toquesHorusHoy: number;
  ofertasActivas: number;
  oportunidadesCalientes: number;
  visitasSinOferta: number;
  targets: AgentKpiTargets;
};

const DEFAULT_KPI_TARGETS: AgentKpiTargets = {
  ventas_ano: 10,
  captaciones_mes: 2,
  citas_semana: 2,
  toques_horus_dia: 4,
};

export const getAgentKpiTargets = async (): Promise<AgentKpiTargets> => {
  const { data } = await supabase.from('settings').select('value').eq('key', 'kpi_targets').maybeSingle();
  const raw = (data?.value as Partial<AgentKpiTargets> | undefined) || {};

  return {
    ventas_ano: raw.ventas_ano ?? DEFAULT_KPI_TARGETS.ventas_ano,
    captaciones_mes: raw.captaciones_mes ?? DEFAULT_KPI_TARGETS.captaciones_mes,
    citas_semana: raw.citas_semana ?? DEFAULT_KPI_TARGETS.citas_semana,
    toques_horus_dia: raw.toques_horus_dia ?? DEFAULT_KPI_TARGETS.toques_horus_dia,
  };
};

export const getAgentKpiSummary = async (
  agentId: string,
  targets?: AgentKpiTargets,
): Promise<AgentKpiSummary> => {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const dayStart = startOfDay(now).toISOString();
  const yearStart = startOfYear(now).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const resolvedTargets = targets || await getAgentKpiTargets();

  const [salesRes, annualSalesRes, capturesRes, captureVisitsRes, touchesRes, activeOffersRes, hotOffersRes, realizedVisitsRes, offerCoverageRes] = await Promise.all([
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'vendido')
      .gte('updated_at', monthStart),
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('status', 'vendido')
      .gte('updated_at', yearStart),
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .gte('created_at', monthStart),
    supabase
      .from('interactions')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('interaction_type', 'visita_tasacion')
      .gte('interaction_date', weekStart)
      .lte('interaction_date', now.toISOString()),
    supabase
      .from('interactions')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .in('interaction_type', ['llamada', 'whatsapp', 'email', 'cafe_comida', 'reunion'])
      .gte('interaction_date', dayStart)
      .lte('interaction_date', now.toISOString()),
    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .in('status', ['pendiente', 'presentada', 'contraoferta']),
    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .in('status', ['aceptada', 'contraoferta']),
    supabase
      .from('visits')
      .select('property_id, contact_id, visit_date')
      .eq('agent_id', agentId)
      .lt('visit_date', threeDaysAgo)
      .or('confirmation_status.eq.confirmado,result.not.is.null')
      .order('visit_date', { ascending: false })
      .limit(40),
    supabase
      .from('offers')
      .select('property_id, contact_id, created_at')
      .eq('agent_id', agentId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(120),
  ]);

  const offerCoverage = new Set(
    (offerCoverageRes.data || [])
      .filter((offer: any) => offer.property_id && offer.contact_id)
      .map((offer: any) => `${offer.property_id}:${offer.contact_id}`),
  );

  const visitsWithoutOffer = new Set(
    (realizedVisitsRes.data || [])
      .filter((visit: any) => visit.property_id && visit.contact_id)
      .map((visit: any) => `${visit.property_id}:${visit.contact_id}`)
      .filter((key: string) => !offerCoverage.has(key)),
  ).size;

  return {
    agentId,
    ventasMes: salesRes.count ?? 0,
    ventasAno: annualSalesRes.count ?? 0,
    captacionesMes: capturesRes.count ?? 0,
    citasSemana: captureVisitsRes.count ?? 0,
    toquesHorusHoy: touchesRes.count ?? 0,
    ofertasActivas: activeOffersRes.count ?? 0,
    oportunidadesCalientes: hotOffersRes.count ?? 0,
    visitasSinOferta: visitsWithoutOffer,
    targets: resolvedTargets,
  };
};

export const getTeamKpiSummaries = async (
  agents: Array<{ user_id: string; full_name: string | null }>,
) => {
  const targets = await getAgentKpiTargets();
  const summaries = await Promise.all(
    agents.map(async (agent) => ({
      ...agent,
      summary: await getAgentKpiSummary(agent.user_id, targets),
    })),
  );

  return { targets, summaries };
};

export const getAnnualTargetToDate = (annualTarget: number, now = new Date()) => {
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  const elapsed = Math.max(now.getTime() - yearStart.getTime(), 0);
  const total = Math.max(yearEnd.getTime() - yearStart.getTime(), 1);

  return Number(((elapsed / total) * annualTarget).toFixed(1));
};
