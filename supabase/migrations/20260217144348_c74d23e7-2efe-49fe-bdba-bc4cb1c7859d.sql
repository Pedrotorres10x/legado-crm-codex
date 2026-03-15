
-- Table for CRM notifications (admin only)
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,       -- 'new_contact', 'new_property', 'new_visit', 'new_offer', 'status_change', 'stage_change', 'health_warning'
  entity_type text NOT NULL,      -- 'contact', 'property', 'visit', 'offer'
  entity_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  agent_id uuid,                  -- who triggered the change
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can view notifications
CREATE POLICY "Admins can view notifications"
ON public.notifications FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update (mark as read)
CREATE POLICY "Admins can update notifications"
ON public.notifications FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- System inserts (triggers run as owner)
CREATE POLICY "System insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Admins can delete notifications
CREATE POLICY "Admins can delete notifications"
ON public.notifications FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for quick admin queries
CREATE INDEX idx_notifications_unread ON public.notifications (is_read, created_at DESC);

-----------------------------------------------------------------
-- TRIGGER: new contact
-----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (event_type, entity_type, entity_id, title, description, agent_id)
  VALUES (
    'new_contact', 'contact', NEW.id,
    'Nuevo contacto: ' || NEW.full_name,
    'Tipo: ' || COALESCE(NEW.contact_type::text, '-') || COALESCE(' · ' || NEW.city, ''),
    NEW.agent_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_contact
AFTER INSERT ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.notify_new_contact();

-----------------------------------------------------------------
-- TRIGGER: new property
-----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_property()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (event_type, entity_type, entity_id, title, description, agent_id)
  VALUES (
    'new_property', 'property', NEW.id,
    'Nuevo inmueble: ' || NEW.title,
    COALESCE(NEW.city, '') || CASE WHEN NEW.price IS NOT NULL THEN ' · ' || NEW.price::text || ' €' ELSE '' END,
    NEW.agent_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_property
AFTER INSERT ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.notify_new_property();

-----------------------------------------------------------------
-- TRIGGER: property status change
-----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_property_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (event_type, entity_type, entity_id, title, description, agent_id)
    VALUES (
      'status_change', 'property', NEW.id,
      'Cambio estado: ' || NEW.title,
      OLD.status::text || ' → ' || NEW.status::text,
      NEW.agent_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_property_status
AFTER UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.notify_property_status_change();

-----------------------------------------------------------------
-- TRIGGER: contact pipeline stage change
-----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_contact_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
    INSERT INTO public.notifications (event_type, entity_type, entity_id, title, description, agent_id)
    VALUES (
      'stage_change', 'contact', NEW.id,
      'Cambio etapa: ' || NEW.full_name,
      COALESCE(OLD.pipeline_stage, '-') || ' → ' || COALESCE(NEW.pipeline_stage, '-'),
      NEW.agent_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_contact_stage
AFTER UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.notify_contact_stage_change();

-----------------------------------------------------------------
-- TRIGGER: new visit
-----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop_title text;
  contact_name text;
BEGIN
  SELECT title INTO prop_title FROM public.properties WHERE id = NEW.property_id;
  SELECT full_name INTO contact_name FROM public.contacts WHERE id = NEW.contact_id;
  INSERT INTO public.notifications (event_type, entity_type, entity_id, title, description, agent_id)
  VALUES (
    'new_visit', 'visit', NEW.id,
    'Nueva visita programada',
    COALESCE(contact_name, '-') || ' → ' || COALESCE(prop_title, '-') || ' · ' || to_char(NEW.visit_date, 'DD/MM/YYYY HH24:MI'),
    NEW.agent_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_visit
AFTER INSERT ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.notify_new_visit();

-----------------------------------------------------------------
-- TRIGGER: new offer
-----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop_title text;
  contact_name text;
BEGIN
  SELECT title INTO prop_title FROM public.properties WHERE id = NEW.property_id;
  SELECT full_name INTO contact_name FROM public.contacts WHERE id = NEW.contact_id;
  INSERT INTO public.notifications (event_type, entity_type, entity_id, title, description, agent_id)
  VALUES (
    'new_offer', 'offer', NEW.id,
    'Nueva oferta: ' || NEW.amount::text || ' €',
    COALESCE(contact_name, '-') || ' → ' || COALESCE(prop_title, '-'),
    NEW.agent_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_offer
AFTER INSERT ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.notify_new_offer();
