
-- Create tasks table for follow-ups and reminders
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  due_date timestamp with time zone NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baja')),
  task_type text NOT NULL DEFAULT 'llamada' CHECK (task_type IN ('llamada', 'email', 'visita', 'reunion', 'whatsapp', 'seguimiento', 'otro')),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  agent_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Agents can view their own tasks, admins can view all
CREATE POLICY "Agents view own tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Agents can insert their own tasks
CREATE POLICY "Agents insert own tasks"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (agent_id = auth.uid());

-- Agents can update their own tasks, admins can update all
CREATE POLICY "Agents update own tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Agents can delete their own tasks, admins can delete all
CREATE POLICY "Agents delete own tasks"
ON public.tasks FOR DELETE
TO authenticated
USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Notification trigger for task reminders
CREATE OR REPLACE FUNCTION public.notify_task_due()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  contact_name text;
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    SELECT full_name INTO contact_name FROM public.contacts WHERE id = NEW.contact_id;
  END IF;
  INSERT INTO public.notifications (event_type, entity_type, entity_id, title, description, agent_id)
  VALUES (
    'new_task', 'task', NEW.id,
    'Nueva tarea: ' || NEW.title,
    COALESCE(contact_name, '') || ' · ' || to_char(NEW.due_date, 'DD/MM/YYYY HH24:MI'),
    NEW.agent_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_new_task
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_due();
