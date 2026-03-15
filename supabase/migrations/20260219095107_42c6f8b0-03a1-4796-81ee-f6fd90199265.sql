-- Add trigram indexes on tasks for server-side search
CREATE INDEX IF NOT EXISTS tasks_title_trgm_idx
  ON public.tasks USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tasks_description_trgm_idx
  ON public.tasks USING GIN (description gin_trgm_ops);