import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Target, Phone, CalendarCheck, Building2, Home, Euro, TrendingUp, Handshake } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getTeamKpiSummaries, type AgentKpiSummary } from '@/lib/agent-kpis';

type AgentBoardRow = {
  user_id: string;
  full_name: string | null;
  summary: AgentKpiSummary;
};

const KPI_ITEMS = [
  { key: 'toquesHorusHoy', target: 'toques_horus_dia', label: 'Toques Horus hoy', icon: Phone },
  { key: 'citasSemana', target: 'citas_semana', label: 'Visitas / semana', icon: CalendarCheck },
  { key: 'captacionesMes', target: 'captaciones_mes', label: 'Captaciones / mes', icon: Building2 },
  { key: 'ventasAno', target: 'ventas_ano', label: 'Ventas / año', icon: Home },
] as const;

const AdminKpiBoard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<AgentBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedAgentId = searchParams.get('agent') || 'all';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('profiles').select('user_id, full_name').order('full_name');
      const agents = (data || []).filter((agent) => agent.full_name);
      const { summaries } = await getTeamKpiSummaries(agents);
      setRows(summaries);
      setLoading(false);
    };

    load();
  }, []);

  const visibleRows = useMemo(() => {
    if (selectedAgentId === 'all') return rows;
    return rows.filter((row) => row.user_id === selectedAgentId);
  }, [rows, selectedAgentId]);

  return (
    <Card id="admin-kpi-board" className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            KPI del equipo
          </CardTitle>
          <Select
            value={selectedAgentId}
            onValueChange={(value) => {
              const next = new URLSearchParams(searchParams);
              if (value === 'all') next.delete('agent');
              else next.set('agent', value);
              setSearchParams(next, { replace: true });
            }}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todo el equipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el equipo</SelectItem>
              {rows.map((row) => (
                <SelectItem key={row.user_id} value={row.user_id}>
                  {row.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando rendimiento del equipo...</p>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay agentes con KPI disponibles.</p>
        ) : (
          visibleRows.map((row) => {
            const completedGoals = KPI_ITEMS.filter((item) => {
              const current = row.summary[item.key];
              const target = row.summary.targets[item.target];
              return current >= target;
            }).length;

            return (
              <div
                key={row.user_id}
                className={`rounded-xl border p-4 space-y-3 ${selectedAgentId === row.user_id ? 'border-primary/40 bg-primary/5' : 'border-border/50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {completedGoals}/4 objetivos en verde
                    </p>
                  </div>
                  <Badge variant={completedGoals >= 3 ? 'default' : completedGoals >= 2 ? 'secondary' : 'destructive'}>
                    {completedGoals >= 3 ? 'En objetivo' : completedGoals >= 2 ? 'Vigilando' : 'Necesita apoyo'}
                  </Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {KPI_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const current = row.summary[item.key];
                    const target = row.summary.targets[item.target];
                    const progress = Math.min((current / Math.max(target, 1)) * 100, 100);
                    return (
                      <div key={item.key} className="rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center justify-between text-xs font-medium mb-2">
                          <span className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                            {item.label}
                          </span>
                          <span>{current}/{target}</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5">
                        <Euro className="h-3.5 w-3.5 text-primary" />
                        Ofertas activas
                      </span>
                      <span>{row.summary.ofertasActivas}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        Oportunidades calientes
                      </span>
                      <span>{row.summary.oportunidadesCalientes}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5">
                        <Handshake className="h-3.5 w-3.5 text-primary" />
                        Visitas sin oferta
                      </span>
                      <span>{row.summary.visitasSinOferta}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default AdminKpiBoard;
