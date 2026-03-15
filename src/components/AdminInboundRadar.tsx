import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Megaphone, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWebLeads } from '@/hooks/useWebLeadsData';
import { useWebLeadsMetrics } from '@/hooks/useWebLeadsMetrics';
import { supabase } from '@/integrations/supabase/client';

type AgentProfile = {
  user_id: string;
  full_name: string | null;
};

type AgentInboundRow = {
  agentId: string;
  name: string;
  total: number;
  withTasks: number;
  withVisits: number;
  withOffers: number;
  needsFollowUp: number;
  discarded: number;
  topLossReason: { label: string; count: number } | null;
  taskRate: number;
  visitRate: number;
  offerRate: number;
};

const AdminInboundRadar = () => {
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useWebLeads();
  const [agentMap, setAgentMap] = useState<Map<string, string>>(new Map());

  const metrics = useWebLeadsMetrics({
    days: 30,
    pageviews: [],
    allPageviews: [],
    leads,
  });

  useEffect(() => {
    let cancelled = false;

    const loadProfiles = async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').order('full_name');
      if (cancelled) return;
      const nextMap = new Map<string, string>();
      ((data || []) as AgentProfile[]).forEach((profile) => {
        if (profile.user_id) {
          nextMap.set(profile.user_id, profile.full_name || 'Sin nombre');
        }
      });
      setAgentMap(nextMap);
    };

    loadProfiles();

    return () => {
      cancelled = true;
    };
  }, []);

  const agentRows = useMemo<AgentInboundRow[]>(() => {
    const grouped = new Map<string, typeof leads>();

    leads
      .filter((lead) => lead.agent_id)
      .forEach((lead) => {
        const key = lead.agent_id as string;
        const bucket = grouped.get(key) ?? [];
        bucket.push(lead);
        grouped.set(key, bucket);
      });

    return Array.from(grouped.entries())
      .map(([agentId, agentLeads]) => {
        const total = agentLeads.length;
        const withTasks = agentLeads.filter((lead) => lead.open_task_count > 0).length;
        const withVisits = agentLeads.filter((lead) => lead.visit_count > 0).length;
        const withOffers = agentLeads.filter((lead) => lead.offer_count > 0).length;
        const needsFollowUp = agentLeads.filter((lead) => lead.needs_follow_up).length;
        const discarded = agentLeads.filter((lead) => lead.is_discarded).length;
        const lossReasonCounts = agentLeads
          .filter((lead) => lead.is_discarded && lead.loss_reason)
          .reduce((acc, lead) => {
            const key = lead.loss_reason as string;
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        const topLossReason = Object.entries(lossReasonCounts).sort((a, b) => b[1] - a[1])[0] ?? null;

        return {
          agentId,
          name: agentMap.get(agentId) || 'Agente asignado',
          total,
          withTasks,
          withVisits,
          withOffers,
          needsFollowUp,
          discarded,
          topLossReason: topLossReason ? { label: topLossReason[0], count: topLossReason[1] } : null,
          taskRate: total > 0 ? Math.round((withTasks / total) * 100) : 0,
          visitRate: total > 0 ? Math.round((withVisits / total) * 100) : 0,
          offerRate: total > 0 ? Math.round((withOffers / total) * 100) : 0,
        };
      })
      .sort((a, b) => {
        if (b.offerRate !== a.offerRate) return b.offerRate - a.offerRate;
        if (a.needsFollowUp !== b.needsFollowUp) return a.needsFollowUp - b.needsFollowUp;
        return b.total - a.total;
      })
      .slice(0, 5);
  }, [agentMap, leads]);

  const worstFollowUp = useMemo(() => {
    return [...agentRows]
      .sort((a, b) => {
        if (b.needsFollowUp !== a.needsFollowUp) return b.needsFollowUp - a.needsFollowUp;
        return b.total - a.total;
      })
      .slice(0, 3);
  }, [agentRows]);

  const weakestChannel = useMemo(() => {
    return [...metrics.channelFunnel]
      .filter((channel) => channel.total > 0)
      .sort((a, b) => {
        if (a.offerRate !== b.offerRate) return a.offerRate - b.offerRate;
        return b.needsFollowUp - a.needsFollowUp;
      })[0] ?? null;
  }, [metrics.channelFunnel]);

  const topLossReason = metrics.topLossReasons[0] ?? null;

  return (
    <Card id="admin-inbound-radar" className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-5 w-5 text-primary" />
              Radar inbound
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Calidad del lead por canal y qué agente está convirtiendo mejor el inbound que le entra.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/web-leads">
              Abrir WebLeads
              <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando radar inbound...</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Canal a vigilar</p>
                {weakestChannel ? (
                  <>
                    <p className="mt-1 text-sm font-semibold">
                      {weakestChannel.label} · {weakestChannel.offerRate}% lead - oferta
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {weakestChannel.needsFollowUp} sin seguir y {weakestChannel.discarded} descartados en el periodo.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Todavía no hay volumen suficiente para comparar canales.</p>
                )}
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Motivo de pérdida dominante</p>
                {topLossReason ? (
                  <>
                    <p className="mt-1 text-sm font-semibold">{topLossReason[0]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{topLossReason[1]} lead{topLossReason[1] === 1 ? '' : 's'} descartado{topLossReason[1] === 1 ? '' : 's'} con ese motivo.</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Todavía no hay descartes suficientes para detectar un patrón.</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {metrics.channelFunnel.map((channel) => (
                <div key={channel.id} className="rounded-xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{channel.label}</p>
                      <p className="text-xs text-muted-foreground">{channel.total} leads</p>
                    </div>
                    <Badge variant={channel.needsFollowUp > 0 ? 'destructive' : 'secondary'}>
                      {channel.needsFollowUp} sin seguir
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="text-sm font-bold">{channel.taskRate}%</div>
                      <div className="text-[10px] text-muted-foreground">tarea</div>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="text-sm font-bold">{channel.visitRate}%</div>
                      <div className="text-[10px] text-muted-foreground">visita</div>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="text-sm font-bold">{channel.offerRate}%</div>
                      <div className="text-[10px] text-muted-foreground">oferta</div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{channel.withTasks} con tarea abierta</p>
                    <p>{channel.withVisits} con visita</p>
                    <p>{channel.withOffers} con oferta</p>
                    <p>{channel.discarded} descartados{channel.topLossReason ? ` · motivo top: ${channel.topLossReason.label}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/50 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-primary" />
                    Conversión inbound por agente
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vista corta para saber quién convierte mejor el inbound y quién está acumulando leads sin trabajar.
                  </p>
                </div>
                {worstFollowUp[0] ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/operations?kind=lead&agent=${worstFollowUp[0].agentId}`)}
                  >
                    Ver leads pendientes
                  </Button>
                ) : null}
              </div>

              {agentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay inbound asignado a agentes.</p>
              ) : (
                <div className="space-y-2">
                  {agentRows.map((row) => (
                    <div key={row.agentId} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{row.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.total} leads · {row.withTasks} con tarea · {row.withVisits} con visita · {row.withOffers} con oferta
                          </p>
                          {row.discarded > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {row.discarded} descartados{row.topLossReason ? ` · motivo top: ${row.topLossReason.label}` : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={row.needsFollowUp > 0 ? 'destructive' : 'secondary'}>
                            {row.needsFollowUp} sin seguir
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => navigate(`/operations?kind=lead&agent=${row.agentId}`)}
                          >
                            Operaciones
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-sm font-bold">{row.taskRate}%</div>
                          <div className="text-[10px] text-muted-foreground">lead - tarea</div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-sm font-bold">{row.visitRate}%</div>
                          <div className="text-[10px] text-muted-foreground">lead - visita</div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-sm font-bold">{row.offerRate}%</div>
                          <div className="text-[10px] text-muted-foreground">lead - oferta</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminInboundRadar;
