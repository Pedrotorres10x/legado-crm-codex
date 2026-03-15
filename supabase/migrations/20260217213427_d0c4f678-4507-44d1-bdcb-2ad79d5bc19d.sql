
-- Add a dedicated crm_reference column separate from cadastral reference
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS crm_reference text;

-- Add unique constraint on crm_reference
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_crm_reference_unique;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_crm_reference_unique UNIQUE (crm_reference);

-- Move all LGD-XXXX references from 'reference' (catastral) to 'crm_reference'
UPDATE public.properties
SET
  crm_reference = reference,
  reference = NULL
WHERE reference ~ '^LGD-[0-9]+$';

-- Update the trigger to use crm_reference instead of reference
CREATE OR REPLACE FUNCTION public.auto_assign_property_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.crm_reference IS NULL OR NEW.crm_reference = '' THEN
    NEW.crm_reference := public.generate_property_reference();
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_auto_property_reference ON public.properties;
CREATE TRIGGER trg_auto_property_reference
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_property_reference();

-- Index for fast lookup by crm_reference
CREATE INDEX IF NOT EXISTS idx_properties_crm_reference ON public.properties(crm_reference);
