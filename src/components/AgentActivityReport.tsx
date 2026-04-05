import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, Handshake, FileText, ChevronLeft, ChevronRight, BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import { startOfWeek, endOfWeek, addWeeks, format, subWeeks, eachDayOfInterval, startOfDay, endOfDay, isToday, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';

interface AgentRow {
  userId: string;
  name: string;
  calls: number;
  visits: number;
  offers: number;
  total: number;
}

// Toques Horus por agente por día
interface ToqueDia {
  date: Date;
  // userId → count
  counts: Record<string, number>;
}

type ProfileRow = {
  user_id: string;
  full_name: string | null;
};

type AgentCountRow = {
  agent_id?: string | null;
};

type TouchRow = {
  agent_id?: string | null;
  interaction_date?: string | null;
};

const MINIMO_HORUS = 2;
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const AgentActivityReport = () => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [toquesPorDia, setToquesPorDia] = useState<ToqueDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const now = new Date();
  const weekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });

  // For month view
  const monthStart = new Date(now.getFullYear(), now.getMonth() + (viewMode === 'month' ? weekOffset : 0), 1);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

  const rangeStart = viewMode === 'week' ? weekStart : monthStart;
  const rangeEnd = viewMode === 'week' ? weekEnd : monthEnd;

  const rangeLabel = viewMode === 'week'
    ? `${format(weekStart, 'dd MMM', { locale: es })} — ${format(weekEnd, 'dd MMM yyyy', { locale: es })}`
    : format(monthStart, 'MMMM yyyy', { locale: es });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startISO = rangeStart.toISOString();
      const endISO = rangeEnd.toISOString();

      // Get all profiles (agents)
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
      if (!profiles) { setLoading(false); return; }

      // Parallel queries for the period
      const [callsRes, visitsRes, offersRes, toquesRes] = await Promise.all([
        supabase
          .from('interactions')
          .select('agent_id, interaction_type')
          .in('interaction_type', ['llamada', 'email', 'whatsapp', 'cafe_comida', 'reunion'])
          .gte('interaction_date', startISO)
          .lte('interaction_date', endISO),
        supabase
          .from('visits')
          .select('agent_id')
          .gte('visit_date', startISO)
          .lte('visit_date', endISO),
        supabase
          .from('offers')
          .select('agent_id')
          .gte('created_at', startISO)
          .lte('created_at', endISO),
        // Toques Horus con fecha para el desglose diario
        supabase
          .from('interactions')
          .select('agent_id, interaction_date')
          .in('interaction_type', ['llamada', 'whatsapp', 'email', 'cafe_comida', 'reunion'])
          .gte('interaction_date', startISO)
          .lte('interaction_date', endISO),
      ]);

      // Count by agent
      const countBy = (data: AgentCountRow[] | null, key: keyof AgentCountRow = 'agent_id') => {
        const map: Record<string, number> = {};
        (data || []).forEach((row) => {
          const id = row[key];
          if (id) map[id] = (map[id] || 0) + 1;
        });
        return map;
      };

      const callCounts = countBy((callsRes.data || []) as AgentCountRow[]);
      const visitCounts = countBy((visitsRes.data || []) as AgentCountRow[]);
      const offerCounts = countBy((offersRes.data || []) as AgentCountRow[]);

      const profileRows = profiles as ProfileRow[];

      const rows: AgentRow[] = profileRows
        .map((profile) => {
          const calls = callCounts[profile.user_id] || 0;
          const visits = visitCounts[profile.user_id] || 0;
          const offers = offerCounts[profile.user_id] || 0;
          return {
            userId: profile.user_id,
            name: profile.full_name || 'Sin nombre',
            calls,
            visits,
            offers,
            total: calls + visits + offers,
          };
        })
        .filter(r => r.total > 0 || profileRows.length <= 10)
        .sort((a, b) => b.total - a.total);

      setAgents(rows);

      // ── Histórico Toques Horus por día ───────────────────────────────────
      if (viewMode === 'week') {
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
        const toquesData = (toquesRes.data || []) as TouchRow[];

        const diasConToques: ToqueDia[] = days.map(day => {
          const counts: Record<string, number> = {};
          toquesData.forEach((touch) => {
            if (!touch.interaction_date || !touch.agent_id) return;
            const touchDate = new Date(touch.interaction_date);
            if (touchDate >= startOfDay(day) && touchDate <= endOfDay(day)) {
              counts[touch.agent_id] = (counts[touch.agent_id] || 0) + 1;
            }
          });
          return { date: day, counts };
        });

        setToquesPorDia(diasConToques);
      } else {
        setToquesPorDia([]);
      }

      setLoading(false);
    };
    fetchData();
  }, [rangeEnd, rangeStart, viewMode, weekEnd, weekOffset, weekStart]);

  const totals = agents.reduce(
    (acc, a) => ({
      calls: acc.calls + a.calls,
      visits: acc.visits + a.visits,
      offers: acc.offers + a.offers,
      total: acc.total + a.total,
    }),
    { calls: 0, visits: 0, offers: 0, total: 0 }
  );

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Informe de actividad por agente
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v: 'week' | 'month') => { setViewMode(v); setWeekOffset(0); }}>
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semanal</SelectItem>
                <SelectItem value="month">Mensual</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[180px] text-center capitalize">{rangeLabel}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => Math.min(w + 1, 0))} disabled={weekOffset >= 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Cargando...</div>
        ) : (
          <>
            {/* Tabla de actividad general */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Phone className="h-3.5 w-3.5" /> Contactos
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Visitas
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FileText className="h-3.5 w-3.5" /> Ofertas
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map(a => (
                    <TableRow key={a.userId}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={a.calls > 0 ? 'default' : 'secondary'} className="min-w-[32px] justify-center">
                          {a.calls}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={a.visits > 0 ? 'default' : 'secondary'} className="min-w-[32px] justify-center">
                          {a.visits}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={a.offers > 0 ? 'default' : 'secondary'} className="min-w-[32px] justify-center">
                          {a.offers}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-primary">{a.total}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {agents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Sin actividad en este periodo
                      </TableCell>
                    </TableRow>
                  )}
                  {agents.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL EQUIPO</TableCell>
                      <TableCell className="text-center">{totals.calls}</TableCell>
                      <TableCell className="text-center">{totals.visits}</TableCell>
                      <TableCell className="text-center">{totals.offers}</TableCell>
                      <TableCell className="text-center text-primary">{totals.total}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ── Histórico Toques Horus semana ── */}
            {viewMode === 'week' && agents.length > 0 && toquesPorDia.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold">Toques Horus por día</h3>
                  <span className="text-xs text-muted-foreground">(mínimo {MINIMO_HORUS} por día · 📞💬📧☕)</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-32">Agente</th>
                        {toquesPorDia.map((dia, i) => {
                          const esFuturo = isFuture(endOfDay(dia.date));
                          const esHoy = isToday(dia.date);
                          return (
                            <th
                              key={i}
                              className={`text-center py-2 px-2 font-medium min-w-[56px] ${
                                esHoy ? 'text-primary' : esFuturo ? 'text-muted-foreground/50' : 'text-muted-foreground'
                              }`}
                            >
                              <div>{DIAS_SEMANA[i]}</div>
                              <div className="text-[10px] font-normal">{format(dia.date, 'd MMM', { locale: es })}</div>
                            </th>
                          );
                        })}
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Días ✓</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((agent, ai) => {
                        const diasConMinimo = toquesPorDia.filter(dia => {
                          if (isFuture(endOfDay(dia.date)) && !isToday(dia.date)) return false;
                          return (dia.counts[agent.userId] || 0) >= MINIMO_HORUS;
                        }).length;
                        const diasPasados = toquesPorDia.filter(dia =>
                          !isFuture(endOfDay(dia.date)) || isToday(dia.date)
                        ).length;

                        return (
                          <tr
                            key={agent.userId}
                            className={`border-b border-border/30 ${ai % 2 === 0 ? '' : 'bg-muted/20'}`}
                          >
                            <td className="py-2 px-3 font-medium truncate max-w-[120px]">{agent.name}</td>
                            {toquesPorDia.map((dia, di) => {
                              const count = dia.counts[agent.userId] || 0;
                              const esFuturo = isFuture(endOfDay(dia.date)) && !isToday(dia.date);
                              const esHoy = isToday(dia.date);
                              const llega = count >= MINIMO_HORUS;
                              const parcial = count > 0 && count < MINIMO_HORUS;

                              if (esFuturo) {
                                return (
                                  <td key={di} className="text-center py-2 px-2">
                                    <span className="text-muted-foreground/30 text-xs">—</span>
                                  </td>
                                );
                              }

                              return (
                                <td key={di} className="text-center py-2 px-2">
                                  <div className="flex flex-col items-center gap-0.5">
                                    {llega ? (
                                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold mx-auto ${
                                        esHoy
                                          ? 'bg-emerald-500 text-white'
                                          : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                                      }`}>
                                        {count}
                                      </div>
                                    ) : parcial ? (
                                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold mx-auto ${
                                        esHoy
                                          ? 'bg-amber-400 text-white'
                                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                      }`}>
                                        {count}
                                      </div>
                                    ) : (
                                      <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold mx-auto bg-muted text-muted-foreground">
                                        0
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            {/* Resumen días con mínimo */}
                            <td className="text-center py-2 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <span className={`font-bold text-sm ${
                                  diasConMinimo === diasPasados && diasPasados > 0
                                    ? 'text-emerald-600'
                                    : diasConMinimo >= Math.ceil(diasPasados / 2)
                                      ? 'text-amber-600'
                                      : 'text-muted-foreground'
                                }`}>
                                  {diasConMinimo}/{diasPasados}
                                </span>
                                {diasConMinimo === diasPasados && diasPasados > 0 && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Leyenda */}
                    <tfoot>
                      <tr className="border-t border-border/50 bg-muted/20">
                        <td colSpan={toquesPorDia.length + 2} className="py-2 px-3">
                          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <div className="h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300" />
                              <span>≥{MINIMO_HORUS} toques (objetivo)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="h-4 w-4 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300" />
                              <span>1 toque (por debajo del mínimo)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="h-4 w-4 rounded-full bg-muted border border-border" />
                              <span>Sin toques</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentActivityReport;
