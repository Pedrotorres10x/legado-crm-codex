-- Reforzar trigger: nunca auto-publicar XML en MLS
CREATE OR REPLACE FUNCTION public.auto_publish_non_xml_to_mls()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- STRICT: Only non-XML properties with status 'disponible'
  -- xml_id must be strictly NULL (not empty string)
  IF (NEW.xml_id IS NULL OR NEW.xml_id = '') AND NEW.status = 'disponible' THEN
    INSERT INTO public.mls_listings (property_id, status, published_at, last_synced_at)
    VALUES (NEW.id, 'published', now(), now())
    ON CONFLICT (property_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Cleanup: remove any XML properties that may have leaked into mls_listings
DELETE FROM public.mls_listings
WHERE property_id IN (
  SELECT p.id FROM public.properties p
  WHERE p.xml_id IS NOT NULL AND p.xml_id <> ''
);