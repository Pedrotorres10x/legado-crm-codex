
-- Mapping table: our properties ↔ Idealista ad IDs
CREATE TABLE public.idealista_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  idealista_ad_id TEXT,                    -- Idealista's internal ad ID
  idealista_property_code TEXT,            -- Idealista's property code
  idealista_customer_id TEXT,              -- Idealista's customer/contact ID
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, published, updated, deleted, error
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  image_checksums JSONB DEFAULT '{}',      -- { our_image_url: idealista_image_id }
  idealista_response JSONB,                -- Last response from Idealista API
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

-- Enable RLS
ALTER TABLE public.idealista_mappings ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read
CREATE POLICY "Authenticated users can read idealista mappings"
  ON public.idealista_mappings FOR SELECT TO authenticated USING (true);

-- Only admin/coordinadora can modify
CREATE POLICY "Admins can manage idealista mappings"
  ON public.idealista_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinadora'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinadora'));

-- Auto-update updated_at
CREATE TRIGGER update_idealista_mappings_updated_at
  BEFORE UPDATE ON public.idealista_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_idealista_mappings_property_id ON public.idealista_mappings(property_id);
CREATE INDEX idx_idealista_mappings_idealista_ad_id ON public.idealista_mappings(idealista_ad_id);
CREATE INDEX idx_idealista_mappings_status ON public.idealista_mappings(status);
