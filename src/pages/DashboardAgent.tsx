import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Building2, Users, Search, Handshake, TrendingUp, MessageCircle, Target, Home, CalendarCheck, Euro, Globe, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfMonth, startOfWeek } from 'date-fns';
import { getAgentTier, getNextTierLabel, getSemesterRange, fmt as fmtCurrency } from '@/lib/commissions';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import TodayPriorities from '@/components/dashboard/TodayPriorities';
import RecentActivity from '@/components/dashboard/RecentActivity';
import UpcomingVisits from '@/components/dashboard/UpcomingVisits';
import GoogleCalendarEmbed from '@/components/GoogleCalendarEmbed';
import EcosystemHealth from '@/components/dashboard/EcosystemHealth';
import PipelineVelocity from '@/components/dashboard/PipelineVelocity';
import DashboardNotifications from '@/components/DashboardNotifications';
import { getAgentKpiSummary, getAgentKpiTargets, getAnnualTargetToDate } from '@/lib/agent-kpis';
import { useWebLeads } from '@/hooks/useWebLeadsData';
import { buildTopReasons, extractMatchDiscardReason, extractOfferLossReason, getCommercialSuggestion } from '@/lib/commercial-loss-reasons';
import { getAgentAutonomyStatus, getAgentCommercialFocus } from '@/lib/property-stock-health';
import AgentCommercialFocusCard from '@/components/dashboard/AgentCommercialFocusCard';
import { getAgentDailyPlaybook } from '@/lib/agent-daily-playbook';
import { useWorkspacePersona } from '@/hooks/useWorkspacePersona';
import { useAgentInfluenceCircle } from '@/hooks/useAgentInfluenceCircle';

