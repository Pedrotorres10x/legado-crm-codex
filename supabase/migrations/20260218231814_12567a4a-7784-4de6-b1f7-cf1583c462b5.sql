
-- Add recurrence fields to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence text NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid NULL REFERENCES public.tasks(id) ON DELETE SET NULL;

-- recurrence values: 'daily' | 'weekly' | 'monthly' | null (no recurrence)
-- recurrence_parent_id: links a generated child task back to its parent template
