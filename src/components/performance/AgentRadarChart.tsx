import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import type { PerformanceData } from '@/hooks/useAgentPerformance';
import { getPerformanceBottleneck } from '@/lib/agent-bottlenecks';
import { getAgentForecast } from '@/lib/agent-forecast';

interface Props {
  data: PerformanceData;
  period: 3 | 6;
  onPeriodChange: (p: 3 | 6) => void;
}

const AgentRadarChart = ({ data, period, onPeriodChange }: Props) => {
  const radarData = [
    { axis: 'Toques', value: data.toques, fullMark: 100 },
    { axis: 'Entrevistas', value: data.entrevistas, fullMark: 100 },
    { axis: 'Captaciones', value: data.captaciones, fullMark: 100 },
    { axis: 'Facturación', value: data.facturacion, fullMark: 100 },
  ];
  const bottleneck = getPerformanceBottleneck(data);
  const forecast = getAgentForecast(data);
  const forecastTone =
    forecast.level === 'verde'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : forecast.level === 'amarillo'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-rose-200 bg-rose-50 text-rose-700';

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Target className="h-5 w-5 text-primary" />
          Rendimiento
        </CardTitle>
        <Tabs value={String(period)} onValueChange={v => onPeriodChange(Number(v) as 3 | 6)}>
          <TabsList className="h-8">
            <TabsTrigger value="3" className="text-xs px-3">3 meses</TabsTrigger>
            <TabsTrigger value="6" className="text-xs px-3">6 meses</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <Radar name="Rendimiento" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {radarData.map(d => (
            <div key={d.axis} className="text-center">
              <p className={`text-lg font-bold ${d.value >= 80 ? 'text-success' : d.value >= 50 ? 'text-warning' : 'text-destructive'}`}>{d.value}%</p>
              <p className="text-[10px] text-muted-foreground">{d.axis}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{bottleneck.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{bottleneck.detail}</p>
            </div>
            <Badge variant={bottleneck.averageValue >= 75 ? 'default' : 'outline'} className="shrink-0">
              Media radar {bottleneck.averageValue}%
            </Badge>
          </div>
          <div className="mt-3 rounded-lg bg-background px-3 py-3 text-sm">
            <span className="font-medium">Siguiente foco:</span> {bottleneck.action}
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border/60 bg-background p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">{forecast.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{forecast.detail}</p>
            </div>
            <Badge variant="outline" className={forecastTone}>
              Lectura predictiva
            </Badge>
          </div>
          <div className="mt-3 rounded-lg bg-muted/20 px-3 py-3 text-sm">
            <span className="font-medium">Qué te dice para el mes que viene:</span> {forecast.action}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentRadarChart;
