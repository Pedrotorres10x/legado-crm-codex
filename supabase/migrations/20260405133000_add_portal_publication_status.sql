-- Track per-property, per-portal publication status
-- Enables admin visibility into which properties are actually live on each portal
-- and captures rejection reasons for diagnosis

CREATE TABLE IF NOT EXISTS public.portal_publication_status (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  portal_name      TEXT NOT NULL,                     -- fotocasa, kyero, thinkspain, idealista, etc.
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('published', 'rejected', 'pending', 'archived', 'paused')),
  portal_listing_id TEXT,                             -- ID assigned by the portal after publish
  portal_url       TEXT,                              -- direct link on the portal
  rejection_reason TEXT,                              -- filled when status = 'rejected'
  rejection_code   TEXT,                              -- e.g. 'MISSING_ENERGY_CERT', 'INVALID_PRICE'
  last_sync_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(property_id, portal_name)
);

CREATE OR REPLACE FUNCTION public.update_portal_publication_status_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER portal_publication_status_updated_at
  BEFORE UPDATE ON public.portal_publication_status
  FOR EACH ROW EXECUTE FUNCTION public.update_portal_publication_status_updated_at();

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_pps_property_id ON public.portal_publication_status(property_id);
CREATE INDEX IF NOT EXISTS idx_pps_portal_name ON public.portal_publication_status(portal_name);
CREATE INDEX IF NOT EXISTS idx_pps_status ON public.portal_publication_status(status);
CREATE INDEX IF NOT EXISTS idx_pps_rejected ON public.portal_publication_status(property_id)
  WHERE status = 'rejected';

-- RLS: agents see own properties; admin sees all
ALTER TABLE public.portal_publication_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_pub_status_select" ON public.portal_publication_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND (
        p.agent_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('admin', 'coordinadora')
        )
      )
    )
  );

CREATE POLICY "portal_pub_status_insert_update" ON public.portal_publication_status
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coordinadora')
    )
  );
