
-- ══════════════════════════════════════════════════════════════
-- 1. Propiedades: los agentes ven TODAS (no solo las propias)
-- ══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Agent view own properties" ON public.properties;

CREATE POLICY "Agents view all properties"
  ON public.properties FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ══════════════════════════════════════════════════════════════
-- 2. Tabla de solicitudes de cambio
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.change_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text NOT NULL,          -- 'contact' | 'property'
  entity_id     uuid NOT NULL,
  entity_label  text,                   -- nombre/título para mostrar
  requested_by  uuid NOT NULL,          -- agent user_id
  field_name    text,                   -- campo concreto (opcional)
  current_value text,                   -- valor actual (opcional)
  new_value     text,                   -- valor deseado (opcional)
  description   text NOT NULL,          -- descripción libre del cambio
  status        text NOT NULL DEFAULT 'pendiente',  -- pendiente | atendido | rechazado
  resolved_by   uuid,
  resolved_at   timestamptz,
  resolver_note text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

-- Agentes crean solicitudes propias
CREATE POLICY "Agents insert own change_requests"
  ON public.change_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

-- Agentes ven solo sus solicitudes
CREATE POLICY "Agents view own change_requests"
  ON public.change_requests FOR SELECT
  USING (requested_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- Admin/coordinadora pueden actualizar (resolver)
CREATE POLICY "Admin coord update change_requests"
  ON public.change_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- Admin puede borrar
CREATE POLICY "Admin delete change_requests"
  ON public.change_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
