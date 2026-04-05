import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, GitMerge, ListTodo, LucideIcon } from 'lucide-react';

type Metric = {
  icon: LucideIcon;
  label: string;
  value: number;
  helper: string;
};

type Props = {
  interactionsCount: number;
  pendingTasksCount: number;
  visitsCount: number;
  matchesCount: number;
};

export default function ContactDetailMetrics({
  interactionsCount,
  pendingTasksCount,
  visitsCount,
  matchesCount,
}: Props) {
  const metrics: Metric[] = [
    { icon: Clock, label: 'Interacciones', value: interactionsCount, helper: interactionsCount === 0 ? 'Aun no hay seguimiento' : 'Seguimiento registrado' },
    { icon: ListTodo, label: 'Tareas pendientes', value: pendingTasksCount, helper: pendingTasksCount === 0 ? 'Nada pendiente ahora' : 'Trabajo en curso' },
    { icon: Calendar, label: 'Visitas', value: visitsCount, helper: visitsCount === 0 ? 'Sin visitas registradas' : 'Actividad de campo' },
    { icon: GitMerge, label: 'Cruces', value: matchesCount, helper: matchesCount === 0 ? 'No hay cruces activos' : 'Oportunidades abiertas' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border-border/60 bg-gradient-to-r from-card via-card to-muted/15 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
              <metric.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground">{metric.value}</p>
              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
              <p className="text-[11px] text-muted-foreground">{metric.helper}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
