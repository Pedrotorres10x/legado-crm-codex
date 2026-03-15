
CREATE OR REPLACE FUNCTION public.auto_task_on_match_interested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  contact_name text;
  prop_title text;
  demand_contact_id uuid;
BEGIN
  -- Only fire when status changes TO 'interesado'
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'interesado' THEN
    RETURN NEW;
  END IF;

  -- Get contact and property info
  SELECT d.contact_id INTO demand_contact_id
  FROM public.demands d WHERE d.id = NEW.demand_id;

  SELECT c.full_name INTO contact_name
  FROM public.contacts c WHERE c.id = demand_contact_id;

  SELECT p.title INTO prop_title
  FROM public.properties p WHERE p.id = NEW.property_id;

  -- Check no pending visit already exists for this contact+property
  IF EXISTS (
    SELECT 1 FROM public.visits
    WHERE contact_id = demand_contact_id
      AND property_id = NEW.property_id
      AND visit_date > now()
  ) THEN
    RETURN NEW;
  END IF;

  -- Create task for the agent
  INSERT INTO public.tasks (
    agent_id, title, description, due_date, priority, task_type, contact_id, property_id
  ) VALUES (
    COALESCE(NEW.agent_id, (SELECT agent_id FROM public.contacts WHERE id = demand_contact_id)),
    'Programar visita: ' || COALESCE(contact_name, 'Contacto'),
    'Match interesado en ' || COALESCE(prop_title, 'inmueble') || '. Contactar para agendar visita.',
    (now() + interval '2 days')::date,
    'alta',
    'visita',
    demand_contact_id,
    NEW.property_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_auto_task_match_interested
AFTER UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.auto_task_on_match_interested();
