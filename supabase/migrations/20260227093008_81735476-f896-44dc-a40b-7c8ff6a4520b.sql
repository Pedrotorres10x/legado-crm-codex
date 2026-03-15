
-- 1. Add source column to tasks for auto-generated tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- 2. Trigger: Auto-create follow-up task 48h after visit is inserted
CREATE OR REPLACE FUNCTION public.auto_task_after_visit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tasks (title, description, due_date, priority, task_type, contact_id, property_id, agent_id, source)
  VALUES (
    'Seguimiento post-visita',
    'Contactar al cliente tras la visita a ' || COALESCE(
      (SELECT title FROM public.properties WHERE id = NEW.property_id), 'propiedad'
    ),
    NEW.visit_date + INTERVAL '48 hours',
    'alta',
    'seguimiento',
    NEW.contact_id,
    NEW.property_id,
    NEW.agent_id,
    'auto_visita'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_task_after_visit ON public.visits;
CREATE TRIGGER trg_auto_task_after_visit
  AFTER INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_task_after_visit();

-- 3. Trigger: Auto-create Horus phase tasks on captacion status change
CREATE OR REPLACE FUNCTION public.auto_task_on_captacion_change()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_id uuid;
  v_contact_id uuid;
  v_property_id uuid;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  v_agent_id := COALESCE(NEW.agent_id, OLD.agent_id);
  v_contact_id := NEW.contact_id;
  v_property_id := NEW.property_id;

  IF v_agent_id IS NULL THEN RETURN NEW; END IF;

  -- Phase: en_proceso → requires documentation
  IF NEW.status = 'en_proceso' THEN
    INSERT INTO public.tasks (title, description, due_date, priority, task_type, contact_id, property_id, agent_id, source)
    VALUES
      ('Solicitar escrituras al propietario', 'Fase Horus: En Proceso. Obtener copia de escrituras.', now() + INTERVAL '7 days', 'alta', 'seguimiento', v_contact_id, v_property_id, v_agent_id, 'auto_horus'),
      ('Consulta catastral', 'Fase Horus: En Proceso. Verificar datos catastrales de la propiedad.', now() + INTERVAL '5 days', 'media', 'otro', v_contact_id, v_property_id, v_agent_id, 'auto_horus'),
      ('Solicitar valoración', 'Fase Horus: En Proceso. Preparar valoración de mercado.', now() + INTERVAL '7 days', 'media', 'otro', v_contact_id, v_property_id, v_agent_id, 'auto_horus');
  END IF;

  -- Phase: activo → requires marketing
  IF NEW.status = 'activo' THEN
    INSERT INTO public.tasks (title, description, due_date, priority, task_type, contact_id, property_id, agent_id, source)
    VALUES
      ('Programar fotos profesionales', 'Fase Horus: Activo. Coordinar sesión de fotos profesionales.', now() + INTERVAL '7 days', 'alta', 'otro', v_contact_id, v_property_id, v_agent_id, 'auto_horus'),
      ('Gestionar CEE', 'Fase Horus: Activo. Tramitar certificado energético si no existe.', now() + INTERVAL '10 days', 'media', 'otro', v_contact_id, v_property_id, v_agent_id, 'auto_horus');
  END IF;

  -- Phase: cierre → closing tasks
  IF NEW.status = 'cierre' THEN
    INSERT INTO public.tasks (title, description, due_date, priority, task_type, contact_id, property_id, agent_id, source)
    VALUES
      ('Verificar IBI y cargas', 'Fase Horus: Cierre. Comprobar IBI actualizado y nota simple.', now() + INTERVAL '3 days', 'alta', 'otro', v_contact_id, v_property_id, v_agent_id, 'auto_horus'),
      ('Preparar documentación de cierre', 'Fase Horus: Cierre. Reunir toda la documentación para notaría.', now() + INTERVAL '5 days', 'alta', 'otro', v_contact_id, v_property_id, v_agent_id, 'auto_horus');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_task_captacion ON public.captaciones;
CREATE TRIGGER trg_auto_task_captacion
  AFTER UPDATE ON public.captaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_task_on_captacion_change();
