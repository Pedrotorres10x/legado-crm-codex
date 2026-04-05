import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Landmark, Megaphone, ShieldAlert, Signature, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getAnnualTargetToDate, getTeamKpiSummaries } from '@/lib/agent-kpis';
import { buildClosingOperationalBlockers } from '@/lib/closing-ops';
import { useWebLeads } from '@/hooks/useWebLeadsData';
import { buildTopReasons, extractMatchDiscardReason, extractOfferLossReason, getCommercialSuggestion } from '@/lib/commercial-loss-reasons';

type AgentProfile = {
  user_id: string;
  full_name: string | null;
};
type ClosingPropertyRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  agent_id?: string | null;
  reservation_date?: string | null;
  reservation_amount?: number | null;
  arras_status?: string | null;
  arras_date?: string | null;
  arras_amount?: number | null;
  arras_buyer_id?: string | null;
  deed_date?: string | null;
  deed_notary?: string | null;
};
type PropertyDocumentRow = {
  doc_type?: string | null;
};
type SignatureDocumentRow = {
  generated_contracts?: {
    signature_status?: string | null;
  } | null;
};
type NotesRow = {
  notes?: string | null;
};

type ExecutiveState = {
  agentsNeedingHelp: number;
  touchesLagging: number;
  inboundLagging: number;
  blockedClosings: number;
  legalHigh: number;
  pendingSignatures: number;
  topMatchLossReason: string | null;
  topOfferLossReason: string | null;
  watchlist: Array<{
    agentId: string;
    name: string;
    reason: string;
    severity: 'alta' | 'media';
  }>;
};

const emptyState: ExecutiveState = {
  agentsNeedingHelp: 0,
  touchesLagging: 0,
  inboundLagging: 0,
  blockedClosings: 0,
  legalHigh: 0,
  pendingSignatures: 0,
  topMatchLossReason: null,
  topOfferLossReason: null,
  watchlist: [],
};

