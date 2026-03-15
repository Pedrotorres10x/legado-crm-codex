import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GitMerge, Mail, MessageCircle, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface MatchRun {
  run_at: string;
  matches_created: number;
  emails_sent: number;
  emails_failed: number;
  whatsapp_sent: number;
  duration_ms: number | null;
  errors: string[] | null;
}

const LastMatchRunCard = () => {
  const [run, setRun] = useState<MatchRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('match_sender_logs')
      .select('run_at,matches_created,emails_sent,emails_failed,whatsapp_sent,duration_ms,errors')
      .order('run_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setRun(data);
        setLoading(false);
      });
  }, []);

  if (loading) return null;

  const hasErrors = run && ((run.errors?.length ?? 0) > 0 || run.emails_failed > 0);
  const statusColor = !run ? 'text-muted-foreground' : hasErrors ? 'text-amber-500' : 'text-emerald-500';
  const bgColor = !run ? 'bg-muted/50' : hasErrors ? 'bg-amber-500/10' : 'bg-emerald-500/10';

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgColor}`}>
            <GitMerge className={`h-5 w-5 ${statusColor}`} />
          </div>
          {!run ? (
            <p className="text-sm text-muted-foreground pt-2">Motor de cruces: sin ejecuciones registradas</p>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">Motor de cruces</p>
                <span className="text-xs text-muted-foreground">
                  hace {formatDistanceToNow(new Date(run.run_at), { locale: es })}
                </span>
                {run.duration_ms != null && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />{(run.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                <span className="flex items-center gap-1"><GitMerge className="h-3.5 w-3.5 text-primary" />{run.matches_created} matches</span>
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-blue-500" />{run.emails_sent} emails</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-green-500" />{run.whatsapp_sent} WA</span>
                {(run.emails_failed > 0 || (run.errors?.length ?? 0) > 0) && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {run.emails_failed + (run.errors?.length ?? 0)} errores
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LastMatchRunCard;
