import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Users, AlertTriangle, Clock, GitMerge, ChevronDown, ChevronUp, Send, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type MatchSenderLogRow = {
  id: string;
  run_at: string;
  demands_total: number;
  contacts_processed: number;
  contacts_skipped: number;
  emails_sent: number;
  emails_failed: number;
  whatsapp_sent?: number | null;
  matches_created: number;
  matches_skipped_already_sent?: number | null;
  duration_ms?: number | null;
  errors?: string[] | null;
};

const MatchSenderLogs = () => {
  const [logs, setLogs] = useState<MatchSenderLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<MatchSenderLogRow | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('match_sender_logs')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(50);
      setLogs((data || []) as MatchSenderLogRow[]);
      setLoading(false);
    };
    fetch();
  }, []);

  // Chart data (reversed for chronological order)
  const chartData = [...logs].reverse().map(l => ({
    date: format(new Date(l.run_at), 'dd MMM', { locale: es }),
    emails_sent: l.emails_sent,
    emails_failed: l.emails_failed,
    contacts_processed: l.contacts_processed,
    matches_created: l.matches_created,
    errors: (l.errors || []).length,
  }));

  // Aggregated stats
  const totals = logs.reduce(
    (acc, l) => ({
      emails: acc.emails + l.emails_sent,
      failed: acc.failed + l.emails_failed,
      contacts: acc.contacts + l.contacts_processed,
      matches: acc.matches + l.matches_created,
      errors: acc.errors + (l.errors || []).length,
    }),
    { emails: 0, failed: 0, contacts: 0, matches: 0, errors: 0 }
  );

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Cargando historial...</div>;
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <GitMerge className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No hay ejecuciones registradas del motor de cruces.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { icon: Send, label: 'Emails enviados', value: totals.emails, color: 'text-primary' },
          { icon: XCircle, label: 'Emails fallidos', value: totals.failed, color: 'text-destructive' },
          { icon: Users, label: 'Contactos procesados', value: totals.contacts, color: 'text-primary' },
          { icon: GitMerge, label: 'Cruces creados', value: totals.matches, color: 'text-primary' },
          { icon: AlertTriangle, label: 'Errores totales', value: totals.errors, color: totals.errors > 0 ? 'text-destructive' : 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color} shrink-0`} />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Emails por ejecución
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="emails_sent" name="Enviados" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                  <Area type="monotone" dataKey="emails_failed" name="Fallidos" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Contactos y cruces
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="contacts_processed" name="Contactos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="matches_created" name="Cruces" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="errors" name="Errores" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Log table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Historial de ejecuciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-center">Demandas</TableHead>
                <TableHead className="text-center">Contactos</TableHead>
                <TableHead className="text-center">Emails</TableHead>
                <TableHead className="text-center">Cruces</TableHead>
                <TableHead className="text-center">Errores</TableHead>
                <TableHead className="text-center">Duración</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(l => (
                <TableRow
                  key={l.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedLog(l)}
                >
                  <TableCell className="text-sm">
                    {format(new Date(l.run_at), "dd MMM yyyy HH:mm", { locale: es })}
                  </TableCell>
                  <TableCell className="text-center">{l.demands_total}</TableCell>
                  <TableCell className="text-center">
                    {l.contacts_processed}
                    {l.contacts_skipped > 0 && (
                      <span className="text-muted-foreground text-xs ml-1">(+{l.contacts_skipped} skip)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-primary font-medium">{l.emails_sent}</span>
                    {l.emails_failed > 0 && (
                      <span className="text-destructive text-xs ml-1">({l.emails_failed} ✗)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{l.matches_created}</TableCell>
                  <TableCell className="text-center">
                    {(l.errors || []).length > 0 ? (
                      <Badge variant="destructive" className="text-xs">{(l.errors || []).length}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {l.duration_ms ? `${(l.duration_ms / 1000).toFixed(1)}s` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-primary" />
              Detalle de ejecución
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {format(new Date(selectedLog.run_at), "dd MMMM yyyy 'a las' HH:mm:ss", { locale: es })}
                {selectedLog.duration_ms && ` · ${(selectedLog.duration_ms / 1000).toFixed(1)}s`}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Demandas activas', value: selectedLog.demands_total },
                  { label: 'Contactos procesados', value: selectedLog.contacts_processed },
                  { label: 'Contactos saltados', value: selectedLog.contacts_skipped },
                  { label: 'Emails enviados', value: selectedLog.emails_sent },
                  { label: 'Emails fallidos', value: selectedLog.emails_failed },
                  { label: 'WhatsApp enviados', value: selectedLog.whatsapp_sent },
                  { label: 'Cruces creados', value: selectedLog.matches_created },
                  { label: 'Cruces ya enviados', value: selectedLog.matches_skipped_already_sent },
                ].map(s => (
                  <div key={s.label} className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold">{s.value}</p>
                  </div>
                ))}
              </div>

              {(selectedLog.errors || []).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Errores ({selectedLog.errors.length})
                  </h4>
                  <div className="space-y-1 max-h-[30vh] overflow-y-auto">
                    {selectedLog.errors.map((err: string, i: number) => (
                      <p key={i} className="text-xs bg-destructive/10 text-destructive p-2 rounded font-mono break-all">
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatchSenderLogs;
