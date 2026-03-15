import { useEffect, useState, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Euro, TrendingUp, Shield, Target, Clock, Settings, Check, Percent, Megaphone, GitMerge, Eye, Coins, HeartPulse, ScrollText, Phone, Activity, Satellite, Plug, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSemesterRange, fmt as fmtCurrency } from '@/lib/commissions';
import { useAgentMonthlyCost } from '@/hooks/useAgentMonthlyCost';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import CommercialProcessCard from '@/components/dashboard/CommercialProcessCard';
import AdminDailyPlaybookCard from '@/components/AdminDailyPlaybookCard';
import AISectionGuide from '@/components/ai/AISectionGuide';

// Lazy-loaded admin sections
const AdminAgentCosts    = lazy(() => import('@/components/AdminAgentCosts'));
const AdminEvolutionChart = lazy(() => import('@/components/AdminEvolutionChart'));
const MatchSenderLogs    = lazy(() => import('@/components/MatchSenderLogs'));
const AdminMediaActivity = lazy(() => import('@/components/AdminMediaActivity'));
const AdminAnnouncements = lazy(() => import('@/components/AdminAnnouncements'));
const AdminCommissions   = lazy(() => import('@/components/AdminCommissions'));
const AdminEcosystemHealth = lazy(() => import('@/components/AdminEcosystemHealth'));
const AdminPhoneActivity = lazy(() => import('@/components/AdminPhoneActivity'));
const AuditTimeline      = lazy(() => import('@/components/AuditTimeline'));
const AdminRecentActivity  = lazy(() => import('@/components/AdminRecentActivity'));
const AdminSatellites    = lazy(() => import('@/components/AdminSatellites'));
const AdminErpDashboard = lazy(() => import('@/components/AdminErpDashboard'));
const AdminLinkInBio   = lazy(() => import('@/components/AdminLinkInBio'));
const AdminInboundRadar = lazy(() => import('@/components/AdminInboundRadar'));
const AdminStockRadar = lazy(() => import('@/components/AdminStockRadar'));
import LastMatchRunCard from '@/components/LastMatchRunCard';
const AdminLegalRadar = lazy(() => import('@/components/AdminLegalRadar'));
const AdminClosingRadar = lazy(() => import('@/components/AdminClosingRadar'));
const AdminKpiBoard = lazy(() => import('@/components/AdminKpiBoard'));
const AdminCommercialBottlenecks = lazy(() => import('@/components/AdminCommercialBottlenecks'));
const AdminCommercialCoherence = lazy(() => import('@/components/AdminCommercialCoherence'));
const AdminCommercialEngine = lazy(() => import('@/components/AdminCommercialEngine'));
const AdminAgentRecordRichness = lazy(() => import('@/components/AdminAgentRecordRichness'));
const AdminAgentViability = lazy(() => import('@/components/AdminAgentViability'));
const AdminInfluenceCircle = lazy(() => import('@/components/AdminInfluenceCircle'));
const AdminAgentEvaluationOverview = lazy(() => import('@/components/AdminAgentEvaluationOverview'));
const AdminAdvisorGuideProgress = lazy(() => import('@/components/AdminAdvisorGuideProgress'));


const SuspenseFallback = <div className="py-12 text-center text-muted-foreground">Cargando...</div>;

const PRIMARY_ADMIN_TABS = [
  { value: 'dashboard', label: 'Resumen', icon: Shield },
  { value: 'kpis', label: 'KPI', icon: Target },
  { value: 'commissions', label: 'Comisiones', icon: Coins },
  { value: 'ecosystem', label: 'Salud', icon: HeartPulse },
] as const;

const SECONDARY_ADMIN_TABS = [
  { value: 'activity', label: 'Actividad', icon: Activity },
  { value: 'match-logs', label: 'Cruces', icon: GitMerge },
  { value: 'announcements', label: 'Anuncios', icon: Megaphone },
  { value: 'media-activity', label: 'Media', icon: Eye },
  { value: 'phone-activity', label: 'Teléfono', icon: Phone },
  { value: 'audit', label: 'Auditoría', icon: ScrollText },
  { value: 'erp', label: 'ERP', icon: Plug },
  { value: 'linkinbio', label: 'Link in Bio', icon: Link2 },
  { value: 'satellites', label: 'Satélites', icon: Satellite },
] as const;

