-- Remove UNIQUE constraints on reference to allow properties in the same building to share cadastral references
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_reference_unique;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_reference_key;
