ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gcal_embed_url TEXT;