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
  supabase_url := current_setting('app.supabase_url', true);
  service_key := current_setting('app.service_role_key', true);

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Skipping portal refresh cron: missing app.supabase_url or app.service_role_key';
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

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'portal-refresh-every-12h'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'portal-refresh-every-12h',
    '0 0,12 * * *',
    $cron$SELECT public.run_portal_refresh_cron();$cron$
  );
END $$;
