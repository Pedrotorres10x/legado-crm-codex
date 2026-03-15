import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlarmClock, CheckCheck, CheckCircle, ListTodo, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const AUTO_TASK_SOURCE_LABELS: Record<string, string> = {
  closing_blocked: 'Auto cierre',
  closing_signature_pending: 'Auto firma',
  closing_deed_due: 'Auto escritura',
};

const isAutomaticTask = (task: { source?: string | null }) => Boolean(task.source && task.source !== 'manual');

type TaskLike = {
  id: string;
  title: string;
  description?: string | null;
  completed: boolean;
  completed_at?: string | null;
  due_date: string;
  priority?: string | null;
  task_type?: string | null;
  source?: string | null;
  property_id?: string | null;
  contact_id?: string | null;
};

type Props = {
  tasks: TaskLike[];
  taskFilter: 'all' | 'pending' | 'done';
  onTaskFilterChange: (value: 'all' | 'pending' | 'done') => void;
  onOpenTasks: () => void;
  onOpenNewTask: () => void;
  onToggleTask: (task: TaskLike) => void;
  onDeleteTask: (taskId: string) => void;
  getAutomaticTaskRoute: (task: TaskLike) => string;
  onOpenAutomaticTask: (route: string) => void;
};

export default function ContactTasksPanel({
  tasks,
  taskFilter,
  onTaskFilterChange,
  onOpenTasks,
  onOpenNewTask,
  onToggleTask,
  onDeleteTask,
  getAutomaticTaskRoute,
  onOpenAutomaticTask,
}: Props) {
  const filteredTasks = tasks.filter((task) => (
    taskFilter === 'all' ? true :
    taskFilter === 'pending' ? !task.completed :
    task.completed
  ));

  const priorityColors: Record<string, string> = {
    alta: 'border-l-destructive',
    media: 'border-l-amber-400',
    baja: 'border-l-muted-foreground',
  };

  const taskTypeLabels: Record<string, string> = {
    llamada: '📞 Llamada',
    email: '✉️ Email',
    visita: '🏠 Visita',
    reunion: '👥 Reunión',
    whatsapp: '💬 WhatsApp',
    otro: '📋 Otro',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant={taskFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => onTaskFilterChange('all')}>
            Todas
          </Button>
          <Button variant={taskFilter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => onTaskFilterChange('pending')}>
            Pendientes
          </Button>
          <Button variant={taskFilter === 'done' ? 'default' : 'outline'} size="sm" onClick={() => onTaskFilterChange('done')}>
            Completadas
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpenTasks}>
            Abrir bandeja
          </Button>
          <Button onClick={onOpenNewTask} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva tarea
          </Button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="py-10 text-center text-muted-foreground">
            <ListTodo className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin tareas</p>
            <p className="text-sm mt-1">Gestiona las tareas del contacto desde la bandeja central</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button onClick={onOpenTasks} size="sm" variant="outline">
                Abrir bandeja
              </Button>
              <Button onClick={onOpenNewTask} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />Nueva tarea
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const isPastDue = !task.completed && new Date(task.due_date) < new Date();
            const automatic = isAutomaticTask(task);

            return (
              <Card
                key={task.id}
                className={`border-0 shadow-sm border-l-2 ${priorityColors[task.priority || ''] || 'border-l-border'} ${task.completed ? 'opacity-60' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => onToggleTask(task)} className="mt-0.5 shrink-0">
                      {task.completed
                        ? <CheckCheck className="h-5 w-5 text-green-600" />
                        : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground hover:border-primary transition-colors" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{taskTypeLabels[task.task_type || ''] || task.task_type}</span>
                        {automatic && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-primary/30 text-primary">
                            {AUTO_TASK_SOURCE_LABELS[task.source || ''] || 'Auto'}
                          </Badge>
                        )}
                        <span className="text-xs">·</span>
                        <span className={`text-xs flex items-center gap-1 ${isPastDue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          <AlarmClock className="h-3 w-3" />
                          {format(new Date(task.due_date), 'dd MMM yyyy HH:mm', { locale: es })}
                          {isPastDue && ' · Vencida'}
                        </span>
                        {task.completed && task.completed_at && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completada {format(new Date(task.completed_at), 'dd/MM', { locale: es })}
                          </span>
                        )}
                      </div>
                      {automatic && (
                        <p className="text-[11px] text-primary mt-1">
                          Esta tarea se mantiene sincronizada automaticamente. Resuelvela desde su origen.
                        </p>
                      )}
                    </div>
                    {automatic ? (
                      <Button variant="outline" size="sm" onClick={() => onOpenAutomaticTask(getAutomaticTaskRoute(task))}>
                        Abrir origen
                      </Button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <Button variant="outline" size="sm" onClick={onOpenTasks}>
                          Abrir bandeja
                        </Button>
                        <button onClick={() => onDeleteTask(task.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
