import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, MessageCircle, FileText, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MessageInput from './MessageInput';

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
}

interface Channel {
  id: string;
  name: string;
  is_direct: boolean;
  description: string | null;
}

interface Props {
  channelId: string | null;
  onNewMessage?: () => void;
}

const MessageArea = ({ channelId, onNewMessage }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  // Generate signed URL for a storage path
  const getSignedUrl = useCallback(async (path: string) => {
    if (!path) return '';
    // If it's already a full URL (legacy data), return as-is
    if (path.startsWith('http')) return path;
    if (signedUrls[path]) return signedUrls[path];
    
    const { data } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(path, 3600);
    
    if (data?.signedUrl) {
      setSignedUrls(prev => ({ ...prev, [path]: data.signedUrl }));
      return data.signedUrl;
    }
    return '';
  }, [signedUrls]);

  // Pre-fetch signed URLs for messages with attachments
  useEffect(() => {
    const paths = messages
      .filter(m => m.attachment_url && !m.attachment_url.startsWith('http') && !signedUrls[m.attachment_url])
      .map(m => m.attachment_url!);
    
    if (paths.length === 0) return;
    
    paths.forEach(path => getSignedUrl(path));
  }, [messages, signedUrls, getSignedUrl]);

  useEffect(() => {
    supabase.from('profiles').select('user_id, full_name').then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(p => { map[p.user_id] = p.full_name; });
        setProfiles(map);
      }
    });
  }, []);

  useEffect(() => {
    if (!channelId) return;

    // Load channel info
    supabase.from('chat_channels').select('*').eq('id', channelId).single().then(({ data }) => {
      if (data) setChannel(data);
    });

    // Load messages
    supabase.from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (data) setMessages(data);
      });

    // Mark as read
    if (user) {
      supabase.from('chat_channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .then(() => {});
    }

    // Realtime subscription
    const sub = supabase
      .channel(`chat-${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channelId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
        onNewMessage?.();

        // Mark as read
        if (user) {
          supabase.from('chat_channel_members')
            .update({ last_read_at: new Date().toISOString() })
            .eq('channel_id', channelId)
            .eq('user_id', user.id)
            .then(() => {});
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [channelId, user]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!channelId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Selecciona un canal o conversación</p>
          <p className="text-sm">para empezar a chatear</p>
        </div>
      </div>
    );
  }

  const renderContent = (content: string) => {
    // Highlight @mentions
    return content.replace(/@(\S+)/g, (match) => match).split(/(@\S+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="bg-primary/20 text-primary rounded px-1 font-medium">{part}</span>;
      }
      return part;
    });
  };

  // Get DM partner name
  const getChannelTitle = () => {
    if (!channel) return '';
    if (!channel.is_direct) return `# ${channel.name}`;
    // For DM, we'd need the other user's name - simplified
    return 'Mensaje Directo';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Channel header */}
      <div className="px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {channel?.is_direct ? (
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Hash className="h-5 w-5 text-muted-foreground" />
          )}
          <h3 className="font-semibold text-foreground">{channel?.is_direct ? 'Mensaje Directo' : channel?.name}</h3>
        </div>
        {channel?.description && (
          <p className="text-xs text-muted-foreground mt-0.5 ml-7">{channel.description}</p>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-3">
          {messages.map((msg, idx) => {
            const isMe = msg.user_id === user?.id;
            const showAvatar = idx === 0 || messages[idx - 1].user_id !== msg.user_id ||
              new Date(msg.created_at).getTime() - new Date(messages[idx - 1].created_at).getTime() > 300000;

            return (
              <div key={msg.id} className={cn("group", showAvatar ? "mt-4" : "mt-0.5")}>
                {showAvatar && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    )}>
                      {(profiles[msg.user_id] || '?')[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{profiles[msg.user_id] || 'Usuario'}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(msg.created_at), "HH:mm", { locale: es })}
                    </span>
                  </div>
                )}
                <div className="pl-9 space-y-1">
                  {msg.content && (
                    <div className="text-sm text-foreground/90 leading-relaxed">
                      {renderContent(msg.content)}
                    </div>
                  )}
                  {msg.attachment_url && (() => {
                    const url = msg.attachment_url!.startsWith('http') 
                      ? msg.attachment_url! 
                      : signedUrls[msg.attachment_url!] || '';
                    if (!url) return null;
                    return msg.attachment_type?.startsWith('image/') ? (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={msg.attachment_name || 'imagen'}
                          className="max-w-xs max-h-60 rounded-lg border border-border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ) : (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors text-sm text-foreground max-w-xs"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate flex-1">{msg.attachment_name || 'Documento'}</span>
                        <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    );
                  })()}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <MessageInput channelId={channelId} />
    </div>
  );
};

export default MessageArea;
