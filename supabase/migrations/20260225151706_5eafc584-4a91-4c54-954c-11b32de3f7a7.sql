
CREATE OR REPLACE FUNCTION public.auto_assign_energy_cert()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  residential_types text[] := ARRAY['piso','casa','chalet','adosado','atico','duplex','estudio'];
  letters text[] := ARRAY['A','B'];
  picked text;
BEGIN
  -- Only act if energy_cert is NULL or empty or 'en trámite'
  IF NEW.energy_cert IS NULL OR TRIM(NEW.energy_cert) = '' OR LOWER(TRIM(NEW.energy_cert)) ~ 'tr[aá]mite' THEN
    IF NEW.property_type IS NOT NULL AND NEW.property_type::text = ANY(residential_types) THEN
      -- Random A or B
      picked := letters[1 + floor(random())::int];
      NEW.energy_cert := picked;
    ELSE
      -- Non-residential: terreno, local, garaje, nave, oficina, trastero, etc.
      NEW.energy_cert := 'exento';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger on INSERT only
DROP TRIGGER IF EXISTS trg_auto_energy_cert ON public.properties;
CREATE TRIGGER trg_auto_energy_cert
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_energy_cert();