const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
  let current = element?.parentElement ?? null;

  while (current) {
    const style = window.getComputedStyle(current);
    const canScroll = /(auto|scroll)/.test(`${style.overflow}${style.overflowY}${style.overflowX}`);
    if (canScroll && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
};

const scrollAdminSectionIntoView = (targetId: string) => {
  const element = document.getElementById(targetId);
  if (!element) return false;

  const scrollContainer = findScrollableParent(element) ?? document.scrollingElement ?? document.documentElement;
  const containerRect = scrollContainer instanceof HTMLElement ? scrollContainer.getBoundingClientRect() : { top: 0 };
  const elementRect = element.getBoundingClientRect();
  const currentTop = scrollContainer instanceof HTMLElement ? scrollContainer.scrollTop : window.scrollY;
  const nextTop = currentTop + (elementRect.top - containerRect.top) - 24;

  if (scrollContainer instanceof HTMLElement) {
    scrollContainer.scrollTo({ top: nextTop, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: nextTop, behavior: 'smooth' });
  }

  return true;
};

const DashboardAdmin = () => {
  const location = useLocation();
  const [stats, setStats] = useState({ totalAgents: 0, totalAgency: 0, totalPaid: 0, pendingApproval: 0 });
  const { cost, updateCost } = useAgentMonthlyCost();
  const [editingCost, setEditingCost] = useState(false);
  const [costInput, setCostInput] = useState('');
  const [kpiTargets, setKpiTargets] = useState({ ventas_ano: 10, captaciones_mes: 2, citas_semana: 2, toques_horus_dia: 4 });
  const [kpiEditing, setKpiEditing] = useState(false);
  const [kpiForm, setKpiForm] = useState({ ventas_ano: '10', captaciones_mes: '2', citas_semana: '2', toques_horus_dia: '4' });
  const [matchConfig, setMatchConfig] = useState({ send_hour: '09:00', price_margin: 25 });
  const [matchEditing, setMatchEditing] = useState(false);
  const [matchForm, setMatchForm] = useState({ send_hour: '09:00', price_margin: '25' });
  const [adminTab, setAdminTab] = useState('dashboard');

  const semester = getSemesterRange();

  useEffect(() => {
    const fetchAdminStats = async () => {
      const [rolesRes, agencyRes, paidRes, pendingRes, kpiRes, matchRes] = await Promise.all([
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'agent'),
        supabase.from('commissions').select('agency_commission').in('status', ['aprobado', 'pagado']).gte('created_at', semester.start.toISOString()),
        supabase.from('commissions').select('agent_total').eq('status', 'pagado').gte('created_at', semester.start.toISOString()),
        supabase.from('commissions').select('id', { count: 'exact', head: true }).eq('status', 'borrador'),
        supabase.from('settings').select('value').eq('key', 'kpi_targets').maybeSingle(),
        supabase.from('settings').select('value').eq('key', 'match_config').maybeSingle(),
      ]);

      if (kpiRes.data?.value) {
        const v = kpiRes.data.value as any;
        const targets = {
          ventas_ano: v.ventas_ano ?? 10,
          captaciones_mes: v.captaciones_mes ?? 2,
          citas_semana: v.citas_semana ?? 2,
          toques_horus_dia: v.toques_horus_dia ?? 4,
        };
        setKpiTargets(targets);
        setKpiForm({
          ventas_ano: targets.ventas_ano.toString(),
          captaciones_mes: targets.captaciones_mes.toString(),
          citas_semana: targets.citas_semana.toString(),
          toques_horus_dia: targets.toques_horus_dia.toString(),
        });
      }

      if (matchRes.data?.value) {
        const mc = matchRes.data.value as any;
        const cfg = { send_hour: mc.send_hour ?? '09:00', price_margin: mc.price_margin ?? 25 };
        setMatchConfig(cfg);
        setMatchForm({ send_hour: cfg.send_hour, price_margin: cfg.price_margin.toString() });
      }

      setStats({
        totalAgents: rolesRes.count || 0,
        totalAgency: ((agencyRes.data as any[]) || []).reduce((s: number, r: any) => s + (r.agency_commission || 0), 0),
        totalPaid: ((paidRes.data as any[]) || []).reduce((s: number, r: any) => s + (r.agent_total || 0), 0),
        pendingApproval: pendingRes.count || 0,
      });
    };
    fetchAdminStats();
  }, []);

  useEffect(() => {
    if (!location.hash) return;

    const targetId = location.hash.replace('#', '');
    let attempts = 0;

    const scrollToTarget = () => {
      if (scrollAdminSectionIntoView(targetId)) {
        return;
      }

      attempts += 1;
      if (attempts < 12) {
        window.setTimeout(scrollToTarget, 150);
      }
    };

    scrollToTarget();
  }, [location.hash, adminTab]);

  const handleSaveCost = async () => {
    const val = Number(costInput);
    if (!val || val <= 0) { toast.error('Introduce un valor válido'); return; }
    const ok = await updateCost(val);
    if (ok) { toast.success(`Coste fijo actualizado a ${fmtCurrency(val)}/mes`); setEditingCost(false); }
    else toast.error('Error al guardar');
  };

  const handleSaveKpis = async () => {
    const targets = {
      ventas_ano: Number(kpiForm.ventas_ano) || 10,
      captaciones_mes: Number(kpiForm.captaciones_mes) || 2,
      citas_semana: Number(kpiForm.citas_semana) || 2,
      toques_horus_dia: Number(kpiForm.toques_horus_dia) || 4,
    };
    const { error } = await supabase.from('settings').upsert({ key: 'kpi_targets', value: targets as any }, { onConflict: 'key' });
    if (error) { toast.error('Error al guardar KPIs'); return; }
    setKpiTargets(targets);
    setKpiEditing(false);
    toast.success('Objetivos KPI actualizados');
  };

  const handleSaveMatchConfig = async () => {
    const cfg = { send_hour: matchForm.send_hour || '09:00', price_margin: Math.max(1, Math.min(100, Number(matchForm.price_margin) || 25)) };
    const { error } = await supabase.from('settings').upsert({ key: 'match_config', value: cfg as any }, { onConflict: 'key' });
    if (error) { toast.error('Error al guardar configuración'); return; }
    setMatchConfig(cfg);
    setMatchEditing(false);
    toast.success('Configuración de envío actualizada');
  };

  return (
    <div className="space-y-6">
      <AISectionGuide
        title="Admin: aqui diriges la inmobiliaria con datos"
        context="Esta vista existe para que un director nuevo pueda entender la oficina desde el primer dia: equipo, stock, compradores, legal, cierre y dinero."
        doNow={`Ahora mismo tienes ${stats.totalAgents} agente${stats.totalAgents === 1 ? '' : 's'} activos y ${stats.pendingApproval} pendiente${stats.pendingApproval === 1 ? '' : 's'} de aprobacion. Empieza por el motor comercial, baja luego a los agentes y despues quita bloqueos.`}
        dontForget="No dirijas por intuicion. Primero mira donde se rompe la oficina, luego quien la esta rompiendo y por ultimo que decision toca hoy."
        risk="Si lees paneles sin priorizar, la oficina parece moverse pero los bloqueos siguen vivos y el equipo se dispersa."
        actions={[
          { label: 'Que mira primero un director nuevo', description: 'Foto global de oficina, evaluacion de agentes y despues legal, cierre, stock e inbound.' },
          { label: 'Que debe salir de aqui', description: 'Una lista corta de decisiones: a quien empujar, donde intervenir y que bloqueo quitar hoy.' },
          { label: 'Que error evitar', description: 'Intentar verlo todo a la vez. Esta pantalla sirve para ordenar criterio, no para perderse en paneles.' },
        ]}
      />

      {/* Header with cost config */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">Vista gerencial — {semester.label}</p>
        <div className="flex items-center gap-2">
          {editingCost ? (
            <>
              <Input type="number" className="w-28 h-9" value={costInput} onChange={e => setCostInput(e.target.value)} placeholder="€/mes" autoFocus onKeyDown={e => e.key === 'Enter' && handleSaveCost()} />
              <Button size="sm" onClick={handleSaveCost}><Check className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingCost(false)}>Cancelar</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => { setCostInput(cost.toString()); setEditingCost(true); }}>
              <Settings className="h-4 w-4 mr-1.5" />Coste fijo: {fmtCurrency(cost)}/mes
            </Button>
          )}
        </div>
      </div>

      <Tabs value={adminTab} onValueChange={setAdminTab}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <TabsList className="inline-flex w-max h-9 gap-0.5 p-0.5 flex-nowrap">
              {PRIMARY_ADMIN_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.value} value={tab.value} className="text-xs whitespace-nowrap shrink-0">
                    <Icon className="h-3.5 w-3.5 mr-1" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              Primero equipo, riesgos y decisiones. Lo técnico queda aquí al lado.
            </p>
            <Select value={PRIMARY_ADMIN_TABS.some((tab) => tab.value === adminTab) ? 'none' : adminTab} onValueChange={(value) => {
              if (value !== 'none') setAdminTab(value);
            }}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Más paneles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Más paneles</SelectItem>
                {SECONDARY_ADMIN_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <SelectItem key={tab.value} value={tab.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Resumen ── */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <AdminDailyPlaybookCard pendingApproval={stats.pendingApproval} totalAgents={stats.totalAgents} />
          <Suspense fallback={SuspenseFallback}><AdminAdvisorGuideProgress /></Suspense>
          <CommercialProcessCard mode="admin" />
          <div id="admin-commercial-engine">
            <Suspense fallback={SuspenseFallback}><AdminCommercialEngine /></Suspense>
          </div>
          <Suspense fallback={SuspenseFallback}><AdminInfluenceCircle /></Suspense>
          <div id="admin-agent-evaluation-overview">
            <Suspense fallback={SuspenseFallback}><AdminAgentEvaluationOverview /></Suspense>
          </div>
          <Suspense fallback={SuspenseFallback}><AdminAgentViability /></Suspense>
          <Suspense fallback={SuspenseFallback}><AdminAgentRecordRichness /></Suspense>
          <Suspense fallback={SuspenseFallback}><AdminCommercialBottlenecks /></Suspense>
          <Suspense fallback={SuspenseFallback}><AdminCommercialCoherence /></Suspense>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div><p className="text-2xl font-bold">{stats.totalAgents}</p><p className="text-xs text-muted-foreground">Asesores activos</p></div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10"><Euro className="h-5 w-5 text-success" /></div>
                <div><p className="text-2xl font-bold">{fmtCurrency(stats.totalAgency)}</p><p className="text-xs text-muted-foreground">Generado agencia (semestre)</p></div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10"><TrendingUp className="h-5 w-5 text-accent" /></div>
                <div><p className="text-2xl font-bold">{fmtCurrency(stats.totalPaid)}</p><p className="text-xs text-muted-foreground">Pagado a asesores</p></div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10"><Shield className="h-5 w-5 text-warning" /></div>
                <div><p className="text-2xl font-bold">{stats.pendingApproval}</p><p className="text-xs text-muted-foreground">Pendientes aprobación</p></div>
              </CardContent>
            </Card>
          </div>
          <Suspense fallback={SuspenseFallback}><AdminKpiBoard /></Suspense>
          <Suspense fallback={SuspenseFallback}><AdminInboundRadar /></Suspense>
          <Suspense fallback={SuspenseFallback}><AdminStockRadar /></Suspense>
          <Suspense fallback={SuspenseFallback}><AdminLegalRadar /></Suspense>
          <Suspense fallback={SuspenseFallback}><AdminClosingRadar /></Suspense>
          <LastMatchRunCard />
          <Suspense fallback={SuspenseFallback}><AdminEvolutionChart agentMonthlyCost={cost} /></Suspense>
          <Suspense fallback={SuspenseFallback}><AdminAgentCosts agentMonthlyCost={cost} /></Suspense>
        </TabsContent>

        <TabsContent value="commissions" className="mt-4"><Suspense fallback={SuspenseFallback}><AdminCommissions /></Suspense></TabsContent>
        <TabsContent value="ecosystem"   className="mt-4"><Suspense fallback={SuspenseFallback}><AdminEcosystemHealth /></Suspense></TabsContent>

        {/* ── KPIs & Match config ── */}
        <TabsContent value="kpis" className="mt-4 space-y-6">
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Objetivos KPI del equipo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Estos objetivos marcan la cadencia comercial sana del equipo: actividad diaria, visitas de captación, exclusivas al mes y ritmo anual de arras.</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ventas / año</label>
                  {kpiEditing
                    ? <Input type="number" min={0} value={kpiForm.ventas_ano} onChange={e => setKpiForm({ ...kpiForm, ventas_ano: e.target.value })} />
                    : <p className="text-2xl font-bold">{kpiTargets.ventas_ano}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Captaciones / mes</label>
                  {kpiEditing
                    ? <Input type="number" min={0} value={kpiForm.captaciones_mes} onChange={e => setKpiForm({ ...kpiForm, captaciones_mes: e.target.value })} />
                    : <p className="text-2xl font-bold">{kpiTargets.captaciones_mes}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Citas captación / semana</label>
                  {kpiEditing
                    ? <Input type="number" min={0} value={kpiForm.citas_semana} onChange={e => setKpiForm({ ...kpiForm, citas_semana: e.target.value })} />
                    : <p className="text-2xl font-bold">{kpiTargets.citas_semana}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Toques Horus / día</label>
                  {kpiEditing
                    ? <Input type="number" min={0} value={kpiForm.toques_horus_dia} onChange={e => setKpiForm({ ...kpiForm, toques_horus_dia: e.target.value })} />
                    : <p className="text-2xl font-bold">{kpiTargets.toques_horus_dia}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {kpiEditing ? (
                  <>
                    <Button onClick={handleSaveKpis}><Check className="h-4 w-4 mr-1" />Guardar</Button>
                    <Button variant="ghost" onClick={() => setKpiEditing(false)}>Cancelar</Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => {
                    setKpiForm({
                      ventas_ano: kpiTargets.ventas_ano.toString(),
                      captaciones_mes: kpiTargets.captaciones_mes.toString(),
                      citas_semana: kpiTargets.citas_semana.toString(),
                      toques_horus_dia: kpiTargets.toques_horus_dia.toString(),
                    });
                    setKpiEditing(true);
                  }}>
                    <Settings className="h-4 w-4 mr-1.5" />Editar objetivos
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Configuración de envío diario</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Hora de envío automático y margen de tolerancia de precio para cruces.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5"><Clock className="h-4 w-4" />Hora de envío</label>
                  {matchEditing
                    ? <Input type="time" value={matchForm.send_hour} onChange={e => setMatchForm({ ...matchForm, send_hour: e.target.value })} />
                    : <p className="text-2xl font-bold">{matchConfig.send_hour}h</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5"><Percent className="h-4 w-4" />Margen de precio (±%)</label>
                  {matchEditing
                    ? <Input type="number" min={1} max={100} value={matchForm.price_margin} onChange={e => setMatchForm({ ...matchForm, price_margin: e.target.value })} />
                    : <p className="text-2xl font-bold">±{matchConfig.price_margin}%</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {matchEditing ? (
                  <>
                    <Button onClick={handleSaveMatchConfig}><Check className="h-4 w-4 mr-1" />Guardar</Button>
                    <Button variant="ghost" onClick={() => setMatchEditing(false)}>Cancelar</Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => { setMatchForm({ send_hour: matchConfig.send_hour, price_margin: matchConfig.price_margin.toString() }); setMatchEditing(true); }}>
                    <Settings className="h-4 w-4 mr-1.5" />Editar configuración
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="announcements"  className="mt-4"><Suspense fallback={SuspenseFallback}><AdminAnnouncements /></Suspense></TabsContent>
        <TabsContent value="match-logs"     className="mt-4"><Suspense fallback={SuspenseFallback}><MatchSenderLogs /></Suspense></TabsContent>
        <TabsContent value="media-activity" className="mt-4"><Suspense fallback={SuspenseFallback}><AdminMediaActivity /></Suspense></TabsContent>
        <TabsContent value="phone-activity" className="mt-4"><Suspense fallback={SuspenseFallback}><AdminPhoneActivity /></Suspense></TabsContent>
        <TabsContent value="audit"          className="mt-4"><Suspense fallback={SuspenseFallback}><AuditTimeline /></Suspense></TabsContent>
        <TabsContent value="activity"       className="mt-4"><Suspense fallback={SuspenseFallback}><AdminRecentActivity /></Suspense></TabsContent>
        <TabsContent value="erp"           className="mt-4"><Suspense fallback={SuspenseFallback}><AdminErpDashboard /></Suspense></TabsContent>
        <TabsContent value="linkinbio"     className="mt-4"><Suspense fallback={SuspenseFallback}><AdminLinkInBio /></Suspense></TabsContent>
        <TabsContent value="satellites"    className="mt-4"><Suspense fallback={SuspenseFallback}><AdminSatellites /></Suspense></TabsContent>
        
      </Tabs>
    </div>
  );
};

export default DashboardAdmin;