const DashboardAgent = () => {
  const { user, canViewAll } = useAuth();
  const { isAgentMode } = useWorkspacePersona(canViewAll);
  const { data: inboundLeads = [] } = useWebLeads();
  const { summary: influenceCircle } = useAgentInfluenceCircle(user?.id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({ properties: 0, contacts: 0, demands: 0, matches: 0, available: 0, sold: 0 });
  const [pendingMatches, setPendingMatches] = useState(0);
  const [kpis, setKpis] = useState({
    ventasMes: 0,
    ventasAno: 0,
    captacionesMes: 0,
    citasSemana: 0,
    toquesHorusHoy: 0,
    ofertasActivas: 0,
    oportunidadesCalientes: 0,
    visitasSinOferta: 0,
  });
  const [kpiTargets, setKpiTargets] = useState({ ventas_ano: 10, captaciones_mes: 2, citas_semana: 2, toques_horus_dia: 4 });
  const [earnings, setEarnings] = useState({ month: 0, semester: 0, originatedAccumulated: 0 });
  const [commercialFriction, setCommercialFriction] = useState<{ match: string | null; offer: string | null }>({
    match: null,
    offer: null,
  });
  

  useEffect(() => {
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();
    const semester = getSemesterRange();
    const semesterStart = semester.start.toISOString();

    const fetchStats = async () => {
      const uid = user?.id;

      let propsQuery = supabase.from('properties').select('id, status');
      let contactsQuery = supabase.from('contacts').select('id', { count: 'exact', head: true });
      let matchesQuery = supabase.from('matches').select('id', { count: 'exact', head: true });
      let pendingQuery = supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'pendiente');
      let commMonthQuery = supabase.from('commissions').select('agent_total').gte('created_at', monthStart);
      let commYearQuery = supabase
        .from('commissions')
        .select('agent_total, agency_commission, listing_origin_agent_id, buying_origin_agent_id')
        .gte('created_at', semesterStart);
      let demandsQuery = supabase.from('demands').select('id, contacts!inner(agent_id)', { count: 'exact', head: true });

      // Admin/coordinadora see all office data; agents see only their own
      if (uid && !canViewAll) {
        propsQuery = propsQuery.eq('agent_id', uid);
        contactsQuery = contactsQuery.eq('agent_id', uid);
        matchesQuery = matchesQuery.eq('agent_id', uid);
        pendingQuery = pendingQuery.eq('agent_id', uid);
        commMonthQuery = commMonthQuery.eq('agent_id', uid);
        commYearQuery = commYearQuery.eq('agent_id', uid);
        demandsQuery = (demandsQuery as any).eq('contacts.agent_id', uid);
      }

      const [props, contacts, demands, matches, pending, commMonth, commYear, matchLosses, offerLosses] = await Promise.all([
        propsQuery, contactsQuery, demandsQuery, matchesQuery, pendingQuery,
        commMonthQuery, commYearQuery,
        supabase
          .from('matches')
          .select('notes')
          .eq('status', 'descartado')
          .eq('agent_id', uid),
        supabase
          .from('offers')
          .select('notes')
          .in('status', ['rechazada', 'retirada', 'expirada'])
          .eq('agent_id', uid),
      ]);

      const resolvedTargets = await getAgentKpiTargets();
      setKpiTargets(resolvedTargets);

      const propData = props.data || [];
      setPendingMatches(pending.count || 0);
      setStats({
        properties: propData.length, contacts: contacts.count || 0,
        demands: demands.count || 0, matches: matches.count || 0,
        available: propData.filter(p => p.status === 'disponible').length,
        sold: propData.filter(p => p.status === 'vendido').length,
      });
      if (uid) {
        const summary = await getAgentKpiSummary(uid, resolvedTargets);
        setKpis({
          ventasMes: summary.ventasMes,
          ventasAno: summary.ventasAno,
          captacionesMes: summary.captacionesMes,
          citasSemana: summary.citasSemana,
          toquesHorusHoy: summary.toquesHorusHoy,
          ofertasActivas: summary.ofertasActivas,
          oportunidadesCalientes: summary.oportunidadesCalientes,
          visitasSinOferta: summary.visitasSinOferta,
        });
      }
      const topMatchReason = buildTopReasons((matchLosses.data || []).map((row: any) => extractMatchDiscardReason(row.notes)))[0]?.[0] || null;
      const topOfferReason = buildTopReasons((offerLosses.data || []).map((row: any) => extractOfferLossReason(row.notes)))[0]?.[0] || null;
      setCommercialFriction({ match: topMatchReason, offer: topOfferReason });
      setEarnings({
        month: ((commMonth.data as any[]) || []).reduce((s: number, r: any) => s + (r.agent_total || 0), 0),
        semester: ((commYear.data as any[]) || []).reduce((s: number, r: any) => s + (r.agent_total || 0), 0),
        originatedAccumulated: ((commYear.data as any[]) || [])
          .filter((row: any) => row.listing_origin_agent_id === uid || row.buying_origin_agent_id === uid)
          .reduce((s: number, r: any) => s + (r.agency_commission || 0), 0),
      });
    };


    fetchStats();
  }, [user?.id, canViewAll]);

  const inboundSinTrabajar = useMemo(() => {
    if (canViewAll) return inboundLeads.filter((lead) => lead.needs_follow_up).length;
    if (!user?.id) return 0;
    return inboundLeads.filter((lead) => lead.agent_id === user.id && lead.needs_follow_up).length;
  }, [canViewAll, inboundLeads, user?.id]);

  const tier = useMemo(() => getAgentTier(earnings.originatedAccumulated), [earnings.originatedAccumulated]);
  const nextTierLabel = useMemo(() => getNextTierLabel(tier.next), [tier.next]);

  const recommendedTouchTarget = useMemo(
    () => Math.max(kpiTargets.toques_horus_dia, influenceCircle?.recommendedDailyTouches || 0),
    [influenceCircle?.recommendedDailyTouches, kpiTargets.toques_horus_dia],
  );

  const commercialFocus = useMemo(
    () =>
      getAgentCommercialFocus({
        availableCount: stats.available,
        activeOffers: kpis.ofertasActivas,
        hotOpportunities: kpis.oportunidadesCalientes,
        visitsWithoutOffer: kpis.visitasSinOferta,
      }),
    [kpis.ofertasActivas, kpis.oportunidadesCalientes, kpis.visitasSinOferta, stats.available],
  );

  const autonomyStatus = useMemo(
    () =>
      getAgentAutonomyStatus({
        focus: commercialFocus.focus,
        availableCount: stats.available,
        activeOffers: kpis.ofertasActivas,
        hotOpportunities: kpis.oportunidadesCalientes,
        visitsWithoutOffer: kpis.visitasSinOferta,
        touchesToday: kpis.toquesHorusHoy,
        touchTarget: recommendedTouchTarget,
        captureVisitsWeek: kpis.citasSemana,
        captureVisitsTarget: kpiTargets.citas_semana,
        capturesMonth: kpis.captacionesMes,
        capturesTarget: kpiTargets.captaciones_mes,
      }),
    [
      commercialFocus.focus,
      kpiTargets.captaciones_mes,
      kpiTargets.citas_semana,
      kpis.captacionesMes,
      kpis.citasSemana,
      kpis.ofertasActivas,
      kpis.oportunidadesCalientes,
      kpis.toquesHorusHoy,
      kpis.visitasSinOferta,
      recommendedTouchTarget,
      stats.available,
    ],
  );

  const dailyPlaybook = useMemo(
    () =>
      getAgentDailyPlaybook({
        focus: commercialFocus,
        autonomy: autonomyStatus,
        touchesToday: kpis.toquesHorusHoy,
        touchTarget: recommendedTouchTarget,
        captureVisitsWeek: kpis.citasSemana,
        captureVisitsTarget: kpiTargets.citas_semana,
        capturesMonth: kpis.captacionesMes,
        capturesTarget: kpiTargets.captaciones_mes,
        activeOffers: kpis.ofertasActivas,
        visitsWithoutOffer: kpis.visitasSinOferta,
        inboundPending: inboundSinTrabajar,
        annualSalesTarget: kpiTargets.ventas_ano,
      }),
    [
      autonomyStatus,
      commercialFocus,
      inboundSinTrabajar,
      kpiTargets.captaciones_mes,
      kpiTargets.citas_semana,
      kpis.captacionesMes,
      kpis.citasSemana,
      kpis.ofertasActivas,
      kpis.toquesHorusHoy,
      kpis.visitasSinOferta,
      recommendedTouchTarget,
    ],
  );

  const cards = [
    { title: 'Inmuebles', value: stats.properties, icon: Building2, description: `${stats.available} disponibles · ${stats.sold} vendidos`, color: 'primary' as const },
    { title: 'Contactos', value: stats.contacts, icon: Users, description: 'Prospectos, propietarios y compradores', color: 'accent' as const },
    { title: 'Demandas Activas', value: stats.demands, icon: Search, description: 'Búsquedas registradas', color: 'info' as const },
    { title: 'Cruces Pendientes', value: pendingMatches, icon: Handshake, description: `${stats.matches} matches totales · por revisar`, color: 'warning' as const },
  ];

  const colorMap = {
    primary: { bg: 'bg-primary/8', text: 'text-primary', ring: 'ring-primary/20' },
    accent: { bg: 'bg-accent/8', text: 'text-accent', ring: 'ring-accent/20' },
    info: { bg: 'bg-info/8', text: 'text-info', ring: 'ring-info/20' },
    warning: { bg: 'bg-warning/8', text: 'text-warning', ring: 'ring-warning/20' },
  };

  const ultraSimpleAgentView = canViewAll && isAgentMode;

  return (
    <div className="space-y-8">
      <DashboardNotifications />

      {ultraSimpleAgentView && (
        <TodayPriorities playbook={dailyPlaybook} storageKey={`agent-playbook:${user?.id || 'guest'}`} />
      )}

      {!ultraSimpleAgentView && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ title, value, icon: Icon, description, color }, i) => {
          const c = colorMap[color];
          return (
            <Card key={title} className={`hover-lift card-shine animate-fade-in-up stagger-${i + 1} border-0 shadow-card group cursor-default`}>
              <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.text} ring-1 ${c.ring} transition-all duration-300 group-hover:scale-110`}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="stat-number text-3xl">{value}</div>
                <p className="text-xs text-muted-foreground mt-1.5">{description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>}

      {!ultraSimpleAgentView && <EcosystemHealth />}
      {!ultraSimpleAgentView && <PipelineVelocity />}
      {!ultraSimpleAgentView && <TodayPriorities />}

      {!ultraSimpleAgentView && pendingMatches > 0 && (
        <Card className="animate-fade-in-up border-0 shadow-card bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 overflow-hidden">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 ring-1 ring-green-200 dark:ring-green-800">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-sm">📱 Recordatorio diario</p>
                <p className="text-xs text-muted-foreground">Tienes <strong>{pendingMatches} matches pendientes</strong> de enviar por WhatsApp</p>
              </div>
            </div>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white shadow-sm" onClick={() => navigate('/matches')}>
              Enviar ahora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Comisiones */}
      <Card className="animate-fade-in-up border-0 shadow-card hover-lift cursor-pointer card-shine overflow-hidden" onClick={() => navigate('/profile')}>
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-primary/20" style={{ background: 'var(--gradient-primary)' }}>
              <Euro className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Mis Comisiones</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Este mes: <span className="font-bold text-foreground stat-number">{fmtCurrency(earnings.month)}</span>
                {' · '}Semestre: <span className="font-bold text-foreground stat-number">{fmtCurrency(earnings.semester)}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {tier.next
                  ? `Te faltan ${fmtCurrency(tier.remaining)} para pasar a ${nextTierLabel}.`
                  : 'Ya estás en el tramo más alto del semestre.'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Solo suma comisión de agencia originada por ti.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={e => { e.stopPropagation(); navigate('/properties'); }}>
              <ArrowUpRight className="h-4 w-4 mr-1" />Simular
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={e => { e.stopPropagation(); navigate('/profile'); }}>
              Ver detalle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Objetivos KPI */}
      <Card className="animate-fade-in-up border-0 shadow-card card-shine overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg font-display">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-primary/20" style={{ background: 'var(--gradient-primary)' }}>
              <Target className="h-4 w-4 text-primary-foreground" />
            </div>
            Objetivos del periodo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Toques Horus / hoy', icon: MessageCircle, current: kpis.toquesHorusHoy, target: recommendedTouchTarget, failMsg: `Te faltan ${(recommendedTouchTarget - kpis.toquesHorusHoy).toFixed(1)} toque${recommendedTouchTarget - kpis.toquesHorusHoy > 1 ? 's' : ''} hoy` },
              { label: 'Ventas / año', icon: Home, current: kpis.ventasAno, target: kpiTargets.ventas_ano, failMsg: `Ritmo esperado hoy: ${getAnnualTargetToDate(kpiTargets.ventas_ano)}` },
              { label: 'Captaciones / mes', icon: Building2, current: kpis.captacionesMes, target: kpiTargets.captaciones_mes, failMsg: `Faltan ${kpiTargets.captaciones_mes - kpis.captacionesMes} exclusiva${kpiTargets.captaciones_mes - kpis.captacionesMes > 1 ? 's' : ''}` },
              { label: 'Citas capt. / semana', icon: CalendarCheck, current: kpis.citasSemana, target: kpiTargets.citas_semana, failMsg: `Faltan ${kpiTargets.citas_semana - kpis.citasSemana} cita${kpiTargets.citas_semana - kpis.citasSemana > 1 ? 's' : ''} esta semana` },
            ].map(({ label, icon: KIcon, current, target, failMsg }) => {
              const done = current >= target;
              const pct = Math.min((current / target) * 100, 100);
              return (
                <div key={label} className="space-y-3 p-4 rounded-xl bg-muted/40 border border-border/40">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium"><KIcon className="h-4 w-4 text-primary" />{label}</span>
                    <span className={`font-bold stat-number ${done ? 'text-success' : 'text-muted-foreground'}`}>{current}/{target}</span>
                  </div>
                  <Progress value={pct} className="h-2.5" />
                  <p className="text-xs text-muted-foreground">{done ? '✅ ¡Objetivo cumplido!' : failMsg}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {!ultraSimpleAgentView && <AgentDailyPlaybookCard playbook={dailyPlaybook} storageKey={`agent-playbook:${user?.id || 'guest'}`} />}
      {!ultraSimpleAgentView && <AgentCommercialFocusCard focus={commercialFocus} autonomy={autonomyStatus} />}

      {!ultraSimpleAgentView && <Card className="animate-fade-in-up border-0 shadow-card card-shine overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg font-display">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-primary/20" style={{ background: 'var(--gradient-primary)' }}>
              <Handshake className="h-4 w-4 text-primary-foreground" />
            </div>
            Pulso comercial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-muted/40 border border-border/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Euro className="h-4 w-4 text-primary" />
                Ofertas activas
              </div>
              <p className="text-3xl font-semibold mt-2">{kpis.ofertasActivas}</p>
              <p className="text-xs text-muted-foreground mt-1">Pendientes, presentadas o en contraoferta.</p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Oportunidades calientes
              </div>
              <p className="text-3xl font-semibold mt-2">{kpis.oportunidadesCalientes}</p>
              <p className="text-xs text-muted-foreground mt-1">Aceptadas o con contraoferta activa para empujar cierre.</p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarCheck className="h-4 w-4 text-primary" />
                Visitas sin oferta
              </div>
              <p className="text-3xl font-semibold mt-2">{kpis.visitasSinOferta}</p>
              <p className="text-xs text-muted-foreground mt-1">Visitas realizadas que siguen sin movimiento comercial.</p>
            </div>
            <div className="rounded-xl bg-muted/40 border border-border/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4 text-primary" />
                Inbound sin trabajar
              </div>
              <p className="text-3xl font-semibold mt-2">{inboundSinTrabajar}</p>
              <p className="text-xs text-muted-foreground mt-1">Leads web, portal o FB Ads que siguen fríos.</p>
            </div>
          </div>
          {inboundSinTrabajar > 0 && (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => navigate('/operations?kind=lead')}>
                Resolver inbound
              </Button>
            </div>
          )}
          {(commercialFriction.match || commercialFriction.offer) && (
            <div className="mt-4 rounded-xl border border-border/40 bg-muted/30 p-4">
              <p className="text-sm font-medium">Fricción comercial dominante</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <p className="text-xs text-muted-foreground">
                  Cruces: <span className="text-foreground">{commercialFriction.match || 'sin patrón dominante'}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Ofertas: <span className="text-foreground">{commercialFriction.offer || 'sin patrón dominante'}</span>
                </p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Siguiente paso sugerido:{' '}
                <span className="text-foreground">
                  {getCommercialSuggestion(commercialFriction.offer || commercialFriction.match) || 'Seguir revisando las caídas recientes.'}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>}

      {!ultraSimpleAgentView && <GoogleCalendarEmbed />}

      {!ultraSimpleAgentView && <div className="grid gap-5 lg:grid-cols-2">
        <RecentActivity />
        <UpcomingVisits />
      </div>}
    </div>
  );
};

export default DashboardAgent;
