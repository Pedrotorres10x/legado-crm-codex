-- Internal comments table for properties and contacts
CREATE TABLE public.internal_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('property', 'contact')),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_comments ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view comments
CREATE POLICY "Auth view comments"
ON public.internal_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can insert their own comments
CREATE POLICY "Auth insert own comments"
ON public.internal_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Auth delete own comments"
ON public.internal_comments FOR DELETE
USING (auth.uid() = user_id);

-- Admin can delete any comment
CREATE POLICY "Admin delete any comment"
ON public.internal_comments FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast queries
CREATE INDEX idx_internal_comments_entity ON public.internal_comments (entity_type, entity_id, created_at DESC);
