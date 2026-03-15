
-- Table to track individual signers per contract
CREATE TABLE public.contract_signers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.generated_contracts(id) ON DELETE CASCADE,
  signer_label text NOT NULL DEFAULT 'Firmante',
  signature_token text NOT NULL DEFAULT gen_random_uuid()::text,
  signature_status text NOT NULL DEFAULT 'pendiente',
  signer_name text,
  signer_id_number text,
  signer_ip text,
  signer_user_agent text,
  signed_at timestamp with time zone,
  signature_url text,
  document_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_signers ENABLE ROW LEVEL SECURITY;

-- Agents can view signers for their own contracts
CREATE POLICY "Agent view own contract signers"
ON public.contract_signers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.generated_contracts gc
    WHERE gc.id = contract_signers.contract_id
    AND (gc.agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role))
  )
);

-- Agents can insert signers for their own contracts
CREATE POLICY "Agent insert contract signers"
ON public.contract_signers FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.generated_contracts gc
    WHERE gc.id = contract_signers.contract_id
    AND (gc.agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- System/edge function can update signers (for signing)
CREATE POLICY "System update contract signers"
ON public.contract_signers FOR UPDATE
USING (true);

-- Admin can delete
CREATE POLICY "Admin delete contract signers"
ON public.contract_signers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for token lookups
CREATE INDEX idx_contract_signers_token ON public.contract_signers(signature_token);
