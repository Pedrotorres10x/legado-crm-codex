import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, PhoneCall, PhoneOff, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, startOfWeek, differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AgentCallStats {
  agentId: string;
  agentName: string;
  totalCalls: number;
  connected: number;
  noAnswer: number;
  voicemail: number;
  busy: number;
  wrong: number;
  contactRate: number;
  callsPerDay: number;
  lastCallDate: string | null;
}

const AdminPhoneActivity = () => {
  const [stats, setStats] = useState<AgentCallStats[]>([]);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const now = new Date();
      const start = period === 'week'
        ? startOfWeek(now, { weekStartsOn: 1 })
        : startOfMonth(now);

      const [callsRes, profilesRes] = await Promise.all([
        supabase
          .from('interactions')
          .select('agent_id, subject, interaction_date')
          .eq('interaction_type', 'llamada')
          .gte('interaction_date', start.toISOString()),
        supabase.from('profiles').select('user_id, full_name'),
      ]);

      const calls = callsRes.data || [];
      const profiles = profilesRes.data || [];
      const nameMap = new Map(profiles.map(p => [p.user_id, p.full_name]));

      const days = Math.max(1, differenceInCalendarDays(now, start) + 1);

      const grouped = new Map<string, typeof calls>();
      for (const c of calls) {
        const aid = c.agent_id || 'unknown';
        if (!grouped.has(aid)) grouped.set(aid, []);
        grouped.get(aid)!.push(c);
      }

      const result: AgentCallStats[] = [];
      for (const [agentId, agentCalls] of grouped) {
        const connected = agentCalls.filter(c => c.subject === 'Conectada').length;
        const noAnswer = agentCalls.filter(c => c.subject === 'No contesta').length;
        const voicemail = agentCalls.filter(c => c.subject === 'Buzón de voz').length;
        const busy = agentCalls.filter(c => c.subject === 'Ocupado').length;
        const wrong = agentCalls.filter(c => c.subject === 'Equivocado').length;
        const total = agentCalls.length;
        const sorted = [...agentCalls].sort((a, b) => b.interaction_date.localeCompare(a.interaction_date));

        result.push({
          agentId,
          agentName: nameMap.get(agentId) || 'Desconocido',
          totalCalls: total,
          connected,
          noAnswer,
          voicemail,
          busy,
          wrong,
          contactRate: total > 0 ? Math.round((connected / total) * 100) : 0,
          callsPerDay: Math.round((total / days) * 10) / 10,
          lastCallDate: sorted[0]?.interaction_date || null,
        });
      }

      result.sort((a, b) => b.totalCalls - a.totalCalls);
      setStats(result);
      setLoading(false);
    };
    fetch();
  }, [period]);

  const totals = stats.reduce(
    (acc, s) => ({
      calls: acc.calls + s.totalCalls,
      connected: acc.connected + s.connected,
    }),
    { calls: 0, connected: 0 }
  );
  const globalRate = totals.calls > 0 ? Math.round((totals.connected / totals.calls) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.calls}</p>
              <p className="text-xs text-muted-foreground">Total llamadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
              <PhoneCall className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.connected}</p>
              <p className="text-xs text-muted-foreground">Conectadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
              <PhoneOff className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.calls - totals.connected}</p>
              <p className="text-xs text-muted-foreground">No contactadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{globalRate}%</p>
              <p className="text-xs text-muted-foreground">Tasa de contacto</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail table */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-primary" />
            Actividad telefónica por agente
          </CardTitle>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Cargando datos...</p>
          ) : stats.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No hay llamadas registradas en el periodo seleccionado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Conectadas</TableHead>
                  <TableHead className="text-center">No contesta</TableHead>
                  <TableHead className="text-center">Buzón</TableHead>
                  <TableHead className="text-center">Ocupado</TableHead>
                  <TableHead className="text-center">Llam./día</TableHead>
                  <TableHead className="text-center">Tasa contacto</TableHead>
                  <TableHead>Última llamada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map(s => (
                  <TableRow key={s.agentId}>
                    <TableCell className="font-medium">{s.agentName}</TableCell>
                    <TableCell className="text-center font-bold">{s.totalCalls}</TableCell>
                    <TableCell className="text-center text-success font-semibold">{s.connected}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{s.noAnswer}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{s.voicemail}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{s.busy}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{s.callsPerDay}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          s.contactRate >= 50
                            ? 'text-success border-success/30'
                            : s.contactRate >= 30
                            ? 'text-warning border-warning/30'
                            : 'text-destructive border-destructive/30'
                        }
                      >
                        {s.contactRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.lastCallDate ? format(new Date(s.lastCallDate), 'dd MMM HH:mm', { locale: es }) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPhoneActivity;
