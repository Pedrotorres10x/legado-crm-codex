-- Enrich call interactions with recording/transcript artifacts and task linkage
ALTER TABLE public.interactions
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_status text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS follow_up_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
