import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Building2, Handshake, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getTeamKpiSummaries } from '@/lib/agent-kpis';
import { getAgentAutonomyStatus, getAgentCommercialFocus, getAgentStockRows, getPropertyStockSummary } from '@/lib/property-stock-health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type AgentProfile = {
  user_id: string;
  full_name: string | null;
};

type EngineState = {
  activity: {
    touchesGapAgents: number;
    activeOffers: number;
    score: number;
    owner: { agentId: string; name: string; reason: string } | null;
  };
  sellers: {
    available: number;
    withoutMandate: number;
    weakListing: number;
    score: number;
    owner: { agentId: string; name: string; reason: string } | null;
  };
  buyers: {
    activeDemand: number;
    visitsNoOffer: number;
    liveOffers: number;
    score: number;
    owner: { agentId: string; name: string; reason: string } | null;
  };
  focuses: Array<{
    agentId: string;
    name: string;
    focus: ReturnType<typeof getAgentCommercialFocus>;
    autonomy: ReturnType<typeof getAgentAutonomyStatus>;
  }>;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const tone = (score: number) => {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 45) return 'text-amber-600';
  return 'text-rose-600';
};

const statusLabel = (score: number) => {
  if (score >= 70) return 'Sano';
  if (score >= 45) return 'Vigilar';
  return 'Actuar';
};

const getOfficeDiagnosis = (state: EngineState) => {
  const scores = [
    { key: 'actividad', label: 'Actividad del equipo', score: state.activity.score },
    { key: 'vendedores', label: 'Base vendedora', score: state.sellers.score },
    { key: 'compradores', label: 'Base compradora', score: state.buyers.score },
  ].sort((a, b) => a.score - b.score);

  const weakest = scores[0];
  const strongest = scores[2];

  if (weakest.score >= 70) {
    return {
      title: 'Motor comercial equilibrado',
      detail: 'Actividad, vendedores y compradores están razonablemente alineados para sostener ventas.',
      action: 'Mantener ritmo y mirar cuellos individuales en el equipo.',
    };
  }

  if (weakest.key === 'actividad') {
    return {
      title: 'Falta empuje comercial base',
      detail: 'La oficina no está generando suficiente actividad consistente para alimentar el resto del sistema.',
      action: 'Subir toques útiles, agenda comercial y disciplina Horus antes de pedir más resultados.',
    };
  }

  if (weakest.key === 'vendedores') {
    return {
      title: 'La base vendedora es el cuello',
      detail: 'Sin producto sano no hay forma estable de sostener cierres, aunque el equipo se mueva.',
      action: 'Reforzar captación, mandatos y calidad de ficha para no ahogar el motor comercial.',
    };
  }

  return {
    title: 'La base compradora es el cuello',
    detail: `Hay más tracción en ${strongest.label.toLowerCase()} que en compradores realmente avanzando a oferta.`,
    action: 'Empujar seguimiento comprador, visitas con resultado y negociación para llevar a arras.',
  };
};

const getWeakBaseOwner = (state: EngineState) => {
  const ranked = [
    { key: 'activity' as const, label: 'Actividad del equipo', score: state.activity.score, owner: state.activity.owner },
    { key: 'sellers' as const, label: 'Base vendedora', score: state.sellers.score, owner: state.sellers.owner },
    { key: 'buyers' as const, label: 'Base compradora', score: state.buyers.score, owner: state.buyers.owner },
  ].sort((a, b) => a.score - b.score);

  return ranked[0];
};

