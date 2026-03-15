
-- Prospecting sequences table for Statefox contact automation
CREATE TABLE public.prospecting_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id uuid,
  current_step int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_step_at timestamptz,
  next_step_at timestamptz DEFAULT now(),
  paused boolean NOT NULL DEFAULT false,
  replied boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id)
);

-- Index for cron processing
CREATE INDEX idx_prospecting_active ON public.prospecting_sequences (next_step_at)
  WHERE completed = false AND paused = false AND replied = false;

-- RLS
ALTER TABLE public.prospecting_sequences ENABLE ROW LEVEL SECURITY;

-- Agents see their own
CREATE POLICY "Agents see own sequences"
  ON public.prospecting_sequences FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinadora'));

-- Agents can insert their own
CREATE POLICY "Agents insert own sequences"
  ON public.prospecting_sequences FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinadora'));

-- Agents can update their own
CREATE POLICY "Agents update own sequences"
  ON public.prospecting_sequences FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinadora'));

-- Admin/coordinadora can delete
CREATE POLICY "Admin delete sequences"
  ON public.prospecting_sequences FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinadora'));

-- Updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prospecting_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
