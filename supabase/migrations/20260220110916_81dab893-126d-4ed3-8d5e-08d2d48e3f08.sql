
-- Add contact_id to contract_signers to link each signer to a contact
ALTER TABLE public.contract_signers
ADD COLUMN contact_id uuid REFERENCES public.contacts(id);

-- Index for lookups
CREATE INDEX idx_contract_signers_contact_id ON public.contract_signers(contact_id);
