
CREATE OR REPLACE FUNCTION public.chain_fotocasa_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url text;
  service_key  text;
  next_offset  int;
  batch_sz     int;
BEGIN
  -- Only chain fotocasa sync_batch_summary with has_more = true
  IF NEW.target <> 'fotocasa' OR NEW.event <> 'sync_batch_summary' THEN
    RETURN NEW;
  END IF;

  IF (NEW.payload->>'has_more')::boolean IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  supabase_url := current_setting('app.supabase_url', true);
  service_key  := current_setting('app.service_role_key', true);

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  next_offset := (COALESCE(NEW.payload->>'offset', '0'))::int
               + (COALESCE(NEW.payload->>'batch_size', '50'))::int;
  batch_sz    := (COALESCE(NEW.payload->>'batch_size', '50'))::int;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/fotocasa-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object(
      'action',     'sync_all',
      'batch_size', batch_sz,
      'offset',     next_offset
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_chain_fotocasa_sync
  AFTER INSERT ON public.erp_sync_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.chain_fotocasa_sync();
