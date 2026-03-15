
CREATE OR REPLACE FUNCTION public.auto_sync_fotocasa_on_property_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url text;
  service_key  text;
  fc_action    text;
BEGIN
  supabase_url := current_setting('app.supabase_url', true);
  service_key  := current_setting('app.service_role_key', true);

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Property sold/withdrawn → delete from Fotocasa
  IF TG_OP = 'UPDATE'
     AND NEW.status IN ('vendido', 'retirado')
     AND OLD.status IS DISTINCT FROM NEW.status THEN

    PERFORM net.http_post(
      url     := supabase_url || '/functions/v1/fotocasa-sync',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body    := jsonb_build_object(
        'action',      'delete',
        'property_id', NEW.id
      )
    );
    RETURN NEW;
  END IF;

  -- Available property with coordinates → sync to Fotocasa
  IF NEW.status = 'disponible'
     AND NEW.latitude IS NOT NULL
     AND NEW.longitude IS NOT NULL THEN

    PERFORM net.http_post(
      url     := supabase_url || '/functions/v1/fotocasa-sync',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body    := jsonb_build_object(
        'action',      'sync_one',
        'property_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_fotocasa_property_sync
  AFTER INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_sync_fotocasa_on_property_change();
