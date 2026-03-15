
-- Trigger 1: Push cuando se crea una visita nueva
CREATE OR REPLACE FUNCTION public.push_on_new_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_key  text;
  prop_title   text;
  contact_name text;
BEGIN
  supabase_url := current_setting('app.supabase_url', true);
  service_key  := current_setting('app.service_role_key', true);

  IF NEW.agent_id IS NULL OR supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.title     INTO prop_title    FROM public.properties p WHERE p.id = NEW.property_id;
  SELECT c.full_name INTO contact_name FROM public.contacts   c WHERE c.id = NEW.contact_id;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object(
      'agent_id', NEW.agent_id,
      'title',    '📅 Nueva visita programada',
      'body',     COALESCE(contact_name, '-') || ' → ' || COALESCE(prop_title, '-') || ' · ' || to_char(NEW.visit_date, 'DD/MM HH24:MI'),
      'data',     jsonb_build_object('table', 'visits', 'id', NEW.id, 'property_id', NEW.property_id)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_new_visit ON public.visits;
CREATE TRIGGER trg_push_new_visit
  AFTER INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.push_on_new_visit();

-- Trigger 2: Push cuando una visita pasa a confirmada
CREATE OR REPLACE FUNCTION public.push_on_visit_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_key  text;
  prop_title   text;
  contact_name text;
BEGIN
  -- Only fire when confirmation_status changes to 'confirmada'
  IF OLD.confirmation_status = NEW.confirmation_status THEN
    RETURN NEW;
  END IF;
  IF NEW.confirmation_status <> 'confirmada' THEN
    RETURN NEW;
  END IF;

  supabase_url := current_setting('app.supabase_url', true);
  service_key  := current_setting('app.service_role_key', true);

  IF NEW.agent_id IS NULL OR supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.title     INTO prop_title    FROM public.properties p WHERE p.id = NEW.property_id;
  SELECT c.full_name INTO contact_name FROM public.contacts   c WHERE c.id = NEW.contact_id;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object(
      'agent_id', NEW.agent_id,
      'title',    '✅ Visita confirmada por el cliente',
      'body',     COALESCE(contact_name, '-') || ' confirmó visita a ' || COALESCE(prop_title, '-') || ' · ' || to_char(NEW.visit_date, 'DD/MM HH24:MI'),
      'data',     jsonb_build_object('table', 'visits', 'id', NEW.id, 'property_id', NEW.property_id)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_visit_confirmed ON public.visits;
CREATE TRIGGER trg_push_visit_confirmed
  AFTER UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.push_on_visit_confirmed();
