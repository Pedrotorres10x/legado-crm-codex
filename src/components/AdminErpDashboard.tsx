import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plug, CheckCircle, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { format, subDays, subHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Period = '24h' | '7d' | '30d';

interface SatelliteStatus {
  key: string;
  name: string;
  lastOk: string | null;
  errors: number;
  total: number;
  successRate: number;
  lastHeartbeat: string | null;
}

interface LogEntry {
  id: string;
  target: string;
  event: string;
  status: string;
  error_message: string | null;
  http_status: number | null;
  created_at: string;
}

const TARGET_LABELS: Record<string, string> = {
  mls: 'MLS Benidorm',
  website: 'Legado Colección',
  legado: 'Legado Colección',
  faktura: 'Faktura',
  
  linkinbio: 'Link In Bio',
};

const trafficDot = {
  green: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
  yellow: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  red: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
};

const getSince = (period: Period) => {
  if (period === '24h') return subHours(new Date(), 24);
  if (period === '7d') return subDays(new Date(), 7);
  return subDays(new Date(), 30);
};

const AdminErpDashboard = () => {
  const [satellites, setSatellites] = useState<SatelliteStatus[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [period, setPeriod] = useState<Period>('7d');
  const [filterTarget, setFilterTarget] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchData = async () => {
    setLoading(true);
    const since = getSince(period).toISOString();

    const [satRes, logsRes] = await Promise.all([
      supabase.from('satellite_config').select('satellite_key, display_name, is_active, last_heartbeat').eq('is_active', true),
      supabase.from('erp_sync_logs').select('id, target, event, status, error_message, http_status, created_at')
        .gte('created_at', since).order('created_at', { ascending: false }).limit(500),
    ]);

    const satData = (satRes.data || []) as any[];
    const logData = (logsRes.data || []) as LogEntry[];

    const statuses: SatelliteStatus[] = satData.map(s => {
      const targetLogs = logData.filter(l => l.target === s.satellite_key);
      const errors = targetLogs.filter(l => l.status === 'error').length;
      const total = targetLogs.length;
      const lastOk = targetLogs.find(l => l.status === 'ok')?.created_at || null;
      return {
        key: s.satellite_key,
        name: TARGET_LABELS[s.satellite_key] || s.display_name || s.satellite_key,
        lastOk,
        errors,
        total,
        successRate: total > 0 ? Math.round(((total - errors) / total) * 100) : 100,
        lastHeartbeat: s.last_heartbeat || null,
      };
    });

    setSatellites(statuses);
    setLogs(logData);
    setPage(0);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [period]);

  // Filtered logs for table
  const filteredLogs = useMemo(() => {
    let filtered = logs;
    if (filterTarget !== 'all') filtered = filtered.filter(l => l.target === filterTarget);
    if (filterStatus !== 'all') filtered = filtered.filter(l => l.status === filterStatus);
    return filtered;
  }, [logs, filterTarget, filterStatus]);

  const pagedLogs = filteredLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);

  // Chart data: events per day grouped by target
  const chartData = useMemo(() => {
    const dayMap: Record<string, Record<string, { ok: number; error: number }>> = {};
    logs.forEach(l => {
      const day = format(new Date(l.created_at), 'dd/MM');
      if (!dayMap[day]) dayMap[day] = {};
      if (!dayMap[day][l.target]) dayMap[day][l.target] = { ok: 0, error: 0 };
      if (l.status === 'error') dayMap[day][l.target].error++;
      else dayMap[day][l.target].ok++;
    });

    const days = Object.keys(dayMap).reverse();
    return days.map(day => {
      const entry: any = { day };
      satellites.forEach(s => {
        entry[`${s.key}_ok`] = dayMap[day]?.[s.key]?.ok || 0;
        entry[`${s.key}_error`] = dayMap[day]?.[s.key]?.error || 0;
      });
      return entry;
    });
  }, [logs, satellites]);

  const satColors = ['hsl(142 71% 45%)', 'hsl(217 91% 60%)', 'hsl(280 65% 60%)', 'hsl(38 92% 50%)', 'hsl(340 82% 52%)'];

  if (loading) return <div className="py-12 text-center text-muted-foreground">Cargando datos ERP...</div>;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Estado de sincronización del ecosistema de satélites</p>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {(['24h', '7d', '30d'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                {p === '24h' ? '24h' : p === '7d' ? '7 días' : '30 días'}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Satellite status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {satellites.map(s => {
          const dot = s.total === 0 ? 'yellow' : s.errors === 0 ? 'green' : s.successRate >= 80 ? 'yellow' : 'red';
          return (
            <Card key={s.key} className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{s.name}</span>
                  <div className={`h-3.5 w-3.5 rounded-full ${trafficDot[dot]}`} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Éxito</span>
                    <span className="font-medium">{s.total > 0 ? `${s.successRate}%` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Eventos</span>
                    <span className="font-medium">{s.total}</span>
                  </div>
                  {s.errors > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Errores</span>
                      <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] px-1.5">{s.errors}</Badge>
                    </div>
                  )}
                  {s.lastOk && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1">
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                      Último OK: {format(new Date(s.lastOk), 'dd/MM HH:mm', { locale: es })}
                    </div>
                  )}
                  {s.lastHeartbeat && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Heartbeat: {format(new Date(s.lastHeartbeat), 'dd/MM HH:mm', { locale: es })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity chart */}
      {chartData.length > 0 && (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />Actividad por satélite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ left: 0, right: 10 }}>
                <XAxis dataKey="day" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                {satellites.map((s, i) => (
                  <Bar key={`${s.key}_ok`} dataKey={`${s.key}_ok`} name={`${s.name} ✓`} stackId={s.key}
                    fill={satColors[i % satColors.length]} radius={[0, 0, 0, 0]} />
                ))}
                {satellites.map((s, i) => (
                  <Bar key={`${s.key}_error`} dataKey={`${s.key}_error`} name={`${s.name} ✗`} stackId={s.key}
                    fill="hsl(0 84% 60%)" radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Logs table */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />Logs detallados
              <Badge variant="secondary" className="ml-1 text-xs">{filteredLogs.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterTarget} onValueChange={v => { setFilterTarget(v); setPage(0); }}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Satélite" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {satellites.map(s => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pagedLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay logs para el periodo seleccionado.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs">Satélite</TableHead>
                    <TableHead className="text-xs">Evento</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="text-xs">HTTP</TableHead>
                    <TableHead className="text-xs">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedLogs.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.created_at), 'dd/MM HH:mm:ss', { locale: es })}</TableCell>
                      <TableCell className="text-xs font-medium">{TARGET_LABELS[l.target] || l.target}</TableCell>
                      <TableCell className="text-xs">{l.event}</TableCell>
                      <TableCell className="text-xs">
                        {l.status === 'ok' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px]">OK</Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">Error</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.http_status || '—'}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={l.error_message || ''}>
                        {l.error_message || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminErpDashboard;
