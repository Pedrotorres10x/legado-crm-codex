-- Function to call send-push-notification edge function
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
BEGIN
  -- Determine agent and message based on table
  IF TG_TABLE_NAME = 'matches' THEN
    target_agent_id := NEW.agent_id;
    SELECT p.title INTO prop_title FROM public.properties p WHERE p.id = NEW.property_id;
    notif_title := '🎯 Nuevo match encontrado';
    notif_body := COALESCE(prop_title, 'Inmueble sin título') || ' · ' || NEW.compatibility::text || '% compatibilidad';

  ELSIF TG_TABLE_NAME = 'visits' THEN
    target_agent_id := NEW.agent_id;
    SELECT p.title INTO prop_title FROM public.properties p WHERE p.id = NEW.property_id;
    SELECT c.full_name INTO contact_name FROM public.contacts c WHERE c.id = NEW.contact_id;
    notif_title := '📅 Nueva visita programada';
    notif_body := COALESCE(contact_name, '-') || ' → ' || COALESCE(prop_title, '-') || ' · ' || to_char(NEW.visit_date, 'DD/MM HH24:MI');
  END IF;

  IF target_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Call edge function asynchronously via pg_net if available, otherwise via http
  PERFORM
    net.http_post(
      url := (SELECT value::text FROM public.settings WHERE key = 'supabase_url') || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value::text FROM public.settings WHERE key = 'service_role_key')
      ),
      body := jsonb_build_object(
        'agent_id', target_agent_id,
        'title', notif_title,
        'body', notif_body,
        'data', jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id)
      )
    );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert if push fails
  RETURN NEW;
END;
$$;

-- Trigger on matches
DROP TRIGGER IF EXISTS push_on_new_match ON public.matches;
CREATE TRIGGER push_on_new_match
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

-- Trigger on visits
DROP TRIGGER IF EXISTS push_on_new_visit ON public.visits;
CREATE TRIGGER push_on_new_visit
  AFTER INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();