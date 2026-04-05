import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Paperclip, X, FileText, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { TablesInsert } from '@/integrations/supabase/types';

interface Props {
  channelId: string;
}

interface PendingFile {
  file: File;
  preview?: string;
}

const MessageInput = ({ channelId }: Props) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string }[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('profiles').select('user_id, full_name').then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('El archivo no puede superar 20 MB');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const preview = isImage ? URL.createObjectURL(file) : undefined;
    setPendingFile({ file, preview });
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removePendingFile = () => {
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview);
    setPendingFile(null);
  };

  const uploadFile = async (file: File): Promise<{ path: string; name: string; type: string } | null> => {
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(path, file, { contentType: file.type });

    if (error) {
      toast.error('Error al subir el archivo');
      return null;
    }

    return { path, name: file.name, type: file.type };
  };

  const handleSend = async () => {
    if ((!content.trim() && !pendingFile) || !user || sending) return;
    setSending(true);

    let attachment: { path: string; name: string; type: string } | null = null;

    if (pendingFile) {
      setUploading(true);
      attachment = await uploadFile(pendingFile.file);
      setUploading(false);
      if (!attachment) { setSending(false); return; }
    }

    const payload: TablesInsert<'chat_messages'> = {
      channel_id: channelId,
      user_id: user.id,
      content: content.trim() || '',
      attachment_url: attachment?.path ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
    };

    await supabase.from('chat_messages').insert(payload);

    setContent('');
    removePendingFile();
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      const query = val.slice(lastAt + 1).toLowerCase();
      if (!query.includes(' ')) {
        setMentionFilter(query);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (name: string) => {
    const lastAt = content.lastIndexOf('@');
    const before = content.slice(0, lastAt);
    setContent(`${before}@${name} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredProfiles = profiles.filter(p =>
    p.user_id !== user?.id && p.full_name.toLowerCase().includes(mentionFilter)
  );

  return (
    <div className="relative border-t border-border/50 p-3">
      {/* Mention suggestions */}
      {showMentions && filteredProfiles.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-auto">
          {filteredProfiles.map(p => (
            <button
              key={p.user_id}
              onClick={() => insertMention(p.full_name)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-popover-foreground"
            >
              @{p.full_name}
            </button>
          ))}
        </div>
      )}

      {/* Pending file preview */}
      {pendingFile && (
        <div className="mb-2 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          {pendingFile.preview ? (
            <img src={pendingFile.preview} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <span className="text-xs text-foreground/80 truncate flex-1">{pendingFile.file.name}</span>
          <button onClick={removePendingFile} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* File attach button */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Adjuntar archivo"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <textarea
          ref={inputRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje... (usa @ para mencionar)"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={(!content.trim() && !pendingFile) || sending}
          className="shrink-0"
        >
          {uploading || sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
