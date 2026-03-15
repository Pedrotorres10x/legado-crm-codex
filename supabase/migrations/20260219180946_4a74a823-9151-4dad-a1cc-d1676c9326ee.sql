
-- Table to store portal feed configurations
CREATE TABLE public.portal_feeds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_name text NOT NULL, -- 'idealista', 'fotocasa', 'pisos'
  display_name text NOT NULL,
  format text NOT NULL DEFAULT 'idealista', -- xml format type
  is_active boolean NOT NULL DEFAULT false,
  feed_token text NOT NULL DEFAULT gen_random_uuid()::text,
  last_accessed_at timestamp with time zone,
  properties_count integer NOT NULL DEFAULT 0,
  api_credentials jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(portal_name)
);

-- Enable RLS
ALTER TABLE public.portal_feeds ENABLE ROW LEVEL SECURITY;

-- Only admins can manage portal feeds
CREATE POLICY "Admins manage portal feeds"
ON public.portal_feeds FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view portal feeds
CREATE POLICY "Auth users view portal feeds"
ON public.portal_feeds FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Table to exclude specific properties from specific portals
CREATE TABLE public.portal_property_exclusions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_feed_id uuid NOT NULL REFERENCES public.portal_feeds(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  excluded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(portal_feed_id, property_id)
);

ALTER TABLE public.portal_property_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage exclusions"
ON public.portal_property_exclusions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth users view exclusions"
ON public.portal_property_exclusions FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Seed the 3 portals
INSERT INTO public.portal_feeds (portal_name, display_name, format) VALUES
  ('idealista', 'Idealista', 'idealista'),
  ('fotocasa', 'Fotocasa', 'fotocasa'),
  ('pisos', 'Pisos.com', 'pisos');
