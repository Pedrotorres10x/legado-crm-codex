CREATE OR REPLACE FUNCTION public.run_fotocasa_watchdog_cron()
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
    RAISE NOTICE 'Skipping Fotocasa watchdog cron: missing runtime secrets';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/fotocasa-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key,
      'apikey', service_key
    ),
    body := jsonb_build_object(
      'action', 'watchdog',
      'batch_size', 10
    ),
    timeout_milliseconds := 15000
  );
END;
$$;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'fotocasa-watchdog-every-15m'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'fotocasa-watchdog-every-15m',
    '*/15 * * * *',
    'SELECT public.run_fotocasa_watchdog_cron();'
  );
END $$;
