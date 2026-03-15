-- Rewrite trigger function using env vars directly via pg_net
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_agent_id uuid;
  notif_title text;
  notif_body text;
  prop_title text;
  contact_name text;
  supabase_url text;
  service_key text;
BEGIN
  -- Get connection details from Supabase vault / env
  supabase_url := current_setting('app.supabase_url', true);
  service_key  := current_setting('app.service_role_key', true);

  IF TG_TABLE_NAME = 'matches' THEN
    target_agent_id := NEW.agent_id;
    SELECT p.title INTO prop_title FROM public.properties p WHERE p.id = NEW.property_id;
    notif_title := '🎯 Nuevo match encontrado';
    notif_body  := COALESCE(prop_title, 'Inmueble') || ' · ' || COALESCE(NEW.compatibility::text, '?') || '% compatibilidad';

  ELSIF TG_TABLE_NAME = 'visits' THEN
    target_agent_id := NEW.agent_id;
    SELECT p.title     INTO prop_title    FROM public.properties p WHERE p.id = NEW.property_id;
    SELECT c.full_name INTO contact_name FROM public.contacts   c WHERE c.id = NEW.contact_id;
    notif_title := '📅 Nueva visita programada';
    notif_body  := COALESCE(contact_name, '-') || ' → ' || COALESCE(prop_title, '-')
                   || ' · ' || to_char(NEW.visit_date, 'DD/MM HH24:MI');
  END IF;

  IF target_agent_id IS NULL OR supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object(
      'agent_id', target_agent_id,
      'title',    notif_title,
      'body',     notif_body,
      'data',     jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- Never block the insert if push fails
END;
$$;