const AdminExecutiveSummary = () => {
  const navigate = useNavigate();
  const { data: leads = [] } = useWebLeads();
  const [state, setState] = useState<ExecutiveState>(emptyState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [{ data: profiles }, { count: legalHighCount }, { data: closingRows }, { data: matchLosses }, { data: offerLosses }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').order('full_name'),
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('legal_risk_level', 'alto'),
        supabase
          .from('properties')
          .select('id, title, status, agent_id, reservation_date, reservation_amount, arras_status, arras_date, arras_amount, arras_buyer_id, deed_date, deed_notary')
          .or('reservation_date.not.is.null,arras_status.neq.sin_arras,deed_date.not.is.null,status.eq.arras,status.eq.reservado')
          .limit(30),
        supabase.from('matches').select('notes').eq('status', 'descartado'),
        supabase.from('offers').select('notes').in('status', ['rechazada', 'retirada', 'expirada']),
      ]);

      const agents = ((profiles || []) as AgentProfile[]).filter((agent) => agent.full_name);
      const { summaries } = await getTeamKpiSummaries(agents);
      const inboundByAgent = leads.reduce((map, lead) => {
        if (!lead.agent_id) return map;
        const current = map.get(lead.agent_id) ?? 0;
        map.set(lead.agent_id, current + (lead.needs_follow_up ? 1 : 0));
        return map;
      }, new Map<string, number>());
      const watchlist = summaries
        .map(({ user_id, full_name, summary }) => {
          const issues: string[] = [];
          let severity: 'alta' | 'media' = 'media';
          const annualSalesPace = getAnnualTargetToDate(summary.targets.ventas_ano);

          if (summary.toquesHorusHoy < summary.targets.toques_horus_dia) {
            issues.push(`toques ${summary.toquesHorusHoy}/${summary.targets.toques_horus_dia}`);
          }
          if (summary.citasSemana < summary.targets.citas_semana) {
            issues.push(`visitas ${summary.citasSemana}/${summary.targets.citas_semana}`);
          }
          if (summary.captacionesMes < summary.targets.captaciones_mes) {
            issues.push(`captaciones ${summary.captacionesMes}/${summary.targets.captaciones_mes}`);
          }
          if (summary.ventasAno < annualSalesPace) {
            issues.push(`arras ${summary.ventasAno}/${summary.targets.ventas_ano} (ritmo ${annualSalesPace})`);
          }
          const inboundPending = inboundByAgent.get(user_id) ?? 0;
          if (inboundPending >= 2) {
            issues.push(`inbound ${inboundPending} sin seguir`);
          }

          const missedGoals = issues.length;
          if (missedGoals >= 3) severity = 'alta';

          return {
            agentId: user_id,
            name: full_name || 'Sin nombre',
            reason: issues.join(' · '),
            severity,
            missedGoals,
          };
        })
        .filter((item) => item.missedGoals >= 2)
        .sort((a, b) => b.missedGoals - a.missedGoals)
        .slice(0, 5)
        .map(({ missedGoals, ...item }) => item);

      const closingItems = await Promise.all(((closingRows || []) as ClosingPropertyRow[]).map(async (property) => {
        const [docsRes, signaturesRes, ownersRes] = await Promise.all([
          supabase.from('property_documents').select('doc_type').eq('property_id', property.id),
          supabase
            .from('documents')
            .select('generated_contracts(signature_status), document_properties!inner(property_id)')
            .eq('document_properties.property_id', property.id),
          supabase.from('property_owners').select('id', { count: 'exact', head: true }).eq('property_id', property.id),
        ]);

        const uploadedDocTypes = Array.from(new Set(((docsRes.data || []) as PropertyDocumentRow[]).map((doc) => doc.doc_type).filter(Boolean)));
        const pendingSignatureCount = ((signaturesRes.data || []) as SignatureDocumentRow[])
          .filter((doc) => doc.generated_contracts?.signature_status === 'pendiente')
          .length;

        const analysis = buildClosingOperationalBlockers({
          property,
          propertyOwnerCount: ownersRes.count || 0,
          uploadedDocTypes,
          pendingSignatureCount,
        });

        return {
          blockers: analysis.blockers,
          pendingSignatureCount,
        };
      }));

      const nextState: ExecutiveState = {
        agentsNeedingHelp: watchlist.length,
        touchesLagging: summaries.filter(({ summary }) => summary.toquesHorusHoy < summary.targets.toques_horus_dia).length,
        inboundLagging: Array.from(inboundByAgent.values()).filter((count) => count >= 2).length,
        blockedClosings: closingItems.filter((item) => item.blockers.length > 0).length,
        legalHigh: legalHighCount ?? 0,
        pendingSignatures: closingItems.reduce((sum, item) => sum + item.pendingSignatureCount, 0),
        topMatchLossReason: buildTopReasons(((matchLosses || []) as NotesRow[]).map((row) => extractMatchDiscardReason(row.notes)))[0]?.[0] || null,
        topOfferLossReason: buildTopReasons(((offerLosses || []) as NotesRow[]).map((row) => extractOfferLossReason(row.notes)))[0]?.[0] || null,
        watchlist,
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
  }, [leads]);

  const openAgentBoard = useCallback((agentId?: string) => {
    navigate(agentId ? `/admin?agent=${agentId}#admin-kpi-board` : '/admin#admin-kpi-board');
  }, [navigate]);

  const openOperations = useCallback((params?: { preset?: 'all' | 'legal' | 'closing'; agentId?: string; kind?: 'all' | 'legal' | 'closing' | 'signature' | 'deed' | 'task' }) => {
    const next = new URLSearchParams();
    if (params?.preset && params.preset !== 'all') next.set('preset', params.preset);
    if (params?.kind && params.kind !== 'all') next.set('kind', params.kind);
    if (params?.agentId) next.set('agent', params.agentId);
    const query = next.toString();
    navigate(query ? `/operations?${query}` : '/operations');
  }, [navigate]);

  const openLegalRadar = useCallback(() => {
    navigate('/admin#admin-legal-radar');
  }, [navigate]);

  const openClosingRadar = useCallback(() => {
    navigate('/admin#admin-closing-radar');
  }, [navigate]);

  const executiveCards = useMemo(() => [
    {
      label: 'Agentes a apoyar',
      value: state.agentsNeedingHelp,
      icon: Target,
      tone: 'bg-primary/10 text-primary',
      action: () => openAgentBoard(),
      actionLabel: 'Ver KPI',
      secondaryAction: () => openOperations({ preset: 'all' }),
      secondaryLabel: 'Ir a operaciones',
    },
    {
      label: 'Toques por debajo',
      value: state.touchesLagging,
      icon: AlertTriangle,
      tone: 'bg-amber-100 text-amber-700',
      action: () => openAgentBoard(),
      actionLabel: 'Ver equipo',
      secondaryAction: () => openOperations({ preset: 'all' }),
      secondaryLabel: 'Operaciones',
    },
    {
      label: 'Inbound sin trabajar',
      value: state.inboundLagging,
      icon: Megaphone,
      tone: 'bg-violet-100 text-violet-700',
      action: () => navigate('/web-leads'),
      actionLabel: 'Ver inbound',
      secondaryAction: () => openOperations({ kind: 'lead' }),
      secondaryLabel: 'Ir a operaciones',
    },
    {
      label: 'Cierres bloqueados',
      value: state.blockedClosings,
      icon: Landmark,
      tone: 'bg-rose-100 text-rose-700',
      action: () => openClosingRadar(),
      actionLabel: 'Ver cierre',
      secondaryAction: () => openOperations({ preset: 'closing' }),
      secondaryLabel: 'Ir a operaciones',
    },
    {
      label: 'Legal alto + firmas',
      value: state.legalHigh + state.pendingSignatures,
      icon: ShieldAlert,
      tone: 'bg-sky-100 text-sky-700',
      action: () => openLegalRadar(),
      actionLabel: 'Ver legal',
      secondaryAction: () => openOperations({ preset: 'legal' }),
      secondaryLabel: 'Ir a operaciones',
    },
  ], [navigate, openAgentBoard, openClosingRadar, openLegalRadar, openOperations, state]);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resumen ejecutivo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {executiveCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-border/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
                    <p className="text-3xl font-semibold mt-1">{loading ? '...' : card.value}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" className="px-0 h-auto" onClick={card.action}>
                    {card.actionLabel}
                    <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7" onClick={card.secondaryAction}>
                    {card.secondaryLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border/50 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-medium">Watchlist del equipo</p>
              <p className="text-xs text-muted-foreground">Solo agentes con varias desviaciones para no saturar.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => openAgentBoard()}>
              Abrir panel
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Preparando resumen del equipo...</p>
          ) : state.watchlist.length === 0 ? (
            <p className="text-sm text-emerald-700">No hay agentes con desviaciones fuertes ahora mismo.</p>
          ) : (
            <div className="space-y-2">
              {state.watchlist.map((item) => (
                <button
                  key={item.agentId}
                  type="button"
                  className="w-full rounded-lg border px-3 py-3 text-left hover:bg-accent/40 transition-colors"
                  onClick={() => openAgentBoard(item.agentId)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                    </div>
                    <Badge variant={item.severity === 'alta' ? 'destructive' : 'secondary'}>
                      {item.severity === 'alta' ? 'Prioridad alta' : 'Vigilar'}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="gap-1">
              <ShieldAlert className="h-3 w-3" />
              Legal alto: {loading ? '...' : state.legalHigh}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Signature className="h-3 w-3" />
              Firmas pendientes: {loading ? '...' : state.pendingSignatures}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => openOperations({ preset: 'all' })}>
              Abrir operaciones
            </Button>
          </div>
          {(!loading && (state.topMatchLossReason || state.topOfferLossReason)) && (
            <div className="mt-3 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                Fricción comercial dominante:
                {' '}
                <span className="text-foreground">
                  cruces {state.topMatchLossReason || 'sin patrón'}
                </span>
                {' · '}
                <span className="text-foreground">
                  ofertas {state.topOfferLossReason || 'sin patrón'}
                </span>
              </p>
              <p className="mt-1">
                Siguiente paso sugerido:{' '}
                <span className="text-foreground">
                  {getCommercialSuggestion(state.topOfferLossReason || state.topMatchLossReason) || 'Revisar oportunidades caídas y ajustar criterio comercial.'}
                </span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminExecutiveSummary;
