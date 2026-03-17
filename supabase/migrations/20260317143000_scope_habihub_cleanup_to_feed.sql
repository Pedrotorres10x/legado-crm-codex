ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS source_feed_id uuid;

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS source_feed_name text;

COMMENT ON COLUMN public.properties.source_feed_id IS 'Identifier of the external feed that created or last refreshed this property.';
COMMENT ON COLUMN public.properties.source_feed_name IS 'Human-readable feed name used for audit and operational traceability.';

WITH detected_habihub_feed AS (
  SELECT id, name
  FROM public.xml_feeds
  WHERE lower(name) LIKE '%habihub%'
     OR url LIKE '%medianewbuild.com%'
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE public.properties p
SET
  source_feed_id = f.id,
  source_feed_name = f.name
FROM detected_habihub_feed f
WHERE p.source = 'habihub'
  AND p.source_feed_id IS NULL;
