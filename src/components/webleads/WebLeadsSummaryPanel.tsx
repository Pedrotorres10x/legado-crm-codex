import { ArrowRight, BarChart2, FileText, Monitor, Repeat, Smartphone, Sun, Tablet } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TopRow = [string, number];

type DeviceCounts = {
  desktop: number;
  mobile: number;
  tablet: number;
};

type PeakHour = {
  hour: number;
  visitas: number;
};

type WebLeadsSummaryPanelProps = {
  deviceCounts: DeviceCounts;
  totalPV: number;
  newVisitors: number;
  returningCount: number;
  uniqueSessions: number;
  topSources: TopRow[];
  topPages: TopRow[];
  avgPagesPerSession: number | string;
  avgDuration: string | null;
  bounceRate: number;
  bouncedSessions: number;
  blogVisits: number;
  peakHour: PeakHour;
  pageName: (page: string) => string;
};

export function WebLeadsSummaryPanel({
  deviceCounts,
  totalPV,
  newVisitors,
  returningCount,
  uniqueSessions,
  topSources,
  topPages,
  avgPagesPerSession,
  avgDuration,
  bounceRate,
  bouncedSessions,
  blogVisits,
  peakHour,
  pageName,
}: WebLeadsSummaryPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" /> Dispositivos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          {[
            { label: 'Desktop', count: deviceCounts.desktop, icon: Monitor },
            { label: 'Mobile', count: deviceCounts.mobile, icon: Smartphone },
            { label: 'Tablet', count: deviceCounts.tablet, icon: Tablet },
          ].map((d) => {
            const pct = totalPV > 0 ? Math.round((d.count / totalPV) * 100) : 0;
            return (
              <div key={d.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 text-foreground font-medium">
                    <d.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {d.label}
                  </span>
                  <span className="text-muted-foreground">{d.count} · {pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div className="h-1.5 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5" /> Nuevos vs Recurrentes
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          {[
            { label: 'Nuevos visitantes', count: newVisitors, color: 'bg-primary/60' },
            { label: 'Recurrentes', count: returningCount, color: 'bg-primary' },
          ].map((d) => {
            const pct = uniqueSessions > 0 ? Math.round((d.count / uniqueSessions) * 100) : 0;
            return (
              <div key={d.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{d.label}</span>
                  <span className="text-muted-foreground">{d.count} · {pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div className={`h-1.5 ${d.color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground pt-1">
            {returningCount > 0
              ? `${Math.round((returningCount / uniqueSessions) * 100)}% del tráfico ya te conocía`
              : 'Los visitantes recurrentes aparecerán cuando acumules más datos'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5" /> Origen del tráfico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {topSources.slice(0, 5).map(([src, count]) => {
            const pct = uniqueSessions > 0 ? Math.round((count / uniqueSessions) * 100) : 0;
            return (
              <div key={src}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-foreground truncate">{src}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{count} · {pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div className="h-1.5 bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Páginas más visitadas
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 space-y-1.5">
          {topPages.slice(0, 6).map(([page, count]) => (
            <div key={page} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-foreground truncate" title={page}>{pageName(page)}</span>
              <Badge variant="secondary" className="text-[10px] shrink-0">{count}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" /> Engagement
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 space-y-3">
          {[
            { label: 'Páginas por sesión', value: avgPagesPerSession },
            { label: 'Duración media', value: avgDuration ?? '—' },
            { label: 'Tasa de rebote', value: `${bounceRate}%` },
            { label: 'Sesiones de 1 página', value: bouncedSessions },
            { label: 'Visitas al blog', value: blogVisits || 0 },
          ].map((m) => (
            <div key={m.label} className="flex justify-between items-center text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-semibold text-foreground">{m.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5" /> Pico de tráfico
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="text-center py-2">
            <div className="text-4xl font-bold text-primary mb-1">
              {peakHour.visitas > 0 ? `${peakHour.hour}:00` : '—'}
            </div>
            <div className="text-xs text-muted-foreground mb-3">hora de más tráfico</div>
            <div className="text-xs text-foreground">
              {peakHour.visitas > 0 && (
                peakHour.hour >= 6 && peakHour.hour < 14
                  ? '🌅 Tráfico de mañana'
                  : peakHour.hour >= 14 && peakHour.hour < 20
                    ? '☀️ Tráfico de tarde'
                    : '🌙 Tráfico nocturno'
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{peakHour.visitas} páginas vistas</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
