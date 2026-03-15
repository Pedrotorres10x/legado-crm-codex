
-- 1. Add is_featured column to properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- 2. Create featured_cache table for AI-curated featured properties
CREATE TABLE IF NOT EXISTS public.featured_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  property_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis text,
  image_score numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

-- Enable RLS
ALTER TABLE public.featured_cache ENABLE ROW LEVEL SECURITY;

-- Public read (needed by Legado Colección website via anon key)
CREATE POLICY "Anon can view featured_cache"
ON public.featured_cache FOR SELECT
USING (true);

-- Admin manage
CREATE POLICY "Admin manage featured_cache"
ON public.featured_cache FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- System insert (for edge functions with service role)
CREATE POLICY "System insert featured_cache"
ON public.featured_cache FOR INSERT
WITH CHECK (true);

-- System update
CREATE POLICY "System update featured_cache"
ON public.featured_cache FOR UPDATE
USING (true);
