import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Database } from '@/integrations/supabase/types';
import { Building, Calendar, Clock, DollarSign, FolderOpen, TrendingUp } from 'lucide-react';

type ContactRow = Database['public']['Tables']['contacts']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];

type Props = {
  contact: ContactRow;
  demandsCount: number;
  matchesCount: number;
  callsCount: number;
  visitsCount: number;
  offersCount: number;
  tasks: TaskRow[];
  reengagementCount: number;
};

export default function ContactDetailTabsList({
  contact,
  demandsCount,
  matchesCount,
  callsCount,
  visitsCount,
  offersCount,
  tasks,
  reengagementCount,
}: Props) {
  const hasOverdueTasks = tasks.some((task) => !task.completed && new Date(task.due_date) < new Date());
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;

  const actividadCount = callsCount;
  const agendaCount = pendingTasksCount + visitsCount;
  const negocioCount = demandsCount + matchesCount;
  const pipelineCount = offersCount + reengagementCount;

  return (
    <TabsList className="flex-wrap sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <TabsTrigger value="actividad" className="gap-2">
        <Clock className="h-4 w-4" />
        Actividad{actividadCount > 0 ? ` (${actividadCount})` : ''}
      </TabsTrigger>
      <TabsTrigger value="agenda" className="gap-2 relative">
        <Calendar className="h-4 w-4" />
        Agenda{agendaCount > 0 ? ` (${agendaCount})` : ''}
        {hasOverdueTasks && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />}
      </TabsTrigger>
      <TabsTrigger id="tab-negocio" value="negocio" className="gap-2">
        <Building className="h-4 w-4" />
        Negocio{negocioCount > 0 ? ` (${negocioCount})` : ''}
      </TabsTrigger>
      <TabsTrigger value="pipeline" className="gap-2">
        <TrendingUp className="h-4 w-4" />
        Pipeline{pipelineCount > 0 ? ` (${pipelineCount})` : ''}
      </TabsTrigger>
      <TabsTrigger value="documentos" className="gap-2">
        <FolderOpen className="h-4 w-4" />
        Documentos
      </TabsTrigger>
    </TabsList>
  );
}
