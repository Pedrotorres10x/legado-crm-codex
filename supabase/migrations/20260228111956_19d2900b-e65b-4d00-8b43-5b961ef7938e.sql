CREATE OR REPLACE FUNCTION public.auto_publish_non_xml_to_mls()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- STRICT: Only non-XML, non-international properties with status 'disponible'
  IF (NEW.xml_id IS NULL OR NEW.xml_id = '') AND NEW.status = 'disponible'
     AND (NEW.country IS NULL OR NEW.country = 'España') THEN
    INSERT INTO public.mls_listings (property_id, status, published_at, last_synced_at)
    VALUES (NEW.id, 'published', now(), now())
    ON CONFLICT (property_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;