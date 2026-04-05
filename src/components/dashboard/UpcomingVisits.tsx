import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin } from 'lucide-react';
import AddToGoogleCalendarButton from '@/components/AddToGoogleCalendarButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { differenceInHours, isToday } from 'date-fns';

type VisitContact = { full_name: string | null } | null;
type VisitProperty = { title: string | null; address: string | null } | null;
type UpcomingVisitItem = {
  id: string;
  visit_date: string;
  confirmation_status: string | null;
  contacts: VisitContact;
  properties: VisitProperty;
};

const UpcomingVisits = () => {
  const { user } = useAuth();
  const [visits, setVisits] = useState<UpcomingVisitItem[]>([]);

  useEffect(() => {
    const fetchVisits = async () => {
      let query = supabase
        .from('visits')
        .select('id, visit_date, confirmation_status, contacts(full_name), properties(title, address)')
        .gte('visit_date', new Date().toISOString())
        .order('visit_date', { ascending: true })
        .limit(6);
      if (user?.id) query = query.eq('agent_id', user.id);
      const { data } = await query;
      setVisits((data ?? []) as UpcomingVisitItem[]);
    };
    fetchVisits();
  }, [user?.id]);

  const pendingConfirmation = visits.filter((visit) => visit.confirmation_status !== 'confirmada').length;
  const visitsToday = visits.filter((visit) => isToday(new Date(visit.visit_date))).length;
  const imminentVisits = visits.filter((visit) => differenceInHours(new Date(visit.visit_date), new Date()) <= 24).length;

  const statusBadge = (s: string) => {
    if (s === 'confirmada') return <Badge variant="default" className="text-[10px]">Confirmada</Badge>;
    if (s === 'cancelada') return <Badge variant="destructive" className="text-[10px]">Cancelada</Badge>;
    return <Badge variant="outline" className="text-[10px]">Pendiente</Badge>;
  };

  return (
    <Card className="animate-fade-in-up stagger-6 border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-display">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Clock className="h-4 w-4" />
          </div>
          Próximas Visitas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visits.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {visitsToday > 0 && <Badge variant="secondary">{visitsToday} hoy</Badge>}
            {imminentVisits > 0 && <Badge variant="outline">{imminentVisits} en 24h</Badge>}
            {pendingConfirmation > 0 && <Badge variant="destructive">{pendingConfirmation} sin confirmar</Badge>}
          </div>
        )}
        {visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Clock className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No hay visitas programadas</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Las visitas agendadas aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map(v => (
              <div key={v.id} className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{v.contacts?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.properties?.title || v.properties?.address}</p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-1">
                  <div>
                    <p className="text-xs font-medium">{format(new Date(v.visit_date), "d MMM HH:mm", { locale: es })}</p>
                    {statusBadge(v.confirmation_status)}
                  </div>
                  <AddToGoogleCalendarButton
                    visitDate={v.visit_date}
                    propertyTitle={v.properties?.title ?? undefined}
                    contactName={v.contacts?.full_name ?? undefined}
                    propertyAddress={v.properties?.address ?? undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingVisits;
