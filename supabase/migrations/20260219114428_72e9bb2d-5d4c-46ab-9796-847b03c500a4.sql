-- Fix source_url values that were saved as raw XML (multilang containers)
-- Extract the actual URL from patterns like: <es>https://...</es><en>https://...</en>
UPDATE properties
SET source_url = (
  CASE
    -- Extract <es>URL</es>
    WHEN source_url ~ '<es[^>]*>https?://[^<]+</es' THEN
      regexp_replace(source_url, '^.*<es[^>]*>(https?://[^<]+)</es.*$', '\1', 'i')
    -- Extract <en>URL</en>  
    WHEN source_url ~ '<en[^>]*>https?://[^<]+</en' THEN
      regexp_replace(source_url, '^.*<en[^>]*>(https?://[^<]+)</en.*$', '\1', 'i')
    -- Extract any 2-letter language tag with URL
    WHEN source_url ~ '<[a-z]{2}[^>]*>https?://[^<]+</[a-z]{2}>' THEN
      regexp_replace(source_url, '^.*<[a-z]{2}[^>]*>(https?://[^<]+)</[a-z]{2}>.*$', '\1', 'i')
    ELSE source_url
  END
)
WHERE source_url IS NOT NULL
  AND source_url LIKE '<%>%';