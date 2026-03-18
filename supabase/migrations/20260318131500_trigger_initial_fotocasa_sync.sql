DO $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  supabase_url := current_setting('app.supabase_url', true);
  service_key := current_setting('app.service_role_key', true);

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Skipping Fotocasa launch: missing app.supabase_url or app.service_role_key';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.portal_feeds
    WHERE portal_name = 'fotocasa'
      AND is_active = true
  ) THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/fotocasa-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'action', 'sync_all',
        'batch_size', 20,
        'offset', 0
      ),
      timeout_milliseconds := 15000
    );
  END IF;
END
$$;
