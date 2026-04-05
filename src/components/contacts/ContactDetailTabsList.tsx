import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Database } from '@/integrations/supabase/types';
import { Building, Calendar, Clock, DollarSign, FolderOpen, GitMerge, Heart, ListTodo, Mail, Phone, Search as SearchIcon } from 'lucide-react';

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
  const canShowReengagement = contact.contact_type === 'propietario' || contact.contact_type === 'comprador_cerrado' || contact.contact_type === 'vendedor_cerrado';

  return (
    <TabsList className="flex-wrap sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <TabsTrigger value="timeline" className="gap-2"><Clock className="h-4 w-4" />Timeline</TabsTrigger>
      <TabsTrigger id="tab-inmuebles" value="properties" className="gap-2"><Building className="h-4 w-4" />Propiedades</TabsTrigger>
      <TabsTrigger value="demands" className="gap-2"><SearchIcon className="h-4 w-4" />Demandas ({demandsCount})</TabsTrigger>
      <TabsTrigger value="matches" className="gap-2"><GitMerge className="h-4 w-4" />Cruces ({matchesCount})</TabsTrigger>
      <TabsTrigger value="calls" className="gap-2"><Phone className="h-4 w-4" />Llamadas ({callsCount})</TabsTrigger>
      <TabsTrigger value="visits" className="gap-2"><Calendar className="h-4 w-4" />Visitas ({visitsCount})</TabsTrigger>
      <TabsTrigger value="offers" className="gap-2"><DollarSign className="h-4 w-4" />Ofertas ({offersCount})</TabsTrigger>
      <TabsTrigger value="tasks" className="gap-2 relative">
        <ListTodo className="h-4 w-4" />Tareas ({tasks.length})
        {hasOverdueTasks && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />}
      </TabsTrigger>
      {canShowReengagement && (
        <TabsTrigger value="reengagement" className="gap-2"><Heart className="h-4 w-4" />Fidelización ({reengagementCount})</TabsTrigger>
      )}
      <TabsTrigger value="emails" className="gap-2"><Mail className="h-4 w-4" />Comunicaciones</TabsTrigger>
      <TabsTrigger value="documents" className="gap-2"><FolderOpen className="h-4 w-4" />Documentos</TabsTrigger>
    </TabsList>
  );
}
