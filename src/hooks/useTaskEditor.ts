import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type TaskLike = {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: string;
  task_type: string;
  contact_id: string | null;
  property_id: string | null;
  recurrence?: string | null;
};

type TaskMutationPayload = {
  title: string;
  description: string | null;
  due_date: string;
  priority: string;
  task_type: string;
  contact_id: string | null;
  property_id: string | null;
  agent_id: string;
  recurrence: string | null;
};

export const TASK_EDITOR_EMPTY_FORM = {
  title: '',
  description: '',
  due_date: '',
  priority: 'media',
  task_type: 'llamada',
  contact_id: '',
  property_id: '',
  recurrence: 'none',
};

export type TaskEditorForm = typeof TASK_EDITOR_EMPTY_FORM;

export const useTaskEditor = ({
  userId,
  onSaved,
}: {
  userId?: string;
  onSaved: () => void;
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskLike | null>(null);
  const [form, setForm] = useState<TaskEditorForm>(TASK_EDITOR_EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<{ title?: string; due_date?: string; description?: string }>({});
  const [saving, setSaving] = useState(false);

  const resetEditor = () => {
    setEditingTask(null);
    setForm(TASK_EDITOR_EMPTY_FORM);
    setFormErrors({});
  };

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setFormErrors({});
    }
  };

  const openNew = (contactId = '') => {
    setEditingTask(null);
    setForm({ ...TASK_EDITOR_EMPTY_FORM, contact_id: contactId });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (task: TaskLike) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd'T'HH:mm") : '',
      priority: task.priority,
      task_type: task.task_type,
      contact_id: task.contact_id || '',
      property_id: task.property_id || '',
      recurrence: task.recurrence || 'none',
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!userId) return;

    const errors: { title?: string; due_date?: string; description?: string } = {};
    if (!form.title.trim()) errors.title = 'El título es obligatorio';
    if (!form.due_date) errors.due_date = 'La fecha y hora son obligatorias';
    if (!form.description.trim() || form.description.trim().length < 12) {
      errors.description = 'Añade contexto y siguiente paso para que la tarea tenga valor comercial real';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setSaving(true);

    const payload: TaskMutationPayload = {
      title: form.title,
      description: form.description || null,
      due_date: new Date(form.due_date).toISOString(),
      priority: form.priority,
      task_type: form.task_type,
      contact_id: form.contact_id || null,
      property_id: form.property_id || null,
      agent_id: userId,
      recurrence: form.recurrence && form.recurrence !== 'none' ? form.recurrence : null,
    };

    if (editingTask) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
      if (error) toast.error('Error al actualizar');
      else toast.success('Tarea actualizada');
    } else {
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) {
        toast.error('Error al crear tarea');
      } else {
        toast.success(
          form.recurrence && form.recurrence !== 'none'
            ? `Tarea recurrente creada`
            : 'Tarea creada',
        );
      }
    }

    setSaving(false);
    setDialogOpen(false);
    resetEditor();
    onSaved();
  };

  return {
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
  };
};
