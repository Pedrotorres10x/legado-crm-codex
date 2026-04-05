import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Phone, Mail, Eye, Users, MessageCircle, CalendarCheck, MoreHorizontal,
  Clock, AlertTriangle, CheckCircle2, Trash2, Pencil, Filter, CalendarPlus,
  RefreshCw, CalendarDays, List, Search
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, isThisWeek, addDays, startOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { openGoogleCalendar } from '@/lib/google-calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import TaskEditorDialog from '@/components/tasks/TaskEditorDialog';
import { useTaskEditor } from '@/hooks/useTaskEditor';
import { useTasksData, type Task } from '@/hooks/useTasksData';

const TASK_TYPES = [
  { value: 'llamada', label: 'Llamada', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'visita', label: 'Visita', icon: Eye },
  { value: 'reunion', label: 'Reunión', icon: Users },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'seguimiento', label: 'Seguimiento', icon: CalendarCheck },
  { value: 'otro', label: 'Otro', icon: MoreHorizontal },
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Sin repetición' },
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
];

const PRIORITIES = [
  { value: 'alta', label: 'Alta', color: 'bg-destructive' },
  { value: 'media', label: 'Media', color: 'bg-warning' },
  { value: 'baja', label: 'Baja', color: 'bg-primary' },
];

const AUTO_TASK_SOURCE_LABELS: Record<string, string> = {
  closing_blocked: 'Auto cierre',
  closing_signature_pending: 'Auto firma',
  closing_deed_due: 'Auto escritura',
};

type TaskWithRecurrence = Task & {
  recurrence?: string | null;
};

const isAutomaticTask = (task: Pick<Task, 'source'>) => Boolean(task.source && task.source !== 'manual');

const getAutomaticTaskRoute = (task: Pick<Task, 'source' | 'property_id' | 'contact_id'>) => {
  if (task.property_id && ['closing_blocked', 'closing_signature_pending', 'closing_deed_due'].includes(task.source || '')) {
    return `/properties/${task.property_id}#cierre`;
  }

  if (task.contact_id) {
    return `/contacts/${task.contact_id}`;
  }

  return '/tasks';
};

