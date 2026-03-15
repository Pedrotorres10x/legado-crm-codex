import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InternalCommentsProps {
  entityType: 'property' | 'contact';
  entityId: string;
}

const InternalComments = ({ entityType, entityId }: InternalCommentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('internal_comments' as any)
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    const items = (data || []) as any[];
    setComments(items);

    // Fetch profile names for unique user_ids
    const userIds = [...new Set(items.map((c: any) => c.user_id))];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      const map: Record<string, string> = {};
      (profileData || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }
  }, [entityType, entityId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleSend = async () => {
    if (!newComment.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from('internal_comments' as any).insert({
      entity_type: entityType,
      entity_id: entityId,
      user_id: user.id,
      content: newComment.trim(),
    } as any);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      setNewComment('');
      fetchComments();
    }
    setSending(false);
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase.from('internal_comments' as any).delete().eq('id', commentId);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else fetchComments();
  };

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Comentarios internos ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New comment input */}
        <div className="flex gap-2">
          <Textarea
            className="min-h-[60px] flex-1"
            placeholder="Escribe un comentario interno (solo visible para asesores)..."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <Button size="sm" disabled={!newComment.trim() || sending} onClick={handleSend} className="self-end">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {/* Comments list */}
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin comentarios. Añade notas internas sobre esta ficha.</p>
        ) : (
          <div className="space-y-3">
            {comments.map((c: any) => (
              <div key={c.id} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{profiles[c.user_id] || 'Asesor'}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), "dd MMM yyyy · HH:mm", { locale: es })}
                    </span>
                  </div>
                  {user?.id === c.user_id && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InternalComments;
