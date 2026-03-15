
-- Add GDPR columns to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS gdpr_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gdpr_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS gdpr_consent_ip text,
  ADD COLUMN IF NOT EXISTS gdpr_legal_basis text NOT NULL DEFAULT 'legitimate_interest';

-- Set existing contacts to legitimate_interest (already default)
COMMENT ON COLUMN public.contacts.gdpr_legal_basis IS 'Values: explicit_consent, legitimate_interest, contractual';
