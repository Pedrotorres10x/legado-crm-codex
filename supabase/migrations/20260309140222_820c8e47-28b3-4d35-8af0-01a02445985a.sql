CREATE OR REPLACE FUNCTION public.chain_fotocasa_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_offset int;
  batch_sz    int;
  supabase_url text;
  service_key  text;
BEGIN
  IF NEW.target <> 'fotocasa' OR NEW.event <> 'sync_batch_summary' THEN
    RETURN NEW;
  END IF;

  IF (NEW.payload->>'has_more')::boolean IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  supabase_url := current_setting('app.supabase_url', true);
  service_key  := current_setting('app.service_role_key', true);

  next_offset := (COALESCE(NEW.payload->>'offset', '0'))::int
               + (COALESCE(NEW.payload->>'batch_size', '50'))::int;
  batch_sz    := (COALESCE(NEW.payload->>'batch_size', '50'))::int;

  PERFORM net.http_post(
    url := COALESCE(supabase_url, 'https://srhkvthmzusfrbqtijlw.supabase.co') || '/functions/v1/fotocasa-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, '')
    ),
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