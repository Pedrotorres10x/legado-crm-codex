
-- Table for link-in-bio analytics events
CREATE TABLE public.linkinbio_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug text NOT NULL,
  agent_id uuid,
  event_type text NOT NULL DEFAULT 'pageview', -- 'pageview', 'click'
  link_id text, -- which link was clicked (null for pageviews)
  link_url text,
  session_id text NOT NULL,
  referrer text,
  user_agent text,
  device text, -- 'mobile', 'tablet', 'desktop'
  country text,
  city text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_linkinbio_events_agent_slug ON public.linkinbio_events(agent_slug);
CREATE INDEX idx_linkinbio_events_agent_id ON public.linkinbio_events(agent_id);
CREATE INDEX idx_linkinbio_events_created_at ON public.linkinbio_events(created_at DESC);
CREATE INDEX idx_linkinbio_events_type ON public.linkinbio_events(event_type);

-- Enable RLS
ALTER TABLE public.linkinbio_events ENABLE ROW LEVEL SECURITY;

-- Public insert (tracking from unauthenticated visitors)
CREATE POLICY "Anyone can insert events"
  ON public.linkinbio_events FOR INSERT
  WITH CHECK (true);

-- Agents see their own events
CREATE POLICY "Agents view own events"
  ON public.linkinbio_events FOR SELECT
  USING (agent_id = auth.uid());

-- Admin/coord see all
CREATE POLICY "Admin coord view all events"
  ON public.linkinbio_events FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'coordinadora'::app_role)
  );

-- Admin can delete (cleanup)
CREATE POLICY "Admin delete events"
  ON public.linkinbio_events FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
