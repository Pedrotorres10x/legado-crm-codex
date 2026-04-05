CREATE OR REPLACE FUNCTION public.run_portal_refresh_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  supabase_url := COALESCE(
    current_setting('app.supabase_url', true),
    (SELECT value #>> '{}' FROM public.settings WHERE key = 'supabase_url')
  );
  service_key := COALESCE(
    current_setting('app.service_role_key', true),
    (SELECT value #>> '{}' FROM public.settings WHERE key = 'service_role_key')
  );

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Skipping portal refresh cron: missing app.supabase_url/service_role_key and public.settings fallback';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/portal-refresh-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key,
      'apikey', service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
END;
$$;
