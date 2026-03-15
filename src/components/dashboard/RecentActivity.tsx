import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ArrowUpRight, Phone, Mail, Eye, MessageCircle, Users, FileText, PenTool, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const typeIcons: Record<string, React.ElementType> = {
  llamada: Phone, email: Mail, visita: Eye, whatsapp: MessageCircle, reunion: Users, nota: FileText,
};

type ActivityItem = {
  id: string;
  kind: 'interaction' | 'contract' | 'closing_task';
  title: string;
  subtitle?: string;
  at: string;
  icon: React.ElementType;
};

const RecentActivity = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const fetchActivities = async () => {
      let interactionsQuery = supabase
        .from('interactions')
        .select('id, interaction_type, subject, interaction_date, contacts(full_name)')
        .order('interaction_date', { ascending: false })
        .limit(6);
      let contractsQuery = supabase
        .from('generated_contracts')
        .select('id, created_at, signature_status, contacts(full_name), properties(title), contract_templates(name, category)')
        .order('created_at', { ascending: false })
        .limit(4);
      let tasksQuery = supabase
        .from('tasks')
        .select('id, title, source, created_at, property_id')
        .in('source', ['closing_blocked', 'closing_signature_pending', 'closing_deed_due'])
        .order('created_at', { ascending: false })
        .limit(4);

      if (user?.id) {
        interactionsQuery = interactionsQuery.eq('agent_id', user.id);
        contractsQuery = contractsQuery.eq('agent_id', user.id);
        tasksQuery = tasksQuery.eq('agent_id', user.id);
      }

      const [interactionsRes, contractsRes, tasksRes] = await Promise.all([
        interactionsQuery,
        contractsQuery,
        tasksQuery,
      ]);

      const interactionItems: ActivityItem[] = (interactionsRes.data || []).map((activity: any) => ({
        id: `interaction-${activity.id}`,
        kind: 'interaction',
        title: activity.subject || activity.interaction_type,
        subtitle: activity.contacts?.full_name || undefined,
        at: activity.interaction_date,
        icon: typeIcons[activity.interaction_type] || FileText,
      }));

      const contractItems: ActivityItem[] = (contractsRes.data || []).map((contract: any) => {
        const statusLabel = contract.signature_status === 'firmado'
          ? 'Contrato firmado'
          : contract.signature_status === 'pendiente'
            ? 'Contrato enviado a firma'
            : 'Contrato generado';
        const subject = contract.properties?.title || contract.contacts?.full_name || contract.contract_templates?.name || 'Contrato';

        return {
          id: `contract-${contract.id}`,
          kind: 'contract',
          title: statusLabel,
          subtitle: subject,
          at: contract.created_at,
          icon: PenTool,
        };
      });

      const taskItems: ActivityItem[] = (tasksRes.data || []).map((task: any) => ({
        id: `task-${task.id}`,
        kind: 'closing_task',
        title: task.title,
        subtitle: task.source === 'closing_blocked'
          ? 'Bloqueo operativo detectado'
          : task.source === 'closing_signature_pending'
            ? 'Firma pendiente automatizada'
            : 'Escritura cercana o vencida',
        at: task.created_at,
        icon: ShieldAlert,
      }));

      const merged = [...interactionItems, ...contractItems, ...taskItems]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 8);

      setActivities(merged);
    };
    fetchActivities();
  }, [user?.id]);

  return (
    <Card className="animate-fade-in-up stagger-5 border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-display">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="h-4 w-4" />
          </div>
          Actividad Reciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <ArrowUpRight className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Empieza añadiendo propiedades y contactos</p>
            <p className="text-xs text-muted-foreground/60 mt-1">para ver actividad aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map(a => {
              const Icon = a.icon;
              return (
                <div key={a.id} className="flex items-center gap-3 text-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.subtitle}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(a.at), { addSuffix: true, locale: es })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivity;
