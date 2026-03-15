
-- Function to auto-sync property changes to MLS
CREATE OR REPLACE FUNCTION public.auto_sync_mls_on_property_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url text;
  service_key  text;
  mls_action   text;
BEGIN
  -- Check if this property is published in MLS
  IF NOT EXISTS (
    SELECT 1 FROM public.mls_listings
    WHERE property_id = NEW.id AND status = 'published'
  ) THEN
    RETURN NEW;
  END IF;

  supabase_url := current_setting('app.supabase_url', true);
  service_key  := current_setting('app.service_role_key', true);

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- If property status changed to vendido/retirado/reservado → unpublish
  IF NEW.status IN ('vendido', 'retirado') AND OLD.status IS DISTINCT FROM NEW.status THEN
    mls_action := 'unpublish';
  ELSE
    mls_action := 'publish';
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/mls-publish',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object(
      'action',      mls_action,
      'property_id', NEW.id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- Trigger on property updates
CREATE TRIGGER trg_auto_sync_mls
AFTER UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.auto_sync_mls_on_property_change();
