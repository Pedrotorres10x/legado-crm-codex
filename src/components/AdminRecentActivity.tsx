import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Phone, Mail, Eye, MessageCircle, Users, FileText, ArrowUpRight, GitMerge, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const typeIcons: Record<string, React.ElementType> = {
  llamada: Phone, email: Mail, visita: Eye, whatsapp: MessageCircle, reunion: Users, nota: FileText,
};

const typeLabels: Record<string, string> = {
  llamada: 'Llamada', email: 'Email', visita: 'Visita', whatsapp: 'WhatsApp', reunion: 'Reunión', nota: 'Nota', cafe_comida: 'Café/Comida',
};
type InteractionActivityRow = {
  id: string;
  interaction_type: string;
  subject?: string | null;
  description?: string | null;
  interaction_date: string;
  agent_id?: string | null;
  contacts?: { full_name?: string | null } | null;
  properties?: { title?: string | null } | null;
  profiles?: { full_name?: string | null } | null;
};

const AdminRecentActivity = () => {
  const [activities, setActivities] = useState<InteractionActivityRow[]>([]);
  const [limit, setLimit] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('interactions')
        .select('id, interaction_type, subject, description, interaction_date, agent_id, contacts(full_name), properties(title), profiles:agent_id(full_name)')
        .order('interaction_date', { ascending: false })
        .limit(limit);
      setActivities((data || []) as InteractionActivityRow[]);
      setLoading(false);
    };
    fetch();
  }, [limit]);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-display">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          Actividad Reciente Global
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando actividad...</p>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <ArrowUpRight className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No hay actividad registrada</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {activities.map(a => {
                const Icon = typeIcons[a.interaction_type] || FileText;
                const agentName = a.profiles?.full_name;
                const contactName = a.contacts?.full_name;
                const propertyTitle = a.properties?.title;
                return (
                  <div key={a.id} className="flex items-start gap-3 text-sm p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="font-medium truncate">{a.subject || typeLabels[a.interaction_type] || a.interaction_type}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {contactName && <Badge variant="secondary" className="text-xs font-normal">{contactName}</Badge>}
                        {agentName && <Badge variant="outline" className="text-xs font-normal">{agentName}</Badge>}
                        {propertyTitle && (
                          <Badge variant="outline" className="text-xs font-normal gap-1">
                            <Home className="h-3 w-3" />{propertyTitle}
                          </Badge>
                        )}
                      </div>
                      {a.description && <p className="text-xs text-muted-foreground line-clamp-1">{a.description}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                      {formatDistanceToNow(new Date(a.interaction_date), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                );
              })}
            </div>
            {activities.length >= limit && (
              <div className="text-center mt-4">
                <Button variant="outline" size="sm" onClick={() => setLimit(l => l + 30)}>Cargar más</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminRecentActivity;
