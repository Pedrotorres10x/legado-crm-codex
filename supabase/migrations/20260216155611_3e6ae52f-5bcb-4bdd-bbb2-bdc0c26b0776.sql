
-- Add signature columns to generated_contracts
ALTER TABLE public.generated_contracts
  ADD COLUMN signature_status text NOT NULL DEFAULT 'borrador',
  ADD COLUMN signature_token text UNIQUE,
  ADD COLUMN signer_name text,
  ADD COLUMN signer_ip text,
  ADD COLUMN signed_at timestamptz,
  ADD COLUMN signature_url text;

-- Create storage bucket for contract signatures
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-signatures', 'contract-signatures', true);

-- Storage: anyone can view signatures (public bucket)
CREATE POLICY "Public can view contract signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'contract-signatures');

-- Storage: anyone can upload to contract-signatures (signer has no account)
CREATE POLICY "Anyone can upload contract signatures"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contract-signatures');

-- RLS: allow public SELECT on generated_contracts when filtering by signature_token
CREATE POLICY "Public can view contract by signature token"
ON public.generated_contracts FOR SELECT
USING (signature_token IS NOT NULL AND signature_token = signature_token);
