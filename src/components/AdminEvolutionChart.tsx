import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { fmt } from '@/lib/commissions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonthData {
  month: string;
  generado: number;
  costes: number;
  beneficio: number;
}

type CommissionChartRow = Pick<
  Database['public']['Tables']['commissions']['Row'],
  'agency_commission' | 'agent_total' | 'status' | 'created_at'
>;

type TooltipEntry = {
  dataKey: string;
  color: string;
  name: string;
  value: number;
};

const AdminEvolutionChart = ({ agentMonthlyCost }: { agentMonthlyCost: number }) => {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const now = new Date();
    const months: { start: Date; end: Date; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      months.push({
        start: startOfMonth(d),
        end: endOfMonth(d),
        label: format(d, 'MMM yy', { locale: es }),
      });
    }

    // Fetch all commissions for last 6 months + agent count
    const sixMonthsAgo = months[0].start.toISOString();
    const [commsRes, agentCountRes] = await Promise.all([
      supabase.from('commissions').select('agency_commission, agent_total, status, created_at')
        .in('status', ['aprobado', 'pagado'])
        .gte('created_at', sixMonthsAgo),
      supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'agent'),
    ]);

    const comms = (commsRes.data as CommissionChartRow[] | null) || [];
    const agentCount = agentCountRes.count || 1;

    const chartData: MonthData[] = months.map((month) => {
      const monthComms = comms.filter((commission) => {
        const createdAt = new Date(commission.created_at);
        return createdAt >= month.start && createdAt <= month.end;
      });
      const generado = monthComms.reduce((sum, commission) => sum + (commission.agency_commission || 0), 0);
      const commsPaid = monthComms
        .filter((commission) => commission.status === 'pagado')
        .reduce((sum, commission) => sum + (commission.agent_total || 0), 0);
      const costes = (agentCount * agentMonthlyCost) + commsPaid;
      return {
        month: month.label,
        generado,
        costes,
        beneficio: generado - costes,
      };
    });

    setData(chartData);
    setLoading(false);
  }, [agentMonthlyCost]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) return null;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex justify-between gap-4">
            <span style={{ color: entry.color }}>{entry.name}:</span>
            <span className="font-medium">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-display">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          Evolución Mensual — Generado vs Costes
        </CardTitle>
        <p className="text-xs text-muted-foreground">Últimos 6 meses · Costes = fijo ({fmt(agentMonthlyCost)}/asesor) + comisiones pagadas</p>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} className="text-xs" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="generado" name="Generado agencia" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="costes" name="Costes totales" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="beneficio" name="Beneficio" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminEvolutionChart;
