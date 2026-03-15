
-- Drop the unique constraint on reference to allow duplicates
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_reference_key;
DROP INDEX IF EXISTS properties_reference_key;
DROP INDEX IF EXISTS idx_properties_reference_unique;
