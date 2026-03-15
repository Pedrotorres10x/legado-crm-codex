CREATE OR REPLACE FUNCTION public.auto_sync_fotocasa_on_property_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip international properties
  IF NEW.country IS NOT NULL AND NEW.country <> 'España' THEN
    RETURN NEW;
  END IF;

  -- UPDATE sold/withdrawn/reserved -> delete on Fotocasa
  IF TG_OP = 'UPDATE'
     AND NEW.status IN ('vendido', 'retirado', 'reservado')
     AND OLD.status IS DISTINCT FROM NEW.status THEN

    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/fotocasa-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object(
        'action', 'delete',
        'property_id', NEW.id
      ),
      timeout_milliseconds := 15000
    );

    RETURN NEW;
  END IF;

  -- INSERT/UPDATE available with coords -> sync_one
  IF NEW.status = 'disponible'
     AND NEW.latitude IS NOT NULL
     AND NEW.longitude IS NOT NULL THEN

    PERFORM net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/fotocasa-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := jsonb_build_object(
        'action', 'sync_one',
        'property_id', NEW.id
      ),
      timeout_milliseconds := 15000
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;