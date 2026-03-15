
-- Trigger function to call property-instant-matches edge function on new property
CREATE OR REPLACE FUNCTION public.trigger_instant_property_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key  text;
BEGIN
  supabase_url := current_setting('app.supabase_url', true);
  service_key  := current_setting('app.service_role_key', true);

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/property-instant-matches',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object('property_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Create trigger that fires after a new property is inserted
CREATE TRIGGER on_property_created_find_matches
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_instant_property_matches();
