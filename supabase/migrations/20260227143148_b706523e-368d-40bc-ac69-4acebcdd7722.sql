-- Add source column to identify where properties come from
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS source text DEFAULT NULL;

-- Mark all existing XML-imported properties as 'habihub'
UPDATE public.properties SET source = 'habihub' WHERE xml_id IS NOT NULL AND (source IS NULL OR source = '');

-- Also mark properties created by AI that share exact title+city+price with XML properties
UPDATE public.properties p
SET source = 'habihub'
WHERE p.xml_id IS NULL
  AND p.source IS NULL
  AND EXISTS (
    SELECT 1 FROM public.properties x
    WHERE x.xml_id IS NOT NULL
      AND lower(trim(x.title)) = lower(trim(p.title))
      AND lower(trim(COALESCE(x.city, ''))) = lower(trim(COALESCE(p.city, '')))
      AND COALESCE(x.price, 0) = COALESCE(p.price, 0)
  );