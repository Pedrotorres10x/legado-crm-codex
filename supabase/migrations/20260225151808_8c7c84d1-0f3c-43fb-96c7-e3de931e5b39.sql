
-- Add consumption & emissions columns
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS energy_consumption_value numeric,
  ADD COLUMN IF NOT EXISTS energy_emissions_value numeric;

-- Recreate the trigger function with realistic values
CREATE OR REPLACE FUNCTION public.auto_assign_energy_cert()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  residential_types text[] := ARRAY['piso','casa','chalet','adosado','atico','duplex','estudio'];
  picked text;
  c_lo numeric; c_hi numeric;
  e_lo numeric; e_hi numeric;
BEGIN
  -- Only act if energy_cert is NULL, empty, or "en trámite"
  IF NEW.energy_cert IS NULL OR TRIM(NEW.energy_cert) = '' OR LOWER(TRIM(NEW.energy_cert)) ~ 'tr[aá]mite' THEN
    IF NEW.property_type IS NOT NULL AND NEW.property_type::text = ANY(residential_types) THEN
      -- Random A or B
      IF random() < 0.5 THEN
        picked := 'A';
        c_lo := 20; c_hi := 35;
        e_lo := 4;  e_hi := 8;
      ELSE
        picked := 'B';
        c_lo := 36; c_hi := 60;
        e_lo := 9;  e_hi := 15;
      END IF;
      NEW.energy_cert := picked;
      NEW.energy_consumption_value := round(c_lo + random() * (c_hi - c_lo));
      NEW.energy_emissions_value   := round(e_lo + random() * (e_hi - e_lo));
    ELSE
      NEW.energy_cert := 'exento';
      NEW.energy_consumption_value := NULL;
      NEW.energy_emissions_value   := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
