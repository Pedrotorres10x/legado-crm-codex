import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Eye, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LogEntry {
  id: string;
  user_id: string;
  property_id: string;
  action: string;
  created_at: string;
  profile_name?: string;
  property_title?: string;
}

interface AgentAlert {
  user_id: string;
  name: string;
  count: number;
}

const AdminMediaActivity = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      // Fetch recent logs
      const { data: rawLogs } = await supabase
        .from('media_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100) as any;

      if (!rawLogs || rawLogs.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch profiles and properties for display
      const userIds = [...new Set(rawLogs.map((l: any) => l.user_id))] as string[];
      const propertyIds = [...new Set(rawLogs.map((l: any) => l.property_id))] as string[];

      const [profilesRes, propertiesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        supabase.from('properties').select('id, title').in('id', propertyIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.full_name]));
      const propertyMap = new Map((propertiesRes.data || []).map(p => [p.id, p.title]));

      const enriched = rawLogs.map((l: any) => ({
        ...l,
        profile_name: profileMap.get(l.user_id) || 'Desconocido',
        property_title: propertyMap.get(l.property_id) || 'Propiedad eliminada',
      }));

      setLogs(enriched);

      // Detect suspicious activity: agents with >20 views in last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recentLogs = rawLogs.filter((l: any) => l.created_at >= oneHourAgo);
      const countByAgent: Record<string, number> = {};
      for (const l of recentLogs) {
        countByAgent[l.user_id] = (countByAgent[l.user_id] || 0) + 1;
      }

      const suspiciousAgents: AgentAlert[] = Object.entries(countByAgent)
        .filter(([, count]) => count > 20)
        .map(([userId, count]) => ({
          user_id: userId,
          name: profileMap.get(userId) || 'Desconocido',
          count,
        }));

      setAlerts(suspiciousAgents);
      setLoading(false);
    };

    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Suspicious activity alerts */}
      {alerts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Actividad sospechosa detectada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.user_id} className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 bg-background">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm">
                    <span className="font-semibold">{a.name}</span> ha accedido a{' '}
                    <span className="font-bold text-destructive">{a.count} fichas</span> en la última hora
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent logs */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Últimos accesos a material gráfico
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay registros de actividad aún.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Inmueble</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Fecha/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.profile_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{log.property_title}</TableCell>
                    <TableCell>
                      <Badge variant={log.action === 'open_lightbox' ? 'default' : 'secondary'} className="text-xs">
                        {log.action === 'view_gallery' ? 'Ver galería' : log.action === 'open_lightbox' ? 'Abrir lightbox' : log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
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

export default AdminMediaActivity;
