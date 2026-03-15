
-- Add legal reinforcement columns to generated_contracts
ALTER TABLE public.generated_contracts
  ADD COLUMN signer_id_number text,
  ADD COLUMN document_hash text,
  ADD COLUMN signer_user_agent text;
