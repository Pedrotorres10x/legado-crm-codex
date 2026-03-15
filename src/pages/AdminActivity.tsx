import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { BarChart3, Inbox, UserPlus, Home, ArrowRightLeft, Eye, DollarSign, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const AgentActivityReport = lazy(() => import('@/components/AgentActivityReport'));

interface CrmNotification {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  title: string;
  description: string | null;
  agent_id: string | null;
  is_read: boolean;
  created_at: string;
}

const eventIcons: Record<string, typeof Calendar> = {
  new_contact: UserPlus,
  new_property: Home,
  status_change: ArrowRightLeft,
  stage_change: ArrowRightLeft,
  new_visit: Eye,
  new_offer: DollarSign,
  health_warning: AlertTriangle,
  mandate_expiring: AlertTriangle,
};

const eventColors: Record<string, string> = {
  new_contact: 'text-blue-500',
  new_property: 'text-emerald-500',
  status_change: 'text-amber-500',
  stage_change: 'text-violet-500',
  new_visit: 'text-cyan-500',
  new_offer: 'text-green-600',
  health_warning: 'text-red-500',
  mandate_expiring: 'text-amber-600',
};

const CrmActivityFeed = () => {
  const { isAdmin, user } = useAuth();
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!isAdmin) query = query.eq('agent_id', user.id);
    const { data } = await query;
    setNotifications((data as CrmNotification[]) || []);
  }, [isAdmin, user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('crm-activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as CrmNotification;
        if (!isAdmin && n.agent_id !== user.id) return;
        setNotifications(prev => [n, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, user]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllAsRead = async () => {
    const ids = notifications.map(n => n.id);
    if (!ids.length) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    setNotifications([]);
  };

  const healthWarnings = notifications.filter(n => n.event_type === 'health_warning');
  const mandateAlerts = notifications.filter(n => n.event_type === 'mandate_expiring');
  const activityNotifs = notifications.filter(n => !['health_warning', 'mandate_expiring'].includes(n.event_type));

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          Feed de actividad
          {notifications.length > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {notifications.length}
            </span>
          )}
        </h2>
        {notifications.length > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
            Marcar todo leído
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Sin novedades pendientes</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[420px]">
          {/* Activity */}
          {activityNotifs.length > 0 && (
            <>
              <div className="px-5 py-2 bg-muted/40">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Nuevos registros y cambios
                </p>
              </div>
              <div className="divide-y divide-border/40">
                {activityNotifs.map(n => {
                  const Icon = eventIcons[n.event_type] || Inbox;
                  const color = eventColors[n.event_type] || 'text-primary';
                  return (
                    <div key={n.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                        title="Marcar como leído"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Mandate alerts */}
          {mandateAlerts.length > 0 && (
            <>
              {activityNotifs.length > 0 && <Separator />}
              <div className="px-5 py-2 bg-amber-50/50 dark:bg-amber-950/20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Mandatos por vencer ({mandateAlerts.length})
                </p>
              </div>
              <div className="divide-y divide-border/40">
                {mandateAlerts.map(n => (
                  <div key={n.id} className="flex items-start gap-3 px-5 py-3 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                    </div>
                    <button onClick={() => markAsRead(n.id)} className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5">✕</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Health warnings */}
          {healthWarnings.length > 0 && (
            <>
              {(activityNotifs.length > 0 || mandateAlerts.length > 0) && <Separator />}
              <div className="px-5 py-2 bg-red-50/50 dark:bg-red-950/20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  Alertas de salud ({healthWarnings.length})
                </p>
              </div>
              <div className="divide-y divide-border/40">
                {healthWarnings.map(n => (
                  <div key={n.id} className="flex items-start gap-3 px-5 py-3 hover:bg-red-50/30 dark:hover:bg-red-950/10 transition-colors">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                    </div>
                    <button onClick={() => markAsRead(n.id)} className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5">✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </ScrollArea>
      )}
    </div>
  );
};

const AdminActivity = () => {
  const { canViewAll, loading } = useAuth();

  if (loading) return null;
  if (!canViewAll) return <Navigate to="/" replace />;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight font-display">Actividad del CRM</h1>
        </div>
        <p className="text-muted-foreground">Notificaciones en tiempo real y actividad del equipo</p>
      </div>

      {/* CRM Notification feed */}
      <CrmActivityFeed />

      <Separator />

      {/* Agent activity reports */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Informes por asesor</h2>
        <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Cargando...</div>}>
          <AgentActivityReport />
        </Suspense>
      </div>
    </div>
  );
};

export default AdminActivity;
