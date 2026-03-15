ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS legal_risk_level text,
  ADD COLUMN IF NOT EXISTS legal_risk_summary text,
  ADD COLUMN IF NOT EXISTS legal_risk_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_risk_docs_count integer NOT NULL DEFAULT 0;
