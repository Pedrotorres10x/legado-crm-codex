import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Inbox, UserPlus, Home, ArrowRightLeft, Eye, DollarSign,
  AlertTriangle, CheckCircle, Calendar
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

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

const CrmNotificationBell = () => {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50);
    // Non-admins only see their own notifications (RLS handles it, but explicit filter for clarity)
    if (!isAdmin) {
      query = query.eq('agent_id', user.id);
    }
    const { data } = await query;
    setNotifications((data as CrmNotification[]) || []);
  }, [isAdmin, user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('crm-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const newNotif = payload.new as CrmNotification;
        // Agents only see their own
        if (!isAdmin && newNotif.agent_id !== user.id) return;
        setNotifications(prev => [newNotif, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, user]);

  if (!user) return null;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllAsRead = async () => {
    const ids = notifications.map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    setNotifications([]);
  };

  const navigateToEntity = (n: CrmNotification) => {
    if (n.entity_type === 'contact') navigate(`/contacts/${n.entity_id}`);
    else if (n.entity_type === 'property') navigate(`/properties/${n.entity_id}`);
    markAsRead(n.id);
    setOpen(false);
  };

  const count = notifications.length;

  // Group by type
  const healthWarnings = notifications.filter(n => n.event_type === 'health_warning');
  const mandateAlerts = notifications.filter(n => n.event_type === 'mandate_expiring');
  const activityNotifs = notifications.filter(n => !['health_warning', 'mandate_expiring'].includes(n.event_type));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Inbox className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-scale-in">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Actividad del CRM
          </h3>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
              Marcar todo leído
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[70vh]">
          {count === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Sin novedades</p>
            </div>
          ) : (
            <>
              {/* Activity notifications */}
              {activityNotifs.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/40">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Nuevos registros y cambios
                    </p>
                  </div>
                  <div className="divide-y">
                    {activityNotifs.map(n => {
                      const Icon = eventIcons[n.event_type] || Inbox;
                      const color = eventColors[n.event_type] || 'text-primary';
                      return (
                        <button
                          key={n.id}
                          className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => navigateToEntity(n)}
                        >
                          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-tight">{n.title}</p>
                            {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Mandate expiring alerts */}
              {mandateAlerts.length > 0 && (
                <>
                  {activityNotifs.length > 0 && <Separator />}
                  <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-950/20">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      Mandatos por vencer ({mandateAlerts.length})
                    </p>
                  </div>
                  <div className="divide-y">
                    {mandateAlerts.map(n => (
                      <button
                        key={n.id}
                        className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors text-left"
                        onClick={() => navigateToEntity(n)}
                      >
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{n.title}</p>
                          {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Health warnings */}
              {healthWarnings.length > 0 && (
                <>
                  {(activityNotifs.length > 0 || mandateAlerts.length > 0) && <Separator />}
                  <div className="px-4 py-2 bg-red-50/50 dark:bg-red-950/20">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      Alertas de salud ({healthWarnings.length})
                    </p>
                  </div>
                  <div className="divide-y">
                    {healthWarnings.slice(0, 20).map(n => (
                      <button
                        key={n.id}
                        className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors text-left"
                        onClick={() => navigateToEntity(n)}
                      >
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{n.title}</p>
                          {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                        </div>
                      </button>
                    ))}
                    {healthWarnings.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center py-2">+{healthWarnings.length - 20} más</p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default CrmNotificationBell;
