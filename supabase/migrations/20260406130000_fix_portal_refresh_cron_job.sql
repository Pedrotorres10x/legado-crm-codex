-- The portal-refresh-every-12h pg_cron job (jobid=4) has never fired despite being
-- active and correctly configured. Drop and recreate to reset internal pg_cron state.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
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
