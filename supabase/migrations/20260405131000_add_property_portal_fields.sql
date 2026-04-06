-- Add property fields required for portal syndication and notary workflows
-- Fotocasa requires energy_cert_rating; notary requires cadastral_ref; Benidorm buyers need beach distance

ALTER TABLE public.properties
  -- Portal syndication (Fotocasa mandatory fields)
  ADD COLUMN IF NOT EXISTS energy_cert_rating TEXT
    CHECK (energy_cert_rating IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'pending', 'exempt')),
  ADD COLUMN IF NOT EXISTS year_built INTEGER
    CHECK (year_built > 1800 AND year_built <= 2100),
  ADD COLUMN IF NOT EXISTS conservation_state TEXT
    CHECK (conservation_state IN ('excellent', 'good', 'fair', 'poor')),

  -- Benidorm-specific (beach proximity is a primary price driver, +15-25%)
  ADD COLUMN IF NOT EXISTS distance_to_beach_m INTEGER
    CHECK (distance_to_beach_m >= 0),

  -- Notary / legal (mandatory in Spanish real estate transactions)
  ADD COLUMN IF NOT EXISTS cadastral_ref TEXT,
  ADD COLUMN IF NOT EXISTS legal_status TEXT DEFAULT 'unknown'
    CHECK (legal_status IN ('libre', 'hipotecado', 'embargo', 'unknown')),

  -- Buyer qualification fields
  ADD COLUMN IF NOT EXISTS pool_type TEXT
    CHECK (pool_type IN ('private', 'community', 'none')),
  ADD COLUMN IF NOT EXISTS community_fees_eur NUMERIC(10,2)
    CHECK (community_fees_eur >= 0),

  -- Agency operations
  ADD COLUMN IF NOT EXISTS exclusivity_days INTEGER DEFAULT 0
    CHECK (exclusivity_days >= 0),

  -- Immutable origin for commission attribution (set once on creation, never updated)
  ADD COLUMN IF NOT EXISTS source_origin TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_origin IN ('habihub', 'legacy_crm', 'manual', 'idealista',
                              'fotocasa', 'portal_lead', 'statefox', 'other'));

-- Indexes for portal sync queries
CREATE INDEX IF NOT EXISTS idx_properties_energy_cert ON public.properties(energy_cert_rating)
  WHERE status = 'disponible';
CREATE INDEX IF NOT EXISTS idx_properties_legal_status ON public.properties(legal_status);
CREATE INDEX IF NOT EXISTS idx_properties_source_origin ON public.properties(source_origin);
CREATE INDEX IF NOT EXISTS idx_properties_distance_beach ON public.properties(distance_to_beach_m)
  WHERE distance_to_beach_m IS NOT NULL;
