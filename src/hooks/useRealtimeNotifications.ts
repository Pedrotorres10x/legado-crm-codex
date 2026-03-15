import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useRealtimeNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `agent_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as {
            title: string;
            description?: string;
            event_type: string;
          };

          const emoji = getEmoji(n.event_type);

          toast({
            title: `${emoji} ${n.title}`,
            description: n.description ?? undefined,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

function getEmoji(event_type: string): string {
  const map: Record<string, string> = {
    new_visit: '📅',
    new_match: '🎯',
    new_offer: '💰',
    new_contact: '👤',
    new_property: '🏠',
    new_task: '✅',
    stage_change: '🔄',
    status_change: '🔔',
    mandate_expiry: '⚠️',
    data_anomaly: '⚠️',
  };
  return map[event_type] ?? '🔔';
}
