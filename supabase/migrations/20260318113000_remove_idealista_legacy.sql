-- Remove Idealista legacy integration and leftover schema artifacts.

-- Remove any seeded/configured Idealista feeds and linked exclusions/tracking rows.
DELETE FROM public.portal_property_exclusions
WHERE portal_feed_id IN (
  SELECT id
  FROM public.portal_feeds
  WHERE portal_name = 'idealista' OR format = 'idealista'
);

DELETE FROM public.portal_feed_properties
WHERE portal_feed_id IN (
  SELECT id
  FROM public.portal_feeds
  WHERE portal_name = 'idealista' OR format = 'idealista'
);

DELETE FROM public.portal_feeds
WHERE portal_name = 'idealista' OR format = 'idealista';

-- Normalize feed defaults away from the removed format.
ALTER TABLE public.portal_feeds
ALTER COLUMN format SET DEFAULT 'kyero';

-- Remove legacy comments that still mention Idealista explicitly.
COMMENT ON COLUMN public.contacts.source_url IS 'URL del anuncio original del portal';
COMMENT ON COLUMN public.contacts.source_ref IS 'Referencia externa del anuncio del portal';

-- Drop legacy mapping tables and related database objects.
DROP TRIGGER IF EXISTS update_idealista_mappings_updated_at ON public.idealista_mappings;

DROP POLICY IF EXISTS "Authenticated users can read idealista mappings" ON public.idealista_mappings;
DROP POLICY IF EXISTS "Admins can manage idealista mappings" ON public.idealista_mappings;
DROP POLICY IF EXISTS "Authenticated users can read idealista contact mappings" ON public.idealista_contact_mappings;
DROP POLICY IF EXISTS "Admins can manage idealista contact mappings" ON public.idealista_contact_mappings;

DROP INDEX IF EXISTS public.idx_idealista_mappings_property_id;
DROP INDEX IF EXISTS public.idx_idealista_mappings_idealista_ad_id;
DROP INDEX IF EXISTS public.idx_idealista_mappings_status;

DROP TABLE IF EXISTS public.idealista_contact_mappings;
DROP TABLE IF EXISTS public.idealista_mappings;

-- Remove publication flag no longer used by CRM or feeds.
ALTER TABLE public.properties
DROP COLUMN IF EXISTS send_to_idealista;
