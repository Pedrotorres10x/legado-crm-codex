import { useCallback, useEffect, useState } from 'react';
import { addDays, addMonths, addWeeks, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
  priority: string;
  task_type: string;
  contact_id: string | null;
  property_id: string | null;
  agent_id: string;
  created_at: string;
  recurrence?: string | null;
  recurrence_parent_id?: string | null;
  source?: string | null;
  contacts?: { full_name: string } | null;
  properties?: { title: string } | null;
};

type TaskInsertPayload = {
  title: string;
  description: string | null;
  due_date: string;
  priority: string;
  task_type: string;
  contact_id: string | null;
  property_id: string | null;
  agent_id: string;
  recurrence: string | null;
  recurrence_parent_id: string;
};

const getNextDate = (date: Date, recurrence: string): Date => {
  if (recurrence === 'daily') return addDays(date, 1);
  if (recurrence === 'weekly') return addWeeks(date, 1);
  if (recurrence === 'monthly') return addMonths(date, 1);
  return date;
};

const isAutomaticTask = (task: Pick<Task, 'source'>) => Boolean(task.source && task.source !== 'manual');

export const useTasksData = ({ userId }: { userId?: string }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<{ id: string; full_name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, contacts(full_name), properties(title)')
      .eq('agent_id', userId ?? '')
      .order('due_date', { ascending: true });
    setTasks((data as Task[]) || []);
    setLoading(false);
  }, [userId]);

  const fetchFormOptions = useCallback(async () => {
    const [contactsResponse, propertiesResponse] = await Promise.all([
      supabase.from('contacts').select('id, full_name').order('full_name'),
      supabase.from('properties').select('id, title').order('title'),
    ]);
    setContacts(contactsResponse.data || []);
    setProperties(propertiesResponse.data || []);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchFormOptions();
  }, [fetchFormOptions]);

  const toggleComplete = async (task: Task) => {
    const completed = !task.completed;
    await supabase
      .from('tasks')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', task.id);

    if (completed && task.recurrence) {
      const nextDate = getNextDate(new Date(task.due_date), task.recurrence);
      const nextTask: TaskInsertPayload = {
        title: task.title,
        description: task.description,
        due_date: nextDate.toISOString(),
        priority: task.priority,
        task_type: task.task_type,
        contact_id: task.contact_id,
        property_id: task.property_id,
        agent_id: task.agent_id,
        recurrence: task.recurrence,
        recurrence_parent_id: task.recurrence_parent_id || task.id,
      };
      await supabase.from('tasks').insert(nextTask);
      toast.success(`✓ Completada. Próxima: ${format(nextDate, "d MMM HH:mm", { locale: es })}`);
    } else {
      toast.success(completed ? 'Tarea completada ✓' : 'Tarea reabierta');
    }

    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find((item) => item.id === id);
    if (task && isAutomaticTask(task)) {
      toast.info('Las tareas automaticas se resuelven desde su origen o marcandolas como completadas.');
      return;
    }

    await supabase.from('tasks').delete().eq('id', id);
    fetchTasks();
    toast.success('Tarea eliminada');
  };

  return {
    tasks,
    contacts,
    properties,
    loading,
    fetchTasks,
    toggleComplete,
    deleteTask,
  };
};

export type { Task };
