import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { buildAgentEvaluation, statusTone } from '@/lib/agent-evaluation';
import { getAgentInfluenceCircle } from '@/lib/agent-influence-circle';
import { countCaptureInterviews, countHorusTouches, DEFAULT_HORUS_WEIGHTS } from '@/lib/horus-model';
import type { PerformanceData } from '@/hooks/useAgentPerformance';

type AgentProfile = {
  user_id: string;
  full_name: string | null;
};

type EvaluationRow = {
  agentId: string;
  name: string;
  evaluation: ReturnType<typeof buildAgentEvaluation>;
};

const verdictWeight = {
  mal: 0,
  atencion: 1,
  bien: 2,
} as const;

const AdminAgentEvaluationOverview = () => {
  const [rows, setRows] = useState<EvaluationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const now = new Date();
      const start = subMonths(now, 3);
      const startISO = start.toISOString();

      const [{ data: roles }, { data: profiles }, { data: interactions }, { data: contacts }, { data: properties }, { data: visits }, { data: offers }] =
        await Promise.all([
          supabase.from('user_roles').select('user_id').eq('role', 'agent'),
          supabase.from('profiles').select('user_id, full_name').order('full_name'),
          supabase
            .from('interactions')
            .select('agent_id, interaction_type, interaction_date, contact_id, property_id')
            .gte('interaction_date', startISO),
          supabase
            .from('contacts')
            .select('agent_id, status, updated_at, contact_type, tags, source_ref'),
          supabase
            .from('properties')
            .select('agent_id, created_at, arras_status, arras_date, status'),
          supabase
            .from('visits')
            .select('agent_id, result')
            .lte('visit_date', now.toISOString()),
          supabase.from('offers').select('agent_id, status'),
        ]);

      if (cancelled) return;

      const roleIds = new Set(((roles as any[]) || []).map((role) => role.user_id));
      const agentProfiles = ((profiles as AgentProfile[]) || []).filter((profile) => roleIds.has(profile.user_id) && profile.full_name);

      const nextRows = agentProfiles
        .map((profile) => {
          const agentInteractions = ((interactions as any[]) || []).filter((interaction) => interaction.agent_id === profile.user_id);
          const agentContacts = ((contacts as any[]) || []).filter((contact) => contact.agent_id === profile.user_id);
          const agentProperties = ((properties as any[]) || []).filter((property) => property.agent_id === profile.user_id);
          const agentVisits = ((visits as any[]) || []).filter((visit) => visit.agent_id === profile.user_id);
          const agentOffers = ((offers as any[]) || []).filter((offer) => offer.agent_id === profile.user_id);

          const toquesCount = countHorusTouches(agentInteractions);
          const entrevistasCount = countCaptureInterviews(agentInteractions);
          const captacionesCount = agentProperties.filter((property) => new Date(property.created_at) >= start).length;
          const facturacionCount = agentProperties.filter((property) =>
            property.arras_status === 'firmado' &&
            property.arras_date &&
            new Date(property.arras_date) >= start &&
            new Date(property.arras_date) <= now,
          ).length;
          const availableStockCount = agentProperties.filter((property) => property.status === 'disponible').length;

          const activeContacts = agentContacts.filter((contact) => ['nuevo', 'en_seguimiento', 'activo'].includes(contact.status));
          const health = { green: 0, yellow: 0, orange: 0, red: 0, total: activeContacts.length };
          activeContacts.forEach((contact) => {
            const days = Math.floor((now.getTime() - new Date(contact.updated_at).getTime()) / 86400000);
            if (days <= 90) health.green += 1;
            else if (days <= 120) health.yellow += 1;
            else if (days <= 180) health.orange += 1;
            else health.red += 1;
          });

          const data: PerformanceData = {
            periodMonths: 3,
            periodLabel: 'Últimos 3 meses',
            toques: 0,
            entrevistas: 0,
            captaciones: 0,
            facturacion: 0,
            toquesCount,
            entrevistasCount,
            captacionesCount,
            facturacionCount,
            availableStockCount,
            llamadasCount: agentInteractions.filter((interaction) => interaction.interaction_type === 'llamada').length,
            buyerVisitsCount: agentVisits.filter((visit) => {
              const result = visit.result || '';
              return ['seguimiento', 'segunda_visita', 'realizada', 'oferta', 'reserva'].includes(result);
            }).length,
            toquesTarget: 4 * 22 * 3,
            entrevistasTarget: 2 * 4 * 3,
            captacionesTarget: 2 * 3,
            facturacionTarget: Number(((10 / 12) * 3).toFixed(1)),
            totalPoints: 0,
            averagePoints: 0,
            rollingTarget: 500,
            quarterlyTarget: 1500,
            monthlyBreakdown: [],
            pipeline: {},
            health,
            funnel: [],
            conversion: {
              llamadasToCaptacionVisitsRate: 0,
              captacionVisitsToExclusiveRate: 0,
              exclusivesToArrasRate: 0,
              buyerVisitsPerArras: null,
            },
            weights: DEFAULT_HORUS_WEIGHTS,
          };

          const extra = {
            activeOffers: agentOffers.filter((offer) => ['presentada', 'contraoferta', 'aceptada'].includes(offer.status)).length,
            hotOpportunities: agentVisits.filter((visit) => ['oferta', 'reserva'].includes(visit.result || '')).length,
            visitsWithoutOffer: agentVisits.filter((visit) => ['seguimiento', 'segunda_visita', 'realizada'].includes(visit.result || '')).length,
          };

          const influenceTotal = getAgentInfluenceCircle(agentContacts as any[]).total;

          return {
            agentId: profile.user_id,
            name: profile.full_name || 'Sin nombre',
            evaluation: buildAgentEvaluation(data, extra, influenceTotal),
          };
        })
        .sort((a, b) => {
          const verdictDiff = verdictWeight[a.evaluation.verdict.tone] - verdictWeight[b.evaluation.verdict.tone];
          if (verdictDiff !== 0) return verdictDiff;
          return verdictWeight[a.evaluation.autonomy.level === 'rojo' ? 'mal' : a.evaluation.autonomy.level === 'amarillo' ? 'atencion' : 'bien'] -
            verdictWeight[b.evaluation.autonomy.level === 'rojo' ? 'mal' : b.evaluation.autonomy.level === 'amarillo' ? 'atencion' : 'bien'];
        });

      setRows(nextRows);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const good = rows.filter((row) => row.evaluation.verdict.tone === 'bien').length;
    const warning = rows.filter((row) => row.evaluation.verdict.tone === 'atencion').length;
    const bad = rows.filter((row) => row.evaluation.verdict.tone === 'mal').length;
    return { good, warning, bad };
  }, [rows]);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Evaluación rápida de oficina
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          La misma lectura que ve el agente, resumida para dirección: quién va bien, quién todavía no basta y a quién hay que sentar ya.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                <p className="text-xs font-medium uppercase tracking-[0.16em]">Van bien</p>
                <p className="mt-2 text-3xl font-bold">{summary.good}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
                <p className="text-xs font-medium uppercase tracking-[0.16em]">Todavía no basta</p>
                <p className="mt-2 text-3xl font-bold">{summary.warning}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                <p className="text-xs font-medium uppercase tracking-[0.16em]">Lo hacen mal</p>
                <p className="mt-2 text-3xl font-bold">{summary.bad}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <div key={row.agentId} className="rounded-xl border border-border/60 bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{row.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.evaluation.focus.label}</p>
                    </div>
                    <Badge variant="outline" className={statusTone[row.evaluation.verdict.tone]}>
                      {row.evaluation.verdict.label}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {row.evaluation.pillars.map((pillar) => (
                      <div key={pillar.key} className={`rounded-lg border px-3 py-2 text-xs ${statusTone[pillar.status]}`}>
                        <p className="font-medium">{pillar.label}</p>
                        <p className="mt-1 text-sm font-semibold">{pillar.value}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground">
                    {row.evaluation.weakPillars.length > 0
                      ? row.evaluation.weakPillars[0]
                      : 'Hoy sus datos defienden bien que está construyendo negocio real.'}
                  </p>

                  <div className="mt-4 flex justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/team?tab=tracking&agent=${row.agentId}`}>
                        Abrir seguimiento <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAgentEvaluationOverview;
