import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Users, CalendarCheck, Phone, UserPlus, ShieldAlert, Radar, Share2 } from 'lucide-react';
import TodayPriorities from '@/components/dashboard/TodayPriorities';
import DashboardNotifications from '@/components/DashboardNotifications';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useWebLeads } from '@/hooks/useWebLeadsData';
import { getAgentKpiSummary, getAgentKpiTargets } from '@/lib/agent-kpis';
import { getAgentAutonomyStatus, getAgentCommercialFocus } from '@/lib/property-stock-health';
import { getAgentDailyPlaybook } from '@/lib/agent-daily-playbook';
import { useAgentInfluenceCircle } from '@/hooks/useAgentInfluenceCircle';

const MobileDashboard = () => {
  const { user, canViewAll } = useAuth();
  const navigate = useNavigate();
  const { data: inboundLeads = [] } = useWebLeads();
  const { summary: influenceCircle } = useAgentInfluenceCircle(user?.id);
  const [stats, setStats] = useState({ properties: 0, contacts: 0, tasksToday: 0, autoClosingTasks: 0 });
  const [kpis, setKpis] = useState({
    ventasAno: 0,
    captacionesMes: 0,
    citasSemana: 0,
    toquesHorusHoy: 0,
    ofertasActivas: 0,
    oportunidadesCalientes: 0,
    visitasSinOferta: 0,
  });
  const [kpiTargets, setKpiTargets] = useState({ ventas_ano: 10, captaciones_mes: 2, citas_semana: 2, toques_horus_dia: 4 });
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const uid = user?.id;
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();

      let propsQ = supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', 'disponible');
      let contactsQ = supabase.from('contacts').select('id', { count: 'exact', head: true });
      let tasksQ = supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('completed', false).gte('due_date', todayStart).lte('due_date', todayEnd);
      let autoClosingTasksQ = supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('completed', false)
        .in('source', ['closing_blocked', 'closing_signature_pending', 'closing_deed_due']);

      if (uid) {
        propsQ = propsQ.eq('agent_id', uid);
        contactsQ = contactsQ.eq('agent_id', uid);
        tasksQ = tasksQ.eq('agent_id', uid);
        autoClosingTasksQ = autoClosingTasksQ.eq('agent_id', uid);
      }

      const profilePromise = uid
        ? supabase.from('profiles').select('public_slug').eq('user_id', uid).maybeSingle()
        : Promise.resolve({ data: null } as any);

      const [props, contacts, tasks, autoClosingTasks, profileRes] = await Promise.all([
        propsQ,
        contactsQ,
        tasksQ,
        autoClosingTasksQ,
        profilePromise,
      ]);
      const resolvedTargets = await getAgentKpiTargets();
      setKpiTargets(resolvedTargets);
      if (uid) {
        const summary = await getAgentKpiSummary(uid, resolvedTargets);
        setKpis({
          ventasAno: summary.ventasAno,
          captacionesMes: summary.captacionesMes,
          citasSemana: summary.citasSemana,
          toquesHorusHoy: summary.toquesHorusHoy,
          ofertasActivas: summary.ofertasActivas,
          oportunidadesCalientes: summary.oportunidadesCalientes,
          visitasSinOferta: summary.visitasSinOferta,
        });
      }
      setStats({
        properties: props.count ?? 0,
        contacts: contacts.count ?? 0,
        tasksToday: tasks.count ?? 0,
        autoClosingTasks: autoClosingTasks.count ?? 0,
      });
      setPublicSlug(profileRes?.data?.public_slug ?? null);
      setLoading(false);
    };
    fetchStats();
  }, [user]);

  const today = format(new Date(), "EEEE d MMM", { locale: es });
  const socialCardUrl = publicSlug ? `https://legadocoleccion.es/agente/${publicSlug}` : null;
  const inboundSinTrabajar = useMemo(() => {
    if (!user?.id) return 0;
    return inboundLeads.filter((lead) => lead.agent_id === user.id && lead.needs_follow_up).length;
  }, [inboundLeads, user?.id]);

  const recommendedTouchTarget = useMemo(
    () => Math.max(kpiTargets.toques_horus_dia, influenceCircle?.recommendedDailyTouches || 0),
    [influenceCircle?.recommendedDailyTouches, kpiTargets.toques_horus_dia],
  );

  const commercialFocus = useMemo(
    () =>
      getAgentCommercialFocus({
        availableCount: stats.properties,
        activeOffers: kpis.ofertasActivas,
        hotOpportunities: kpis.oportunidadesCalientes,
        visitsWithoutOffer: kpis.visitasSinOferta,
      }),
    [kpis.ofertasActivas, kpis.oportunidadesCalientes, kpis.visitasSinOferta, stats.properties],
  );

  const autonomyStatus = useMemo(
    () =>
      getAgentAutonomyStatus({
        focus: commercialFocus.focus,
        availableCount: stats.properties,
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
      stats.properties,
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
      kpiTargets.ventas_ano,
      kpis.captacionesMes,
      kpis.citasSemana,
      kpis.ofertasActivas,
      kpis.toquesHorusHoy,
      kpis.visitasSinOferta,
      recommendedTouchTarget,
    ],
  );

  const handleOpenCard = async () => {
    if (!socialCardUrl) {
      navigate('/profile');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Mi tarjeta virtual',
          url: socialCardUrl,
        });
        return;
      } catch {
        // fall back to opening the public card
      }
    }
    window.open(socialCardUrl, '_blank', 'noopener,noreferrer');
  };

  const quickActions = [
    { label: 'Llamadas', icon: Phone, className: 'bg-green-500 hover:bg-green-600', to: '/comms?tab=calls' },
    { label: 'Alta contacto', icon: UserPlus, className: 'bg-primary hover:bg-primary/90', to: '/contacts?quickCreate=1' },
    { label: 'Alta inmueble', icon: Building2, className: 'bg-accent hover:bg-accent/90', to: '/properties?quickCreate=1' },
    {
      label: 'Tarjeta virtual',
      icon: Share2,
      className: 'bg-sky-600 hover:bg-sky-700',
      onClick: handleOpenCard,
    },
    { label: 'Operaciones', icon: Radar, className: 'bg-slate-800 hover:bg-slate-900', to: '/operations' },
  ];

  const focusAction =
      commercialFocus.focus === 'captacion'
        ? { label: 'Personas', icon: Users, className: 'bg-primary hover:bg-primary/90', to: '/contacts' }
        : commercialFocus.focus === 'venta'
        ? { label: 'Compradores y cruces', icon: Radar, className: 'bg-slate-800 hover:bg-slate-900', to: '/matches' }
        : { label: 'Operaciones', icon: Radar, className: 'bg-slate-800 hover:bg-slate-900', to: '/operations' };

  const visibleQuickActions = canViewAll
    ? [
        { label: 'Admin', icon: ShieldAlert, className: 'bg-slate-800 hover:bg-slate-900', to: '/admin' },
        focusAction,
        ...quickActions.filter((action) => action.label !== focusAction.label),
      ]
    : [focusAction, ...quickActions.filter((action) => action.label !== focusAction.label)];

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <p className="text-xs text-muted-foreground capitalize">{today}</p>
        <h1 className="text-xl font-display font-semibold text-foreground mt-0.5">Buenos días 👋</h1>
      </div>

      {/* Inline Notifications */}
      <DashboardNotifications alwaysShow />

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 text-left shadow-sm active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <CalendarCheck className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none">{loading ? '—' : stats.tasksToday}</p>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">Tareas hoy</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/operations?preset=closing')}
          className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 text-left shadow-sm active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <ShieldAlert className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none">{loading ? '—' : stats.autoClosingTasks}</p>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">Cierre / firma</p>
          </div>
        </button>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Acciones rápidas</p>
        <div className="grid grid-cols-2 gap-2.5">
          {visibleQuickActions.map(({ label, icon: Icon, className, to, onClick }) => (
            <button
              key={label}
              onClick={() => {
                if (onClick) {
                  onClick();
                  return;
                }
                if (to) navigate(to);
              }}
              className={cn(
                'flex items-center gap-2.5 px-4 py-3.5 rounded-2xl text-white text-sm font-semibold transition-all active:scale-95 shadow-sm',
                className
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 text-left shadow-sm active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Users className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none">{loading ? '—' : stats.contacts}</p>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">Contactos</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/properties')}
          className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 text-left shadow-sm active:scale-95"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none">{loading ? '—' : stats.properties}</p>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">Inmuebles</p>
          </div>
        </button>
      </div>

      <TodayPriorities playbook={dailyPlaybook} storageKey={`agent-playbook:${user?.id || 'guest'}:mobile`} />
    </div>
  );
};

export default MobileDashboard;
