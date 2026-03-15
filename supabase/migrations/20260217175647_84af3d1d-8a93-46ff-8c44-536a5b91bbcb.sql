
-- General audit log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL, -- 'update', 'delete'
  field_name text, -- null for deletes
  old_value text,
  new_value text,
  record_snapshot jsonb, -- full row snapshot on delete
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin/coordinadora can view
CREATE POLICY "Admin coord view audit" ON public.audit_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- System can insert (triggers run as SECURITY DEFINER)
CREATE POLICY "System insert audit" ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (true);

-- No update/delete on audit logs
CREATE INDEX idx_audit_log_table_record ON public.audit_log (table_name, record_id);
CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);

-- Trigger function for property sensitive field changes
CREATE OR REPLACE FUNCTION public.audit_property_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_log (table_name, record_id, action, field_name, old_value, new_value, user_id)
    VALUES ('properties', NEW.id, 'update', 'status', OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  -- Agent change
  IF OLD.agent_id IS DISTINCT FROM NEW.agent_id THEN
    INSERT INTO audit_log (table_name, record_id, action, field_name, old_value, new_value, user_id)
    VALUES ('properties', NEW.id, 'update', 'agent_id', OLD.agent_id::text, NEW.agent_id::text, auth.uid());
  END IF;
  -- Owner change
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO audit_log (table_name, record_id, action, field_name, old_value, new_value, user_id)
    VALUES ('properties', NEW.id, 'update', 'owner_id', OLD.owner_id::text, NEW.owner_id::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_property_changes
BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.audit_property_changes();

-- Trigger function for property deletes
CREATE OR REPLACE FUNCTION public.audit_property_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, record_snapshot, user_id)
  VALUES ('properties', OLD.id, 'delete', to_jsonb(OLD), auth.uid());
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_audit_property_delete
BEFORE DELETE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.audit_property_delete();

-- Trigger function for contact sensitive field changes
CREATE OR REPLACE FUNCTION public.audit_contact_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO audit_log (table_name, record_id, action, field_name, old_value, new_value, user_id)
    VALUES ('contacts', NEW.id, 'update', 'status', OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  -- Contact type change
  IF OLD.contact_type IS DISTINCT FROM NEW.contact_type THEN
    INSERT INTO audit_log (table_name, record_id, action, field_name, old_value, new_value, user_id)
    VALUES ('contacts', NEW.id, 'update', 'contact_type', OLD.contact_type::text, NEW.contact_type::text, auth.uid());
  END IF;
  -- Agent change
  IF OLD.agent_id IS DISTINCT FROM NEW.agent_id THEN
    INSERT INTO audit_log (table_name, record_id, action, field_name, old_value, new_value, user_id)
    VALUES ('contacts', NEW.id, 'update', 'agent_id', OLD.agent_id::text, NEW.agent_id::text, auth.uid());
  END IF;
  -- Pipeline stage change
  IF OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
    INSERT INTO audit_log (table_name, record_id, action, field_name, old_value, new_value, user_id)
    VALUES ('contacts', NEW.id, 'update', 'pipeline_stage', OLD.pipeline_stage::text, NEW.pipeline_stage::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_contact_changes
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.audit_contact_changes();

-- Trigger function for contact deletes
CREATE OR REPLACE FUNCTION public.audit_contact_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, record_snapshot, user_id)
  VALUES ('contacts', OLD.id, 'delete', to_jsonb(OLD), auth.uid());
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_audit_contact_delete
BEFORE DELETE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.audit_contact_delete();
