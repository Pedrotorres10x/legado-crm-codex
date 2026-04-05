import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Hash, MessageCircle, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import CreateChannelDialog from './CreateChannelDialog';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  is_direct: boolean;
  created_by: string;
}

interface ChannelListProps {
  selectedChannelId: string | null;
  onSelectChannel: (id: string) => void;
  unreadCounts: Record<string, number>;
}

const ChannelList = ({ selectedChannelId, onSelectChannel, unreadCounts }: ChannelListProps) => {
  const { user, isAdmin } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [directChannels, setDirectChannels] = useState<(Channel & { otherUserName?: string })[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('user_id, full_name');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    if (!user) return;
    const { data: memberOf } = await supabase
      .from('chat_channel_members')
      .select('channel_id')
      .eq('user_id', user.id);

    if (!memberOf || memberOf.length === 0) { setChannels([]); setDirectChannels([]); return; }

    const channelIds = memberOf.map(m => m.channel_id);
    const { data: allChannels } = await supabase
      .from('chat_channels')
      .select('*')
      .in('id', channelIds)
      .order('created_at');

    if (allChannels) {
      setChannels(allChannels.filter(c => !c.is_direct));

      const directs = allChannels.filter(c => c.is_direct);
      // Get other user names for DMs
      const directWithNames = await Promise.all(directs.map(async (ch) => {
        const { data: members } = await supabase
          .from('chat_channel_members')
          .select('user_id')
          .eq('channel_id', ch.id)
          .neq('user_id', user!.id);
        const otherUserId = members?.[0]?.user_id;
        return { ...ch, otherUserName: otherUserId ? profiles[otherUserId] || 'Usuario' : 'Usuario' };
      }));
      setDirectChannels(directWithNames);
    }
  }, [profiles, user]);

  useEffect(() => {
    if (!user) return;
    loadChannels();
    loadProfiles();
  }, [loadChannels, loadProfiles, user]);

  // Reload when profiles change (for DM names)
  useEffect(() => {
    if (Object.keys(profiles).length > 0 && user) loadChannels();
  }, [loadChannels, profiles, user]);

  const startDirectMessage = async (targetUserId: string) => {
    if (!user) return;
    // Check if DM already exists
    const { data: myChannels } = await supabase
      .from('chat_channel_members')
      .select('channel_id')
      .eq('user_id', user.id);

    if (myChannels) {
      for (const mc of myChannels) {
        const { data: ch } = await supabase
          .from('chat_channels')
          .select('*')
          .eq('id', mc.channel_id)
          .eq('is_direct', true)
          .single();
        if (ch) {
          const { data: otherMember } = await supabase
            .from('chat_channel_members')
            .select('user_id')
            .eq('channel_id', ch.id)
            .eq('user_id', targetUserId);
          if (otherMember && otherMember.length > 0) {
            onSelectChannel(ch.id);
            return;
          }
        }
      }
    }

    // Create new DM channel
    const { data: newChannel } = await supabase
      .from('chat_channels')
      .insert({ name: 'DM', is_direct: true, created_by: user.id })
      .select()
      .single();

    if (newChannel) {
      await supabase.from('chat_channel_members').insert([
        { channel_id: newChannel.id, user_id: user.id },
        { channel_id: newChannel.id, user_id: targetUserId },
      ]);
      await loadChannels();
      onSelectChannel(newChannel.id);
    }
  };

  const [showUsers, setShowUsers] = useState(false);
  const [allUsers, setAllUsers] = useState<{ user_id: string; full_name: string }[]>([]);

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('user_id, full_name');
    if (data) setAllUsers(data.filter(u => u.user_id !== user?.id));
    setShowUsers(true);
  };

  return (
    <div className="flex flex-col h-full border-r border-border/50 bg-muted/30">
      <div className="p-4 border-b border-border/50">
        <h2 className="font-display font-bold text-lg text-foreground">Chat</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Channels */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Canales</span>
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowCreate(true)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch.id)}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors",
                  selectedChannelId === ch.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Hash className="h-4 w-4 shrink-0" />
                <span className="truncate">{ch.name}</span>
                {(unreadCounts[ch.id] || 0) > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCounts[ch.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Direct Messages */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mensajes Directos</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={loadUsers}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {directChannels.map(ch => (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch.id)}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors",
                  selectedChannelId === ch.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">{ch.otherUserName}</span>
                {(unreadCounts[ch.id] || 0) > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCounts[ch.id]}
                  </span>
                )}
              </button>
            ))}

            {/* User picker for new DM */}
            {showUsers && (
              <div className="mt-2 space-y-1 bg-background rounded-lg border border-border p-2">
                <p className="text-xs text-muted-foreground px-1 mb-1">Iniciar conversación con:</p>
                {allUsers.map(u => (
                  <button
                    key={u.user_id}
                    onClick={() => { startDirectMessage(u.user_id); setShowUsers(false); }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {u.full_name}
                  </button>
                ))}
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowUsers(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <CreateChannelDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onChannelCreated={(id) => { loadChannels(); onSelectChannel(id); }}
      />
    </div>
  );
};

export default ChannelList;
