
-- Fix FK constraints that would block DELETE on properties
-- Change NO ACTION to SET NULL for generated_contracts, commissions, mls_incoming

ALTER TABLE public.generated_contracts
  DROP CONSTRAINT generated_contracts_property_id_fkey,
  ADD CONSTRAINT generated_contracts_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;

ALTER TABLE public.commissions
  DROP CONSTRAINT commissions_property_id_fkey,
  ADD CONSTRAINT commissions_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;

ALTER TABLE public.mls_incoming
  DROP CONSTRAINT mls_incoming_imported_property_id_fkey,
  ADD CONSTRAINT mls_incoming_imported_property_id_fkey
    FOREIGN KEY (imported_property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
