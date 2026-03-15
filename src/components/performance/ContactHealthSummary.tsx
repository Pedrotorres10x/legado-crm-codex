import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartPulse } from 'lucide-react';
import type { PerformanceData } from '@/hooks/useAgentPerformance';

interface Props {
  data: PerformanceData;
}

const COLORS = {
  green: 'hsl(var(--success))',
  yellow: 'hsl(var(--warning))',
  orange: 'hsl(24 95% 53%)',
  red: 'hsl(var(--destructive))',
};

const ContactHealthSummary = ({ data }: Props) => {
  const { health } = data;
  const pieData = [
    { name: 'Activos', value: health.green, color: COLORS.green },
    { name: 'UVI', value: health.yellow, color: COLORS.yellow },
    { name: 'Enfriados', value: health.orange, color: COLORS.orange },
    { name: 'Muertos', value: health.red, color: COLORS.red },
  ].filter(d => d.value > 0);

  if (health.total === 0) {
    pieData.push({ name: 'Sin datos', value: 1, color: 'hsl(var(--muted))' });
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <HeartPulse className="h-5 w-5 text-success" />
          Salud de cartera
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="w-28 h-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={0}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">Total: <span className="text-lg font-bold">{health.total}</span></p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Activos', count: health.green, cls: 'text-success' },
                { label: 'UVI', count: health.yellow, cls: 'text-warning' },
                { label: 'Enfriados', count: health.orange, cls: 'text-orange-500' },
                { label: 'Muertos', count: health.red, cls: 'text-destructive' },
              ].map(h => (
                <div key={h.label} className="text-center">
                  <p className={`text-lg font-bold ${h.cls}`}>{h.count}</p>
                  <p className="text-[10px] text-muted-foreground">{h.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactHealthSummary;
