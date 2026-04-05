CREATE OR REPLACE FUNCTION public.get_runtime_secret(app_setting text, settings_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    current_setting(app_setting, true),
    (SELECT value #>> '{}' FROM public.settings WHERE key = settings_key)
  );
$$;

CREATE OR REPLACE FUNCTION public.run_xml_feed_import_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  supabase_url := public.get_runtime_secret('app.supabase_url', 'supabase_url');
  service_key := public.get_runtime_secret('app.service_role_key', 'service_role_key');

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Skipping XML feed cron: missing runtime secrets';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/import-xml-feed',
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
  supabase_url := public.get_runtime_secret('app.supabase_url', 'supabase_url');
  service_key := public.get_runtime_secret('app.service_role_key', 'service_role_key');

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Skipping backup cron: missing runtime secrets';
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

CREATE OR REPLACE FUNCTION public.run_property_interest_followup_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  supabase_url := public.get_runtime_secret('app.supabase_url', 'supabase_url');
  service_key := public.get_runtime_secret('app.service_role_key', 'service_role_key');

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Skipping property interest followup cron: missing runtime secrets';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/property-interest-followup-cron',
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

CREATE OR REPLACE FUNCTION public.push_on_new_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
  prop_title text;
  contact_name text;
BEGIN
  supabase_url := public.get_runtime_secret('app.supabase_url', 'supabase_url');
  service_key := public.get_runtime_secret('app.service_role_key', 'service_role_key');

  IF NEW.agent_id IS NULL OR supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.title INTO prop_title FROM public.properties p WHERE p.id = NEW.property_id;
  SELECT c.full_name INTO contact_name FROM public.contacts c WHERE c.id = NEW.contact_id;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'agent_id', NEW.agent_id,
      'title', '📅 Nueva visita programada',
      'body', COALESCE(contact_name, '-') || ' → ' || COALESCE(prop_title, '-') || ' · ' || to_char(NEW.visit_date, 'DD/MM HH24:MI'),
      'data', jsonb_build_object('table', 'visits', 'id', NEW.id, 'property_id', NEW.property_id)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.push_on_visit_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
  prop_title text;
  contact_name text;
BEGIN
  IF OLD.confirmation_status = NEW.confirmation_status THEN
    RETURN NEW;
  END IF;
  IF NEW.confirmation_status <> 'confirmada' THEN
    RETURN NEW;
  END IF;

  supabase_url := public.get_runtime_secret('app.supabase_url', 'supabase_url');
  service_key := public.get_runtime_secret('app.service_role_key', 'service_role_key');

  IF NEW.agent_id IS NULL OR supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.title INTO prop_title FROM public.properties p WHERE p.id = NEW.property_id;
  SELECT c.full_name INTO contact_name FROM public.contacts c WHERE c.id = NEW.contact_id;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'agent_id', NEW.agent_id,
      'title', '✅ Visita confirmada por el cliente',
      'body', COALESCE(contact_name, '-') || ' confirmó visita a ' || COALESCE(prop_title, '-') || ' · ' || to_char(NEW.visit_date, 'DD/MM HH24:MI'),
      'data', jsonb_build_object('table', 'visits', 'id', NEW.id, 'property_id', NEW.property_id)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_instant_property_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  supabase_url := public.get_runtime_secret('app.supabase_url', 'supabase_url');
  service_key := public.get_runtime_secret('app.service_role_key', 'service_role_key');

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/property-instant-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('property_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.chain_fotocasa_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
  next_offset int;
  batch_sz int;
  sync_run_id text;
BEGIN
  IF NEW.target <> 'fotocasa' OR NEW.event <> 'sync_batch_summary' THEN
    RETURN NEW;
  END IF;

  IF (NEW.payload->>'has_more')::boolean IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  supabase_url := public.get_runtime_secret('app.supabase_url', 'supabase_url');
  service_key := public.get_runtime_secret('app.service_role_key', 'service_role_key');

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  next_offset := (coalesce(NEW.payload->>'offset', '0'))::int
               + (coalesce(NEW.payload->>'batch_size', '50'))::int;
  batch_sz := (coalesce(NEW.payload->>'batch_size', '50'))::int;
  sync_run_id := nullif(NEW.payload->>'sync_run_id', '');

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/fotocasa-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'action', 'sync_all',
      'batch_size', batch_sz,
      'offset', next_offset,
      'sync_run_id', sync_run_id
    ),
    timeout_milliseconds := 15000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_sync_fotocasa_on_property_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  IF NEW.country IS NOT NULL AND NEW.country <> 'España' THEN
    RETURN NEW;
  END IF;

  supabase_url := public.get_runtime_secret('app.supabase_url', 'supabase_url');
  service_key := public.get_runtime_secret('app.service_role_key', 'service_role_key');

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status IN ('vendido', 'retirado', 'reservado')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/fotocasa-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'action', 'delete',
        'property_id', NEW.id
      ),
      timeout_milliseconds := 15000
    );

    RETURN NEW;
  END IF;

  IF NEW.status = 'disponible'
     AND NEW.latitude IS NOT NULL
     AND NEW.longitude IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/fotocasa-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
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
$$;
