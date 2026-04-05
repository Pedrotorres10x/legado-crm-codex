import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield, Target, Clock, Megaphone, GitMerge, Eye, Coins, HeartPulse, ScrollText, Phone, Activity, Satellite, Plug, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSemesterRange } from '@/lib/commissions';
import { useAgentMonthlyCost } from '@/hooks/useAgentMonthlyCost';
import { useDashboardAdminState } from '@/hooks/useDashboardAdminState';
import { useLocation, useNavigate } from 'react-router-dom';
import CommercialProcessCard from '@/components/dashboard/CommercialProcessCard';
import AdminDailyPlaybookCard from '@/components/AdminDailyPlaybookCard';
import AISectionGuide from '@/components/ai/AISectionGuide';
import DashboardAdminHeader from '@/components/dashboard/DashboardAdminHeader';
import DashboardAdminSettingsPanels from '@/components/dashboard/DashboardAdminSettingsPanels';
import DashboardAdminSummaryStats from '@/components/dashboard/DashboardAdminSummaryStats';

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
  const navigate = useNavigate();
  const { cost, updateCost } = useAgentMonthlyCost();
  const [adminTab, setAdminTab] = useState('dashboard');

  const semester = useMemo(() => getSemesterRange(), []);
  const {
    stats,
    editingCost,
    setEditingCost,
    costInput,
    setCostInput,
    kpiTargets,
    kpiEditing,
    setKpiEditing,
    kpiForm,
    setKpiForm,
    matchConfig,
    matchEditing,
    setMatchEditing,
    matchForm,
    setMatchForm,
    handleSaveCost,
    handleSaveKpis,
    handleSaveMatchConfig,
  } = useDashboardAdminState({
    semesterStartIso: semester.start.toISOString(),
    cost,
    updateCost,
  });

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

      <DashboardAdminHeader
        semesterLabel={semester.label}
        cost={cost}
        editingCost={editingCost}
        costInput={costInput}
        setCostInput={setCostInput}
        setEditingCost={setEditingCost}
        onSaveCost={handleSaveCost}
        onOpenDemands={() => navigate('/demands')}
        onOpenBuyersWithoutDemand={() => navigate('/buyers-without-demand')}
      />

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
          <DashboardAdminSummaryStats
            totalAgents={stats.totalAgents}
            totalAgency={stats.totalAgency}
            totalPaid={stats.totalPaid}
            pendingApproval={stats.pendingApproval}
          />
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
          <DashboardAdminSettingsPanels
            kpiTargets={kpiTargets}
            kpiEditing={kpiEditing}
            kpiForm={kpiForm}
            setKpiForm={setKpiForm}
            setKpiEditing={setKpiEditing}
            onSaveKpis={handleSaveKpis}
            matchConfig={matchConfig}
            matchEditing={matchEditing}
            matchForm={matchForm}
            setMatchForm={setMatchForm}
            setMatchEditing={setMatchEditing}
            onSaveMatchConfig={handleSaveMatchConfig}
          />
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
