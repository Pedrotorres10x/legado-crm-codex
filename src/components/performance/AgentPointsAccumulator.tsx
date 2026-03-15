import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Award } from 'lucide-react';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PerformanceData } from '@/hooks/useAgentPerformance';

interface Props {
  data: PerformanceData;
}

const AgentPointsAccumulator = ({ data }: Props) => {
  const target = data.quarterlyTarget || 500;
  const rollingTarget = data.rollingTarget || 500;
  const pct = Math.min(Math.round((data.totalPoints / Math.max(target, 1)) * 100), 100);
  const remaining = Math.max(target - data.totalPoints, 0);
  const horusActive = data.averagePoints >= rollingTarget;

  const pieData = [
    { name: 'Acumulado', value: data.totalPoints },
    { name: 'Restante', value: remaining },
  ];

  const COLORS = [horusActive ? 'hsl(var(--success))' : 'hsl(var(--primary))', 'hsl(var(--muted))'];

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-display">
            <Star className="h-5 w-5 text-warning" />
            Puntos Horus
          </CardTitle>
          {horusActive ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1">
              <Award className="h-3 w-3" />Bonus desbloqueado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-xs">
              {data.periodLabel}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative w-32 h-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={56} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold">{pct}%</span>
              <span className="text-[10px] text-muted-foreground">objetivo</span>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-2xl font-bold">{data.averagePoints} <span className="text-sm font-normal text-muted-foreground">/ {rollingTarget} pt de promedio</span></p>
            <p className="text-xs text-muted-foreground">{data.periodLabel}</p>
            <p className="text-xs text-muted-foreground">
              Acumulado del periodo: <span className="font-semibold text-foreground">{data.totalPoints}</span> / {target} pt
            </p>
            <div className="space-y-0.5 mt-1">
              {data.monthlyBreakdown.map(m => {
                const d = parse(m.month, 'yyyy-MM', new Date());
                const label = format(d, 'MMMM', { locale: es });
                return (
                  <p key={m.month} className="text-xs text-muted-foreground capitalize">
                    <span className="font-semibold text-foreground">{m.points} pt</span> {label}
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentPointsAccumulator;
