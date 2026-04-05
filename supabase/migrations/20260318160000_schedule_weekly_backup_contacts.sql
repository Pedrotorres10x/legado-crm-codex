CREATE OR REPLACE FUNCTION public.run_backup_contacts_cron()
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
    RAISE NOTICE 'Skipping backup cron: missing app.supabase_url or app.service_role_key';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/backup-contacts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key,
      'apikey', service_key
    ),
    body := jsonb_build_object(
      'mode', 'storage-only',
      'target', 'all'
    ),
    timeout_milliseconds := 180000
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
  WHERE jobname = 'weekly-backup-contacts-and-properties'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'weekly-backup-contacts-and-properties',
    '0 7 * * 1',
    $cron$SELECT public.run_backup_contacts_cron();$cron$
  );
END $$;
