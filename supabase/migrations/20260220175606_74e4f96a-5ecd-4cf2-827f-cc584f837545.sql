
-- Auto-normalize city names on insert/update
CREATE OR REPLACE FUNCTION public.normalize_property_city()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.city IS NOT NULL THEN
    NEW.city := INITCAP(LOWER(TRIM(NEW.city)));
  END IF;
  IF NEW.zone IS NOT NULL THEN
    NEW.zone := INITCAP(LOWER(TRIM(NEW.zone)));
  END IF;
  IF NEW.province IS NOT NULL THEN
    NEW.province := INITCAP(LOWER(TRIM(NEW.province)));
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_normalize_property_city
BEFORE INSERT OR UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.normalize_property_city();
