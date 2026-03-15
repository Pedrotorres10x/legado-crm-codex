import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type FollowUpItemLike = {
  title: string;
  summary: string;
  kind: 'contact' | 'task' | 'match';
  priority: 'alta' | 'media';
  contactId?: string | null;
  propertyId?: string | null;
};

export const useFollowUpTaskDraft = ({
  userId,
}: {
  userId?: string;
}) => {
  const [taskDraftForItem, setTaskDraftForItem] = useState<FollowUpItemLike | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', due_date: '', description: '', priority: 'media' });
  const [savingTask, setSavingTask] = useState(false);

  const openTaskDraft = (item: FollowUpItemLike) => {
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dueDateLocal = new Date(dueDate.getTime() - dueDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setTaskDraftForItem(item);
    setTaskForm({
      title: item.kind === 'match' ? `Seguimiento WhatsApp: ${item.title}` : `Seguimiento: ${item.title}`,
      due_date: dueDateLocal,
      description: item.summary,
      priority: item.priority,
    });
  };

  const closeTaskDraft = () => {
    setTaskDraftForItem(null);
  };

  const handleCreateTask = async () => {
    if (!userId || !taskDraftForItem || !taskForm.title.trim() || !taskForm.due_date) return;

    setSavingTask(true);
    const { error } = await supabase.from('tasks').insert({
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      due_date: new Date(taskForm.due_date).toISOString(),
      priority: taskForm.priority,
      task_type: 'seguimiento',
      contact_id: taskDraftForItem.contactId || null,
      property_id: taskDraftForItem.propertyId || null,
      agent_id: userId,
      source: 'manual',
    });
    setSavingTask(false);

    if (error) {
      toast.error('No se pudo crear la tarea de seguimiento');
      return;
    }

    toast.success('Tarea de seguimiento creada');
    setTaskDraftForItem(null);
  };

  return {
    taskDraftForItem,
    taskForm,
    setTaskForm,
    savingTask,
    openTaskDraft,
    closeTaskDraft,
    handleCreateTask,
  };
};
