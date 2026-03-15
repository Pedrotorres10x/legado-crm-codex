
-- Tracking table: which properties have been sent to each portal
CREATE TABLE public.portal_feed_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_feed_id uuid NOT NULL REFERENCES public.portal_feeds(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  first_sent_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE (portal_feed_id, property_id)
);

-- Index for fast lookup by portal
CREATE INDEX idx_portal_feed_properties_feed ON public.portal_feed_properties(portal_feed_id);

-- RLS: only service role (edge functions) operates on this table
ALTER TABLE public.portal_feed_properties ENABLE ROW LEVEL SECURITY;

-- Admin can read for debugging
CREATE POLICY "Admin can view portal_feed_properties"
  ON public.portal_feed_properties FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role insert/update/delete (no user policy needed)
CREATE POLICY "Service insert portal_feed_properties"
  ON public.portal_feed_properties FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service update portal_feed_properties"
  ON public.portal_feed_properties FOR UPDATE
  USING (true);

CREATE POLICY "Service delete portal_feed_properties"
  ON public.portal_feed_properties FOR DELETE
  USING (true);
