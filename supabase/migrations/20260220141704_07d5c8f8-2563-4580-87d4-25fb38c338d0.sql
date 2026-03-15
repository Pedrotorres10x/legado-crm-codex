
-- Restore unique constraint on cadastral reference (each apartment has its own unique ref)
CREATE UNIQUE INDEX IF NOT EXISTS properties_reference_unique ON public.properties (reference) WHERE reference IS NOT NULL AND reference <> '';
