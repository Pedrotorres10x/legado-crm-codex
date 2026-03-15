CREATE OR REPLACE FUNCTION public.chain_fotocasa_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_offset int;
  batch_sz    int;
BEGIN
  IF NEW.target <> 'fotocasa' OR NEW.event <> 'sync_batch_summary' THEN
    RETURN NEW;
  END IF;

  IF (NEW.payload->>'has_more')::boolean IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  next_offset := (COALESCE(NEW.payload->>'offset', '0'))::int
               + (COALESCE(NEW.payload->>'batch_size', '50'))::int;
  batch_sz    := (COALESCE(NEW.payload->>'batch_size', '50'))::int;

  PERFORM net.http_post(
    url := 'https://srhkvthmzusfrbqtijlw.supabase.co/functions/v1/fotocasa-sync',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object(
      'action', 'sync_all',
      'batch_size', batch_sz,
      'offset', next_offset
    ),
    timeout_milliseconds := 15000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_sync_fotocasa_on_property_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- UPDATE sold/withdrawn -> delete on Fotocasa
  IF TG_OP = 'UPDATE'
     AND NEW.status IN ('vendido', 'retirado')
     AND OLD.status IS DISTINCT FROM NEW.status THEN

    PERFORM net.http_post(
      url := 'https://srhkvthmzusfrbqtijlw.supabase.co/functions/v1/fotocasa-sync',
      headers := '{"Content-Type":"application/json"}'::jsonb,
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
      url := 'https://srhkvthmzusfrbqtijlw.supabase.co/functions/v1/fotocasa-sync',
      headers := '{"Content-Type":"application/json"}'::jsonb,
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