const AdminCommercialEngine = () => {
  const [state, setState] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [{ data: profiles }, { data: properties }, { count: activeDemandCount }, { count: visitsNoOfferCount }, { count: liveOffersCount }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').order('full_name'),
        supabase
          .from('properties')
          .select('id, title, status, agent_id, mandate_type, mandate_end, xml_id, source, price, images, description'),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .in('pipeline_stage', ['nuevo', 'contactado', 'visitando', 'negociando'])
          .eq('status', 'activo'),
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .or('result.eq.seguimiento,result.eq.segunda_visita,result.eq.realizada,result.is.null'),
        supabase
          .from('offers')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pendiente', 'presentada', 'contraoferta']),
      ]);

      const agents = ((profiles || []) as AgentProfile[]).filter((agent) => agent.full_name);
      const { summaries } = await getTeamKpiSummaries(agents);
      const stock = getPropertyStockSummary((properties || []) as any[]);
      const stockRows = getAgentStockRows((properties || []) as any[]);
      const agentNames = new Map(agents.map((agent) => [agent.user_id, agent.full_name || 'Sin nombre']));

      const touchesGapAgents = summaries.filter(
        ({ summary }) => summary.toquesHorusHoy < summary.targets.toques_horus_dia,
      ).length;
      const activeOffers = summaries.reduce((sum, item) => sum + item.summary.ofertasActivas, 0);
      const weakestActivityAgent = [...summaries]
        .sort((a, b) => {
          const aGap = a.summary.targets.toques_horus_dia - a.summary.toquesHorusHoy;
          const bGap = b.summary.targets.toques_horus_dia - b.summary.toquesHorusHoy;
          return bGap - aGap;
        })[0];
      const weakestStockAgent = [...stockRows]
        .sort((a, b) => {
          const aIssue = a.noMandateCount + a.expiredMandateCount + a.missingPublishBasicsCount + a.distributionGapCount;
          const bIssue = b.noMandateCount + b.expiredMandateCount + b.missingPublishBasicsCount + b.distributionGapCount;
          return bIssue - aIssue;
        })[0];
      const weakestBuyerAgent = [...summaries]
        .sort((a, b) => {
          const aIssue = a.summary.visitasSinOferta * 2 - a.summary.ofertasActivas;
          const bIssue = b.summary.visitasSinOferta * 2 - b.summary.ofertasActivas;
          return bIssue - aIssue;
        })[0];

      const nextState: EngineState = {
        activity: {
          touchesGapAgents,
          activeOffers,
          score: clampScore(100 - touchesGapAgents * 12 + Math.min(activeOffers, 8) * 4),
          owner: weakestActivityAgent
            ? {
                agentId: weakestActivityAgent.user_id,
                name: weakestActivityAgent.full_name || 'Sin nombre',
                reason: `${weakestActivityAgent.summary.toquesHorusHoy}/${weakestActivityAgent.summary.targets.toques_horus_dia} toques hoy`,
              }
            : null,
        },
        sellers: {
          available: stock.availableCount,
          withoutMandate: stock.noMandateCount + stock.expiredMandateCount,
          weakListing: stock.missingPublishBasicsCount + stock.distributionGapCount,
          score: clampScore(
            100 -
              (stock.noMandateCount + stock.expiredMandateCount) * 9 -
              (stock.missingPublishBasicsCount + stock.distributionGapCount) * 6 +
              Math.min(stock.availableCount, 12) * 2,
          ),
          owner: weakestStockAgent
            ? {
                agentId: weakestStockAgent.agentId,
                name: agentNames.get(weakestStockAgent.agentId) || 'Sin nombre',
                reason: `${weakestStockAgent.noMandateCount + weakestStockAgent.expiredMandateCount} problemas de mandato · ${weakestStockAgent.missingPublishBasicsCount + weakestStockAgent.distributionGapCount} fichas flojas`,
              }
            : null,
        },
        buyers: {
          activeDemand: activeDemandCount ?? 0,
          visitsNoOffer: visitsNoOfferCount ?? 0,
          liveOffers: liveOffersCount ?? 0,
          score: clampScore(
            40 +
              Math.min(activeDemandCount ?? 0, 20) * 2 +
              Math.min(liveOffersCount ?? 0, 8) * 5 -
              Math.min(visitsNoOfferCount ?? 0, 10) * 5,
          ),
          owner: weakestBuyerAgent
            ? {
                agentId: weakestBuyerAgent.user_id,
                name: weakestBuyerAgent.full_name || 'Sin nombre',
                reason: `${weakestBuyerAgent.summary.visitasSinOferta} visitas sin oferta · ${weakestBuyerAgent.summary.ofertasActivas} ofertas activas`,
              }
            : null,
        },
        focuses: summaries
          .map((agent) => {
            const stockRow = stockRows.find((row) => row.agentId === agent.user_id);
            return {
              agentId: agent.user_id,
              name: agent.full_name || 'Sin nombre',
              focus: getAgentCommercialFocus({
                availableCount: stockRow?.availableCount || 0,
                activeOffers: agent.summary.ofertasActivas,
                hotOpportunities: agent.summary.oportunidadesCalientes,
                visitsWithoutOffer: agent.summary.visitasSinOferta,
              }),
              autonomy: getAgentAutonomyStatus({
                focus: getAgentCommercialFocus({
                  availableCount: stockRow?.availableCount || 0,
                  activeOffers: agent.summary.ofertasActivas,
                  hotOpportunities: agent.summary.oportunidadesCalientes,
                  visitsWithoutOffer: agent.summary.visitasSinOferta,
                }).focus,
                availableCount: stockRow?.availableCount || 0,
                activeOffers: agent.summary.ofertasActivas,
                hotOpportunities: agent.summary.oportunidadesCalientes,
                visitsWithoutOffer: agent.summary.visitasSinOferta,
                touchesToday: agent.summary.toquesHorusHoy,
                touchTarget: agent.summary.targets.toques_horus_dia,
                captureVisitsWeek: agent.summary.citasSemana,
                captureVisitsTarget: agent.summary.targets.citas_semana,
                capturesMonth: agent.summary.captacionesMes,
                capturesTarget: agent.summary.targets.captaciones_mes,
              }),
            };
          })
          .sort((a, b) => {
            const bandWeight = { critico: 0, traccion: 1, optimo: 2, sobrecarga: 3 };
            const focusWeight = { captacion: 0, venta: 1, equilibrio: 2 };
            const bandDiff = bandWeight[a.focus.band] - bandWeight[b.focus.band];
            if (bandDiff !== 0) return bandDiff;
            return focusWeight[a.focus.focus] - focusWeight[b.focus.focus];
          }),
      };

      if (!cancelled) {
        setState(nextState);
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const diagnosis = useMemo(() => (state ? getOfficeDiagnosis(state) : null), [state]);
  const weakestBase = useMemo(() => (state ? getWeakBaseOwner(state) : null), [state]);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          Motor para vender viviendas
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          La oficina se sostiene sobre tres bases: actividad comercial, vendedores y compradores. Si una falla, se frena la venta.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading || !state || !diagnosis ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Lectura ejecutiva</p>
                  <p className="text-lg font-semibold">{diagnosis.title}</p>
                  <p className="text-sm text-muted-foreground">{diagnosis.detail}</p>
                </div>
                <div className="flex max-w-sm items-start gap-2 rounded-xl bg-background px-3 py-3 text-sm">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{diagnosis.action}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Actividad del equipo</p>
                    <p className="text-xs text-muted-foreground">Disciplina comercial y presión real</p>
                  </div>
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <p className={`mt-3 text-2xl font-bold ${tone(state.activity.score)}`}>{state.activity.score}</p>
                <Badge variant="outline" className="mt-2">{statusLabel(state.activity.score)}</Badge>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p>{state.activity.touchesGapAgents} agentes por debajo de toques</p>
                  <p>{state.activity.activeOffers} ofertas activas en juego</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Base vendedora</p>
                    <p className="text-xs text-muted-foreground">Stock sano, mandato y ficha publicable</p>
                  </div>
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <p className={`mt-3 text-2xl font-bold ${tone(state.sellers.score)}`}>{state.sellers.score}</p>
                <Badge variant="outline" className="mt-2">{statusLabel(state.sellers.score)}</Badge>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p>{state.sellers.available} inmuebles disponibles</p>
                  <p>{state.sellers.withoutMandate} con problema de mandato</p>
                  <p>{state.sellers.weakListing} con ficha o difusión floja</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Base compradora</p>
                    <p className="text-xs text-muted-foreground">Demanda viva, visitas y oferta</p>
                  </div>
                  <Handshake className="h-5 w-5 text-primary" />
                </div>
                <p className={`mt-3 text-2xl font-bold ${tone(state.buyers.score)}`}>{state.buyers.score}</p>
                <Badge variant="outline" className="mt-2">{statusLabel(state.buyers.score)}</Badge>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <p>{state.buyers.activeDemand} compradores activos</p>
                  <p>{state.buyers.visitsNoOffer} visitas sin oferta</p>
                  <p>{state.buyers.liveOffers} ofertas vivas</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/team?tab=tracking">Ver equipo</Link>
              </Button>
              {state.focuses[0] ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/admin/team?tab=tracking&agent=${state.focuses[0].agentId}`}>Ver foco prioritario</Link>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="outline">
                <Link to="/properties">Ver vendedores</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/matches">Ver compradores</Link>
              </Button>
            </div>

            <div className="rounded-xl border border-border/60 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Foco por agente</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {state.focuses.slice(0, 3).map((item) => (
                  <Link
                    key={item.agentId}
                    to={`/admin/team?tab=tracking&agent=${item.agentId}`}
                    className="rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/35"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{item.name}</p>
                      <div className="flex gap-2">
                        <Badge variant="outline">{item.focus.focus}</Badge>
                        <Badge variant="outline">{item.autonomy.level}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-medium">{item.focus.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.focus.detail}</p>
                    <p className="mt-2 text-xs text-foreground">{item.focus.action}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{item.autonomy.reward}</p>
                  </Link>
                ))}
              </div>
            </div>

            {weakestBase?.owner ? (
              <div className="rounded-xl border border-border/60 bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Responsable a mirar primero</p>
                <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-base font-semibold">{weakestBase.owner.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Más conectado ahora mismo al cuello de {weakestBase.label.toLowerCase()}.
                    </p>
                    <p className="text-sm mt-1">{weakestBase.owner.reason}</p>
                  </div>
                  <Button asChild size="sm">
                    <Link to={`/admin/team?tab=tracking&agent=${weakestBase.owner.agentId}`}>Abrir seguimiento del agente</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminCommercialEngine;
