ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS source_metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS source_raw_xml text;

COMMENT ON COLUMN public.properties.source_metadata IS 'Structured source payload preserved from external feeds such as HabiHub.';
COMMENT ON COLUMN public.properties.source_raw_xml IS 'Raw XML block received for the property import. Useful to recover unmapped source fields.';
