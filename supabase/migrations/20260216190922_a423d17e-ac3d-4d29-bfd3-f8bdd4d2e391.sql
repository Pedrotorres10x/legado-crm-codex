
-- Create xml_feeds table
CREATE TABLE public.xml_feeds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  name text NOT NULL,
  agent_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamp with time zone,
  last_sync_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.xml_feeds ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage feeds"
ON public.xml_feeds
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can view feeds
CREATE POLICY "Auth users can view feeds"
ON public.xml_feeds
FOR SELECT
TO authenticated
USING (true);

-- Add unique constraint on xml_id for properties upsert
CREATE UNIQUE INDEX IF NOT EXISTS properties_xml_id_unique ON public.properties (xml_id) WHERE xml_id IS NOT NULL;
