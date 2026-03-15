
-- 1. Create a sequence for property references
CREATE SEQUENCE IF NOT EXISTS public.property_reference_seq START 1;

-- 2. Function to generate the next reference
CREATE OR REPLACE FUNCTION public.generate_property_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val bigint;
BEGIN
  next_val := nextval('public.property_reference_seq');
  RETURN 'LGD-' || lpad(next_val::text, 4, '0');
END;
$$;

-- 3. Trigger function: auto-assign reference on INSERT if not provided
CREATE OR REPLACE FUNCTION public.auto_assign_property_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := public.generate_property_reference();
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach trigger
DROP TRIGGER IF EXISTS trg_auto_property_reference ON public.properties;
CREATE TRIGGER trg_auto_property_reference
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_property_reference();

-- 5. Backfill existing properties without a reference
-- First, advance the sequence past any existing numeric suffixes to avoid collisions
DO $$
DECLARE
  max_num bigint := 0;
  ref_num bigint;
  r record;
BEGIN
  -- Find the highest numeric suffix already in use
  FOR r IN
    SELECT reference FROM public.properties
    WHERE reference ~ '^LGD-[0-9]+$'
  LOOP
    ref_num := substring(r.reference FROM 5)::bigint;
    IF ref_num > max_num THEN max_num := ref_num; END IF;
  END LOOP;

  -- Advance sequence if needed
  IF max_num > 0 THEN
    PERFORM setval('public.property_reference_seq', max_num);
  END IF;
END;
$$;

-- Now backfill: assign references to all properties that don't have one yet
-- We do it ordered by created_at so older properties get lower numbers
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.properties
    WHERE reference IS NULL OR reference = ''
    ORDER BY created_at ASC
  LOOP
    UPDATE public.properties
    SET reference = public.generate_property_reference()
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- 6. Add unique constraint to prevent duplicates
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_reference_unique;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_reference_unique UNIQUE (reference);
