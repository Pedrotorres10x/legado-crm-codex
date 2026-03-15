import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Phone, Mail, Eye, Users, MessageCircle, CalendarCheck, FileText,
  DollarSign, Home, Clock, CheckCircle2, XCircle, AlertTriangle,
  Sparkles, Send, ArrowRight, Pencil, ChevronDown, ChevronUp,
  MessageSquare
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimelineEvent {
  id: string;
  date: string;
  type: 'interaction' | 'visit' | 'offer' | 'task' | 'match' | 'reengagement';
  subtype?: string;
  title: string;
  description?: string;
  status?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  propertyTitle?: string;
  amount?: number;
}

const interactionIcons: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  llamada: { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  email: { icon: Mail, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  visita: { icon: Eye, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  whatsapp: { icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  reunion: { icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  nota: { icon: Pencil, color: 'text-muted-foreground', bg: 'bg-muted' },
};

interface ContactTimelineProps {
  interactions: any[];
  visits: any[];
  offers: any[];
  tasks: any[];
  matches: any[];
  reengagement: any[];
  communicationLogs?: any[];
}

const ContactTimeline = ({ interactions, visits, offers, tasks, matches, reengagement, communicationLogs = [] }: ContactTimelineProps) => {
  const events = useMemo(() => {
    const items: TimelineEvent[] = [];

    // Interactions
    interactions.forEach(i => {
      const cfg = interactionIcons[i.interaction_type] || interactionIcons.nota;
      items.push({
        id: `int-${i.id}`,
        date: i.interaction_date,
        type: 'interaction',
        subtype: i.interaction_type,
        title: i.subject || `${i.interaction_type.charAt(0).toUpperCase() + i.interaction_type.slice(1)}`,
        description: i.description,
        icon: cfg.icon,
        color: cfg.color,
        bgColor: cfg.bg,
        propertyTitle: i.properties?.title,
      });
    });

    // Visits
    visits.forEach(v => {
      const isPast = new Date(v.visit_date) < new Date();
      items.push({
        id: `visit-${v.id}`,
        date: v.visit_date,
        type: 'visit',
        subtype: v.confirmation_status,
        title: `Visita${v.properties?.title ? ': ' + v.properties.title : ''}`,
        description: v.notes || (v.result ? `Resultado: ${v.result}` : undefined),
        status: v.confirmation_status,
        icon: isPast && v.confirmation_status === 'confirmado' ? CheckCircle2 : isPast && v.confirmation_status === 'cancelado' ? XCircle : CalendarCheck,
        color: v.confirmation_status === 'confirmado' ? 'text-green-600' : v.confirmation_status === 'cancelado' ? 'text-destructive' : 'text-blue-600',
        bgColor: v.confirmation_status === 'confirmado' ? 'bg-green-100 dark:bg-green-900/30' : v.confirmation_status === 'cancelado' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30',
        propertyTitle: v.properties?.title,
      });
    });

    // Offers
    offers.forEach(o => {
      items.push({
        id: `offer-${o.id}`,
        date: o.created_at,
        type: 'offer',
        subtype: o.status,
        title: `Oferta: ${Number(o.amount).toLocaleString('es-ES')} €`,
        description: o.notes,
        status: o.status,
        icon: DollarSign,
        color: o.status === 'aceptada' ? 'text-green-600' : o.status === 'rechazada' ? 'text-destructive' : 'text-amber-600',
        bgColor: o.status === 'aceptada' ? 'bg-green-100 dark:bg-green-900/30' : o.status === 'rechazada' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30',
        propertyTitle: o.properties?.title,
        amount: o.amount,
      });
    });

    // Tasks
    tasks.forEach(t => {
      const isPastDue = !t.completed && new Date(t.due_date) < new Date();
      items.push({
        id: `task-${t.id}`,
        date: t.completed_at || t.due_date,
        type: 'task',
        subtype: t.task_type,
        title: t.title,
        description: t.description,
        status: t.completed ? 'completada' : isPastDue ? 'vencida' : 'pendiente',
        icon: t.completed ? CheckCircle2 : isPastDue ? AlertTriangle : Clock,
        color: t.completed ? 'text-green-600' : isPastDue ? 'text-destructive' : 'text-amber-600',
        bgColor: t.completed ? 'bg-green-100 dark:bg-green-900/30' : isPastDue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30',
        propertyTitle: t.properties?.title,
      });
    });

    // Matches
    matches.forEach(m => {
      items.push({
        id: `match-${m.id}`,
        date: m.created_at,
        type: 'match',
        subtype: m.status,
        title: `Match${m.properties?.title ? ': ' + m.properties.title : ''}`,
        description: m.notes,
        status: m.status,
        icon: Send,
        color: m.status === 'interesado' ? 'text-green-600' : m.status === 'descartado' ? 'text-muted-foreground' : 'text-primary',
        bgColor: m.status === 'interesado' ? 'bg-green-100 dark:bg-green-900/30' : m.status === 'descartado' ? 'bg-muted' : 'bg-primary/10',
        propertyTitle: m.properties?.title,
      });
    });

    // Reengagement
    reengagement.forEach(r => {
      items.push({
        id: `reeng-${r.id}`,
        date: r.sent_at,
        type: 'reengagement',
        title: `Fidelización: ${r.message_type}`,
        description: r.message_preview,
        icon: Sparkles,
        color: 'text-violet-600',
        bgColor: 'bg-violet-100 dark:bg-violet-900/30',
      });
    });

    // Communication logs (detailed message content)
    communicationLogs.forEach(cl => {
      const isEmail = cl.channel === 'email';
      const statusIcon = cl.status === 'error' ? XCircle : cl.status === 'abierto' ? Eye : cl.status === 'rebotado' ? AlertTriangle : isEmail ? Mail : MessageSquare;
      const statusColor = cl.status === 'error' || cl.status === 'rebotado' ? 'text-destructive' : cl.status === 'abierto' ? 'text-green-600' : isEmail ? 'text-purple-600' : 'text-emerald-600';
      const statusBg = cl.status === 'error' || cl.status === 'rebotado' ? 'bg-red-100 dark:bg-red-900/30' : cl.status === 'abierto' ? 'bg-green-100 dark:bg-green-900/30' : isEmail ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30';

      items.push({
        id: `comm-${cl.id}`,
        date: cl.created_at,
        type: 'interaction',
        subtype: cl.channel,
        title: isEmail ? `📧 Email: ${cl.subject || '(sin asunto)'}` : `💬 WhatsApp`,
        description: cl.body_preview || undefined,
        status: cl.status,
        icon: statusIcon,
        color: statusColor,
        bgColor: statusBg,
      });
    });

    // Sort by date descending
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [interactions, visits, offers, tasks, matches, reengagement, communicationLogs]);

  const statusBadge = (event: TimelineEvent) => {
    if (!event.status) return null;
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pendiente: { variant: 'outline', label: 'Pendiente' },
      confirmado: { variant: 'default', label: 'Confirmado' },
      cancelado: { variant: 'destructive', label: 'Cancelado' },
      aceptada: { variant: 'default', label: 'Aceptada' },
      rechazada: { variant: 'destructive', label: 'Rechazada' },
      completada: { variant: 'default', label: 'Completada' },
      vencida: { variant: 'destructive', label: 'Vencida' },
      enviado: { variant: 'secondary', label: 'Enviado' },
      interesado: { variant: 'default', label: 'Interesado' },
      descartado: { variant: 'secondary', label: 'Descartado' },
    };
    const cfg = map[event.status];
    if (!cfg) return <Badge variant="outline" className="text-xs">{event.status}</Badge>;
    return <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>;
  };

  if (events.length === 0) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin actividad registrada</p>
          <p className="text-sm mt-1">Las interacciones, visitas, ofertas y tareas aparecerán aquí</p>
        </CardContent>
      </Card>
    );
  }

  // Group by month
  const grouped = events.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    const key = format(new Date(event.date), 'MMMM yyyy', { locale: es });
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([month, monthEvents]) => (
        <div key={month}>
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">{month}</p>
          </div>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-3">
              {monthEvents.map((event) => (
                <TimelineEventCard key={event.id} event={event} statusBadge={statusBadge} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/** Renders a single timeline event, with expandable description for long content */
const TimelineEventCard = ({
  event,
  statusBadge,
}: {
  event: TimelineEvent;
  statusBadge: (e: TimelineEvent) => React.ReactNode;
}) => {
  const hasAiSummary = event.description?.includes('🤖 Resumen IA:');
  const isLong = (event.description?.length ?? 0) > 120;
  const [expanded, setExpanded] = useState(false);

  // Split plain metadata from AI summary block
  const renderDescription = () => {
    if (!event.description) return null;

    if (hasAiSummary) {
      const [metaPart, aiPart] = event.description.split('\n🤖 Resumen IA:');
      return (
        <div className="mt-1 space-y-1.5">
          {metaPart && (
            <p className="text-xs text-muted-foreground whitespace-pre-line">{metaPart.trim()}</p>
          )}
          <div className="rounded-md bg-primary/5 border border-primary/15 p-2">
            <p className="text-[11px] font-semibold text-primary flex items-center gap-1 mb-1">
              <Sparkles className="h-3 w-3" /> Resumen IA
            </p>
            <p className="text-xs text-foreground/80 whitespace-pre-line">{aiPart?.trim()}</p>
          </div>
        </div>
      );
    }

    if (isLong) {
      return (
        <div className="mt-1">
          <p className={`text-xs text-muted-foreground whitespace-pre-line ${expanded ? '' : 'line-clamp-2'}`}>
            {event.description}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-0 text-xs text-primary mt-0.5 gap-0.5"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <><ChevronUp className="h-3 w-3" />Menos</> : <><ChevronDown className="h-3 w-3" />Más</>}
          </Button>
        </div>
      );
    }

    return <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{event.description}</p>;
  };

  return (
    <div className="relative flex gap-3 pl-0">
      {/* Icon circle */}
      <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${event.bgColor} ${event.color} ring-2 ring-background`}>
        <event.icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{event.title}</p>
            {event.propertyTitle && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Home className="h-3 w-3" />{event.propertyTitle}
              </p>
            )}
            {renderDescription()}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusBadge(event)}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(event.date), 'dd/MM HH:mm', { locale: es })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactTimeline;
