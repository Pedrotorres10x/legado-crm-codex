import { useEffect, useMemo, useState } from 'react';
import { Award, Building2, Euro, PhoneCall, Users } from 'lucide-react';
import { subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { countCaptureInterviews, countHorusTouches } from '@/lib/horus-model';
import type { HorusInteractionLike } from '@/lib/horus-model';

type Props = {
  currentAgentId?: string;
};

type AgentProfile = {
  user_id: string;
  full_name: string | null;
};

type MetricKey = 'toques' | 'visitasCaptacion' | 'captaciones' | 'arras';

type AgentMetricRow = {
  agentId: string;
  name: string;
  toques: number;
  visitasCaptacion: number;
  captaciones: number;
  arras: number;
};

type InteractionMetricRow = HorusInteractionLike & {
  agent_id: string | null;
  interaction_date: string;
};

type PropertyMetricRow = {
  agent_id: string | null;
  created_at: string;
  arras_status: string | null;
  arras_date: string | null;
};

type UserRoleRow = {
  user_id: string;
};

const metricConfig: Record<MetricKey, { label: string; icon: typeof PhoneCall; helper: string }> = {
  toques: {
    label: 'Mas toques',
    icon: PhoneCall,
    helper: 'disciplina comercial',
  },
  visitasCaptacion: {
    label: 'Mas visitas captacion',
    icon: Users,
    helper: 'actividad que abre mandatos',
  },
  captaciones: {
    label: 'Mas exclusivas',
    icon: Building2,
    helper: 'producto nuevo en cartera',
  },
  arras: {
    label: 'Mas arras',
    icon: Euro,
    helper: 'resultado firmado',
  },
};

const buildCompetitionRows = (
  profiles: AgentProfile[],
  interactions: InteractionMetricRow[],
  properties: PropertyMetricRow[],
  start: Date,
  now: Date,
): AgentMetricRow[] =>
  profiles.map((profile) => {
    const agentInteractions = interactions.filter((interaction) => interaction.agent_id === profile.user_id);
    const agentProperties = properties.filter((property) => property.agent_id === profile.user_id);

    const captaciones = agentProperties.filter((property) => new Date(property.created_at) >= start).length;
    const arras = agentProperties.filter((property) =>
      property.arras_status === 'firmado' &&
      property.arras_date &&
      new Date(property.arras_date) >= start &&
      new Date(property.arras_date) <= now,
    ).length;

    return {
      agentId: profile.user_id,
      name: profile.full_name || 'Sin nombre',
      toques: countHorusTouches(agentInteractions),
      visitasCaptacion: countCaptureInterviews(agentInteractions),
      captaciones,
      arras,
    };
  });

const AgentCompetitionCard = ({ currentAgentId }: Props) => {
  const [rows, setRows] = useState<AgentMetricRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const now = new Date();
      const start = subMonths(now, 3);
      const startISO = start.toISOString();

      const [{ data: roles }, { data: profiles }, { data: interactions }, { data: properties }] = await Promise.all([
        supabase.from('user_roles').select('user_id').eq('role', 'agent'),
        supabase.from('profiles').select('user_id, full_name').order('full_name'),
        supabase
          .from('interactions')
          .select('agent_id, interaction_type, interaction_date, contact_id, property_id')
          .gte('interaction_date', startISO),
        supabase
          .from('properties')
          .select('agent_id, created_at, arras_status, arras_date'),
      ]);

      if (cancelled) return;

      const roleIds = new Set(((roles ?? []) as UserRoleRow[]).map((role) => role.user_id));
      const agentProfiles = ((profiles as AgentProfile[]) || []).filter((profile) => roleIds.has(profile.user_id));

      setRows(
        buildCompetitionRows(
          agentProfiles,
          (interactions ?? []) as InteractionMetricRow[],
          (properties ?? []) as PropertyMetricRow[],
          start,
          now,
        ),
      );
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const leaderboards = useMemo(
    () =>
      (Object.keys(metricConfig) as MetricKey[]).map((metric) => {
        const ranked = [...rows]
          .sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name))
          .filter((row) => row[metric] > 0);

        const topRows = ranked.slice(0, 3);
        const currentRow = currentAgentId ? ranked.find((row) => row.agentId === currentAgentId) : null;
        const currentInTop = currentRow ? topRows.some((row) => row.agentId === currentRow.agentId) : false;

        return {
          metric,
          config: metricConfig[metric],
          ranked,
          rows: currentRow && !currentInTop ? [...topRows, currentRow] : topRows,
          currentPosition: currentRow ? ranked.findIndex((row) => row.agentId === currentRow.agentId) + 1 : null,
          totalAgents: ranked.length,
        };
      }),
    [currentAgentId, rows],
  );

  if (loading) {
    return <Skeleton className="h-[420px] rounded-xl" />;
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-5 w-5 text-primary" />
          Ranking de oficina
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">
            Solo cuatro marcadores para que la competencia empuje donde interesa de verdad: disciplina, captacion, exclusivas y arras.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {leaderboards.map(({ metric, config, ranked, rows: leaderboardRows, currentPosition, totalAgents }) => {
            const Icon = config.icon;
            return (
              <div key={metric} className="rounded-xl border border-border/60 bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4 text-primary" />
                      {config.label}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{config.helper}</p>
                  </div>
                  {currentPosition ? (
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                      Puesto {currentPosition}/{Math.max(totalAgents, 1)}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-4 space-y-2">
                  {leaderboardRows.length > 0 ? (
                    leaderboardRows.map((row, index) => {
                      const highlighted = row.agentId === currentAgentId;
                      const position = ranked.findIndex((rankedRow) => rankedRow.agentId === row.agentId) + 1;
                      return (
                        <div
                          key={`${metric}-${row.agentId}`}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                            highlighted ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-muted/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-semibold">
                              {position}
                            </div>
                            <span className="font-medium">{row.name}</span>
                            {highlighted ? (
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                Tú
                              </Badge>
                            ) : null}
                          </div>
                          <span className="font-semibold">{row[metric]}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">Todavía no hay movimiento suficiente para comparar esta métrica.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentCompetitionCard;
