import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { getTeamKpiSummaries } from '@/lib/agent-kpis';
import { getAgentRecordRichness } from '@/lib/agent-record-richness';
import { getAgentViabilitySignal } from '@/lib/agent-viability';
import { getAgentOnboardingStage } from '@/lib/agent-onboarding';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type AgentProfile = {
  user_id: string;
  full_name: string | null;
  created_at?: string | null;
};

type PropertyRow = {
  agent_id: string | null;
  status?: string | null;
  title?: string | null;
  price?: number | null;
  address?: string | null;
  city?: string | null;
  description?: string | null;
  images?: string[] | null;
  videos?: string[] | null;
  virtual_tour_url?: string | null;
  reference?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  surface_area?: number | null;
  mandate_type?: string | null;
};

type PropertyRichnessRow = Pick<
  Database['public']['Tables']['properties']['Row'],
  'agent_id' | 'status' | 'title' | 'price' | 'address' | 'city' | 'description' | 'images' | 'videos' | 'virtual_tour_url' | 'reference' | 'bedrooms' | 'bathrooms' | 'surface_area' | 'mandate_type'
>;

type Row = {
  agentId: string;
  name: string;
  signal: ReturnType<typeof getAgentViabilitySignal>;
  onboarding: ReturnType<typeof getAgentOnboardingStage>;
  summary: Awaited<ReturnType<typeof getTeamKpiSummaries>>['summaries'][number]['summary'];
  availableStock: number;
  richnessScore: number;
};

const toneMap = {
  rojo: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: ShieldAlert,
  },
  amarillo: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: ShieldQuestion,
  },
  verde: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: ShieldCheck,
  },
};

const AdminAgentViability = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [{ data: profiles }, { data: properties }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, created_at').order('full_name'),
        supabase
          .from('properties')
          .select(
            'agent_id, status, title, price, address, city, description, images, videos, virtual_tour_url, reference, bedrooms, bathrooms, surface_area, mandate_type',
          ),
      ]);

      const agents = ((profiles || []) as AgentProfile[]).filter((profile) => profile.full_name);
      const propertyRows = ((properties as PropertyRichnessRow[] | null) || []) as PropertyRow[];
      const { summaries } = await getTeamKpiSummaries(agents);

      const nextRows = summaries
        .map((agent) => {
          const agentProperties = propertyRows.filter((property) => property.agent_id === agent.user_id);
          const richness = getAgentRecordRichness(agentProperties);
          const availableStock = agentProperties.filter((property) => property.status === 'disponible').length;
          const signal = getAgentViabilitySignal({
            touchesToday: agent.summary.toquesHorusHoy,
            touchTarget: agent.summary.targets.toques_horus_dia,
            captureVisitsWeek: agent.summary.citasSemana,
            captureVisitsTarget: agent.summary.targets.citas_semana,
            capturesMonth: agent.summary.captacionesMes,
            capturesTarget: agent.summary.targets.captaciones_mes,
            availableStock,
            richnessScore: richness.averageScore,
          });
          const onboarding = getAgentOnboardingStage({
            createdAt: agent.created_at,
            touchesToday: agent.summary.toquesHorusHoy,
            touchTarget: agent.summary.targets.toques_horus_dia,
            captureVisitsWeek: agent.summary.citasSemana,
            captureVisitsTarget: agent.summary.targets.citas_semana,
            capturesMonth: agent.summary.captacionesMes,
            availableStock,
            richnessScore: richness.averageScore,
          });

          return {
            agentId: agent.user_id,
            name: agent.full_name || 'Sin nombre',
            signal,
            onboarding,
            summary: agent.summary,
            availableStock,
            richnessScore: richness.averageScore,
          };
        })
        .sort((a, b) => {
          const weight = { rojo: 0, amarillo: 1, verde: 2 };
          const diff = weight[a.signal.level] - weight[b.signal.level];
          if (diff !== 0) return diff;
          return a.richnessScore - b.richnessScore;
        });

      if (!cancelled) {
        setRows(nextRows);
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Viabilidad comercial temprana
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          En una semana ya deberías ver si el agente está entrando en método o si sigue en plantilla por pura inercia.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                La regla es simple: un agente que no entra en ritmo de <span className="font-medium text-foreground">toques, visitas de captación, producto trabajado y disciplina Horus</span>
                {' '}lo tendrá muy difícil para captar y vender bien. Aquí no estás midiendo simpatía ni paciencia: estás midiendo si arranca el motor comercial.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.slice(0, 6).map((row) => {
                const tone = toneMap[row.signal.level];
                const Icon = tone.icon;

                return (
                  <div key={row.agentId} className="rounded-xl border border-border/60 bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{row.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                          {row.summary.toquesHorusHoy}/{row.summary.targets.toques_horus_dia} toques hoy · {row.summary.citasSemana}/{row.summary.targets.citas_semana} visitas captación
                        </p>
                      </div>
                      <Badge variant="outline" className={tone.badge}>
                        <Icon className="mr-1 h-3 w-3" />
                        {row.signal.label}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <p>{row.summary.captacionesMes}/{row.summary.targets.captaciones_mes} captaciones este mes</p>
                      <p>{row.availableStock} inmuebles disponibles</p>
                      <p>Calidad media de ficha: {row.richnessScore}/100</p>
                    </div>

                    <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Onboarding {row.onboarding.weekLabel}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{row.onboarding.detail}</p>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">{row.signal.detail}</p>
                    <p className="mt-2 text-sm">{row.signal.action}</p>

                    <div className="mt-4 flex justify-end">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/team?tab=tracking&agent=${row.agentId}`}>
                          Abrir seguimiento <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAgentViability;
