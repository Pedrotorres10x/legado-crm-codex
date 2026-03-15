
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.portal_feeds ADD COLUMN IF NOT EXISTS filters jsonb DEFAULT '{}';
