
CREATE OR REPLACE FUNCTION public.auto_publish_non_xml_to_mls()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Only non-XML properties with status 'disponible'
  IF NEW.xml_id IS NULL AND NEW.status = 'disponible' THEN
    INSERT INTO public.mls_listings (property_id, status, published_at, last_synced_at)
    VALUES (NEW.id, 'published', now(), now())
    ON CONFLICT (property_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_auto_mls_non_xml
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_publish_non_xml_to_mls();
