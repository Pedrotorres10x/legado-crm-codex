import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { hapticMedium } from '@/lib/haptics';

/** Play a short "ding" via Web Audio API (no external file needed) */
function playNotificationSound() {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close(), 500);
  } catch {
    // silently ignore if AudioContext unavailable
  }
}

export function useChatNotifications(userId: string | undefined) {
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const profileCache = useRef<Record<string, string>>({});

  // Keep ref in sync so the realtime callback reads the latest path
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('chat-notif')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const msg = payload.new as {
            user_id: string;
            content: string;
            channel_id: string;
          };

          // Ignore own messages
          if (msg.user_id === userId) return;

          // Ignore if user is already on /chat
          if (locationRef.current.startsWith('/chat')) return;

          // Resolve sender name (cache it)
          let senderName = profileCache.current[msg.user_id];
          if (!senderName) {
            const { data } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', msg.user_id)
              .maybeSingle();
            senderName = data?.full_name || 'Alguien';
            profileCache.current[msg.user_id] = senderName;
          }

          const preview = msg.content.length > 80
            ? msg.content.slice(0, 80) + '…'
            : msg.content;

          playNotificationSound();
          hapticMedium();

          toast({
            title: `💬 ${senderName}`,
            description: preview,
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
