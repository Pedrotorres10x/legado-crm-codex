import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import ChannelList from '@/components/chat/ChannelList';
import MessageArea from '@/components/chat/MessageArea';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Chat = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const loadUnreadCounts = useCallback(async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from('chat_channel_members')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id);

    if (!memberships) return;

    const counts: Record<string, number> = {};
    await Promise.all(memberships.map(async (m) => {
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', m.channel_id)
        .gt('created_at', m.last_read_at)
        .neq('user_id', user.id);
      counts[m.channel_id] = count || 0;
    }));

    setUnreadCounts(counts);
  }, [user]);

  useEffect(() => {
    loadUnreadCounts();

    // Subscribe to all new messages for unread count
    const sub = supabase
      .channel('chat-unread-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        loadUnreadCounts();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [loadUnreadCounts]);

  // Auto-select General on first load
  useEffect(() => {
    if (!selectedChannelId) {
      setSelectedChannelId('00000000-0000-0000-0000-000000000001');
    }
  }, []);

  const handleSelectChannel = (id: string) => {
    setSelectedChannelId(id);
    if (isMobile) setShowMessages(true);
  };

  const handleBack = () => setShowMessages(false);

  // Mobile: show either channel list or messages
  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100dvh-140px)] rounded-xl border border-border/50 overflow-hidden bg-background shadow-sm">
        {!showMessages ? (
          <ChannelList
            selectedChannelId={selectedChannelId}
            onSelectChannel={handleSelectChannel}
            unreadCounts={unreadCounts}
          />
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">Canales</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <MessageArea
                channelId={selectedChannelId}
                onNewMessage={loadUnreadCounts}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] rounded-xl border border-border/50 overflow-hidden bg-background shadow-sm">
      <div className="w-64 shrink-0">
        <ChannelList
          selectedChannelId={selectedChannelId}
          onSelectChannel={handleSelectChannel}
          unreadCounts={unreadCounts}
        />
      </div>
      <MessageArea
        channelId={selectedChannelId}
        onNewMessage={loadUnreadCounts}
      />
    </div>
  );
};

export default Chat;