// ─── Agenda Week View ────────────────────────────────────────────────────────
const AgendaView = ({ tasks, onComplete, onEdit, onDelete }: {
  tasks: Task[];
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
}) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));

  const getTasksForDay = (day: Date) =>
    tasks.filter(t => !t.completed && isSameDay(new Date(t.due_date), day));

  const overdue = tasks.filter(t => !t.completed && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));

  const TypeIcon = ({ type }: { type: string }) => {
    const found = TASK_TYPES.find(t => t.value === type);
    if (!found) return null;
    const I = found.icon;
    return <I className="h-3.5 w-3.5" />;
  };

  const TaskRow = ({ task }: { task: Task }) => {
    const priorityDot = PRIORITIES.find(p => p.value === task.priority);
    const automatic = isAutomaticTask(task);
    return (
      <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 group transition-colors">
        <Checkbox checked={task.completed} onCheckedChange={() => onComplete(task)} className="shrink-0" />
        <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', priorityDot?.color || 'bg-muted')} />
        <span className="text-muted-foreground shrink-0"><TypeIcon type={task.task_type} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.title}</p>
          {task.contacts?.full_name && (
            <p className="text-xs text-muted-foreground truncate">👤 {task.contacts.full_name}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{format(new Date(task.due_date), 'HH:mm')}</span>
        {task.recurrence && <Tooltip><TooltipTrigger asChild><span><RefreshCw className="h-3 w-3 text-primary shrink-0" /></span></TooltipTrigger><TooltipContent>Recurrente</TooltipContent></Tooltip>}
        {task.source && task.source !== 'manual' && (
          <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/30 text-primary">
            {AUTO_TASK_SOURCE_LABELS[task.source] || 'Auto'}
          </Badge>
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!automatic && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(task)}><Pencil className="h-3 w-3" /></Button>}
          {!automatic && <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(task.id)}><Trash2 className="h-3 w-3" /></Button>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Overdue section */}
      {overdue.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Vencidas ({overdue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-2 pb-2">
            {overdue.map(t => <TaskRow key={t.id} task={t} />)}
          </CardContent>
        </Card>
      )}

      {/* Days */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {days.map(day => {
          const dayTasks = getTasksForDay(day);
          const isCurrentDay = isToday(day);
          return (
            <Card
              key={day.toISOString()}
              className={cn(
                'transition-all',
                isCurrentDay ? 'border-primary/40 shadow-sm ring-1 ring-primary/20' : 'border-border/50'
              )}
            >
              <CardHeader className="py-2.5 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn('text-xs font-semibold uppercase tracking-wider', isCurrentDay ? 'text-primary' : 'text-muted-foreground')}>
                      {format(day, 'EEEE', { locale: es })}
                    </p>
                    <p className={cn('text-lg font-bold leading-none mt-0.5', isCurrentDay ? 'text-primary' : 'text-foreground')}>
                      {format(day, 'd MMM', { locale: es })}
                    </p>
                  </div>
                  {dayTasks.length > 0 && (
                    <Badge variant={isCurrentDay ? 'default' : 'secondary'} className="text-xs">
                      {dayTasks.length}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="py-0 px-2 pb-2 min-h-[60px]">
                {dayTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 px-2 italic">Sin tareas</p>
                ) : (
                  dayTasks.map(t => <TaskRow key={t.id} task={t} />)
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Tasks Page ─────────────────────────────────────────────────────────
const Tasks = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedContactId = searchParams.get('contact_id');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [tab, setTab] = useState('pendientes');
  const [viewMode, setViewMode] = useState<'list' | 'agenda'>('list');
  const [searchText, setSearchText] = useState('');
  const { tasks, contacts, properties, loading, fetchTasks, toggleComplete, deleteTask } = useTasksData({
    userId: user?.id,
  });
  const {
    dialogOpen,
    editingTask,
    form,
    setForm,
    formErrors,
    saving,
    closeDialog,
    openNew,
    openEdit,
    handleSave,
  } = useTaskEditor({
    userId: user?.id,
    onSaved: fetchTasks,
  });

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      const contactId = searchParams.get('contact_id') || '';
      openNew(contactId);
    }
    const sourceFilter = searchParams.get('source');
    if (sourceFilter === 'automatic') {
      setFilterSource('automatic');
    }
  }, [openNew, searchParams]);

  const handleEditTask = (task: Task) => {
    if (isAutomaticTask(task)) {
      toast.info('Esta tarea automatica se gestiona desde la operacion o contacto relacionado.');
      navigate(getAutomaticTaskRoute(task));
      return;
    }
    openEdit(task);
  };

  const getDueBadge = (task: Task) => {
    if (task.completed) return <Badge variant="secondary" className="border-0 text-muted-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Completada</Badge>;
    const d = new Date(task.due_date);
    if (isPast(d) && !isToday(d)) return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Vencida</Badge>;
    if (isToday(d)) return <Badge className="bg-warning/20 text-warning border-0"><Clock className="h-3 w-3 mr-1" />Hoy</Badge>;
    if (isTomorrow(d)) return <Badge className="bg-primary/10 text-primary border-0"><Clock className="h-3 w-3 mr-1" />Mañana</Badge>;
    if (isThisWeek(d, { weekStartsOn: 1 })) return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Esta semana</Badge>;
    return <Badge variant="outline">{format(d, 'dd MMM', { locale: es })}</Badge>;
  };

  const filtered = tasks.filter(t => {
    if (linkedContactId && t.contact_id !== linkedContactId) return false;
    if (tab === 'pendientes' && t.completed) return false;
    if (tab === 'completadas' && !t.completed) return false;
    if (tab === 'vencidas' && (t.completed || (!isPast(new Date(t.due_date)) || isToday(new Date(t.due_date))))) return false;
    if (filterType !== 'all' && t.task_type !== filterType) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterSource === 'manual' && t.source && t.source !== 'manual') return false;
    if (filterSource === 'automatic' && (!t.source || t.source === 'manual')) return false;
    if (filterSource.startsWith('source:') && t.source !== filterSource.replace('source:', '')) return false;
    // Text search filter
    if (searchText && searchText.length >= 2) {
      const q = searchText.toLowerCase();
      const fields = [t.title, t.description, t.contacts?.full_name, t.properties?.title].map(f => (f || '').toLowerCase());
      if (!fields.some(f => f.includes(q))) return false;
    }
    return true;
  });

  const overdue = tasks.filter(t => !t.completed && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length;
  const todayCount = tasks.filter(t => !t.completed && isToday(new Date(t.due_date))).length;
  const recurringCount = tasks.filter((t) => !t.completed && (t as TaskWithRecurrence).recurrence).length;
  const openAutomaticTasks = tasks.filter(t => !t.completed && t.source && t.source !== 'manual').length;
  const autoClosingTasks = tasks.filter(t => !t.completed && ['closing_blocked', 'closing_signature_pending', 'closing_deed_due'].includes(t.source || '')).length;

  const TypeIcon = ({ type }: { type: string }) => {
    const found = TASK_TYPES.find(t => t.value === type);
    if (!found) return null;
    const I = found.icon;
    return <I className="h-4 w-4" />;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start md:items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-display font-bold">Planificación</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 flex flex-wrap gap-1">
            {overdue > 0 && <span className="text-destructive font-medium">{overdue} vencida{overdue > 1 ? 's' : ''} ·</span>}
            {todayCount > 0 && <span className="text-warning font-medium">{todayCount} hoy ·</span>}
            {recurringCount > 0 && <span className="text-primary font-medium"><RefreshCw className="inline h-3 w-3 mr-0.5" />{recurringCount} rec. ·</span>}
            {openAutomaticTasks > 0 && <span className="text-primary font-medium">{openAutomaticTasks} auto ·</span>}
            {autoClosingTasks > 0 && <span className="text-rose-600 font-medium">{autoClosingTasks} cierre/firma ·</span>}
            <span>{tasks.filter(t => !t.completed).length} pendientes</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5 gap-0.5">
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className="h-7 px-2.5"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'agenda' ? 'default' : 'ghost'}
              className="h-7 px-2.5"
              onClick={() => setViewMode('agenda')}
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </Button>
          </div>
          {!isMobile && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nueva tarea</Button>}
        </div>
      </div>

      <Card className="border-0 shadow-card bg-muted/40">
        <CardContent className="py-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium">Vista de planificación y mantenimiento</p>
            <p className="text-muted-foreground text-xs mt-1">
              Aquí organizas agenda, recurrencias y edición detallada. Para trabajar prioridades del día, usa `Operaciones`.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/operations')}>
            Abrir operaciones
          </Button>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Buscar tareas por título, contacto, propiedad..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
      </div>

      {linkedContactId && (
        <Card className="border-0 shadow-card bg-primary/5">
          <CardContent className="py-3 text-sm text-primary">
            Mostrando solo tareas vinculadas al contacto actual.
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Prioridad</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Origen</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="automatic">Automatica</SelectItem>
            <SelectItem value="source:closing_blocked">Auto cierre</SelectItem>
            <SelectItem value="source:closing_signature_pending">Auto firma</SelectItem>
            <SelectItem value="source:closing_deed_due">Auto escritura</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Agenda view */}
      {viewMode === 'agenda' ? (
        <AgendaView tasks={filtered} onComplete={toggleComplete} onEdit={openEdit} onDelete={deleteTask} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
            <TabsTrigger value="vencidas">
              Vencidas {overdue > 0 && <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{overdue}</span>}
            </TabsTrigger>
            <TabsTrigger value="completadas">Completadas</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {filtered.length === 0 ? (
              <Card className="border-0 shadow-card">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No hay tareas {tab === 'pendientes' ? 'pendientes' : tab === 'vencidas' ? 'vencidas' : tab === 'completadas' ? 'completadas' : ''}</p>
                  <p className="text-sm mt-1">Crea una nueva tarea para empezar a organizar tu trabajo</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map(task => {
                  const priorityDot = PRIORITIES.find(p => p.value === task.priority);
                  const automatic = isAutomaticTask(task);
                  return (
                    <Card key={task.id} className={`border-0 shadow-card transition-all ${task.completed ? 'opacity-60' : ''}`}>
                      <CardContent className="py-3 px-4 flex items-center gap-3">
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => toggleComplete(task)}
                          className="mt-0.5"
                        />
                        <div className={`h-2 w-2 rounded-full shrink-0 ${priorityDot?.color || 'bg-muted'}`} title={`Prioridad ${task.priority}`} />
                        <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                          <TypeIcon type={task.task_type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                            {(task as TaskWithRecurrence).recurrence && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span><RefreshCw className="h-3 w-3 text-primary shrink-0" /></span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Tarea recurrente · {RECURRENCE_OPTIONS.find(r => r.value === (task as TaskWithRecurrence).recurrence)?.label}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {task.source && task.source !== 'manual' && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/30 text-primary">
                                {AUTO_TASK_SOURCE_LABELS[task.source] || 'Auto'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            {task.contacts?.full_name && <span className="truncate">👤 {task.contacts.full_name}</span>}
                            {task.properties?.title && <span className="truncate">🏠 {task.properties.title}</span>}
                            <span>{format(new Date(task.due_date), 'dd/MM HH:mm', { locale: es })}</span>
                          </div>
                          {automatic && (
                            <p className="text-[11px] text-primary mt-1">
                              Se actualiza automaticamente. Resuelvela desde su ficha relacionada o completala cuando quede cerrada.
                            </p>
                          )}
                        </div>
                        {getDueBadge(task)}
                        <div className="flex gap-1 shrink-0">
                          {!task.completed && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                  onClick={e => {
                                    e.stopPropagation();
                                    openGoogleCalendar({
                                      title: task.title,
                                      startDate: new Date(task.due_date),
                                      durationMinutes: 30,
                                      description: [
                                        task.contacts?.full_name ? `Contacto: ${task.contacts.full_name}` : '',
                                        task.properties?.title ? `Inmueble: ${task.properties.title}` : '',
                                        task.description || '',
                                      ].filter(Boolean).join('\n'),
                                    });
                                  }}
                                >
                                  <CalendarPlus className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Añadir a Google Calendar</TooltipContent>
                            </Tooltip>
                          )}
                          {automatic ? (
                            <Button size="sm" variant="outline" onClick={() => navigate(getAutomaticTaskRoute(task))}>
                              Abrir origen
                            </Button>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditTask(task)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteTask(task.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <TaskEditorDialog
        open={dialogOpen}
        onOpenChange={closeDialog}
        editing={Boolean(editingTask)}
        form={form}
        setForm={setForm}
        formErrors={formErrors}
        saving={saving}
        onSubmit={handleSave}
        taskTypes={TASK_TYPES.map(({ value, label }) => ({ value, label }))}
        priorities={PRIORITIES.map(({ value, label }) => ({ value, label }))}
        recurrenceOptions={RECURRENCE_OPTIONS}
        contacts={contacts}
        properties={properties}
      />

      {/* Mobile FAB */}
      {isMobile && (
        <button
          onClick={openNew}
          className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 4px 20px hsl(var(--primary) / 0.4)' }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};

export default Tasks;
