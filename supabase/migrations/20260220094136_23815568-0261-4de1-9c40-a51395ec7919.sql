
-- 1. Add OTP attempt counter to contract_signers
ALTER TABLE public.contract_signers
ADD COLUMN IF NOT EXISTS otp_attempts integer NOT NULL DEFAULT 0;

-- 2. Add signature_hash to store hash of the PNG signature image
ALTER TABLE public.contract_signers
ADD COLUMN IF NOT EXISTS signature_hash text;

-- 3. Add content_hash to generated_contracts (frozen at send-to-sign time)
ALTER TABLE public.generated_contracts
ADD COLUMN IF NOT EXISTS content_hash text;

-- 4. DB trigger to prevent editing contract content once status != 'borrador'
CREATE OR REPLACE FUNCTION public.lock_contract_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If content is being changed and old status is not borrador, block it
  IF OLD.content IS DISTINCT FROM NEW.content AND OLD.signature_status <> 'borrador' THEN
    RAISE EXCEPTION 'No se puede modificar el contenido de un contrato que ya no está en borrador (estado actual: %)', OLD.signature_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lock_contract_content_trigger
BEFORE UPDATE ON public.generated_contracts
FOR EACH ROW
EXECUTE FUNCTION public.lock_contract_content();

-- 5. Make contract-signatures bucket private
UPDATE storage.buckets SET public = false WHERE id = 'contract-signatures';
