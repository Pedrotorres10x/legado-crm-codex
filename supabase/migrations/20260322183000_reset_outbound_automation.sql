-- Reset de la automatizacion de envios salientes sin borrar historico.
-- Objetivo: dejar apagados los motores actuales de WhatsApp/email y pausar
-- secuencias pendientes para poder redisenar el sistema desde cero.

-- 1. Kill switch solo de automatizaciones salientes.
INSERT INTO public.app_config (key, value)
VALUES ('automation_outbound_enabled', 'false')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- 2. Desactivar motores automaticos basados en settings.
INSERT INTO public.settings (key, value)
VALUES
  ('match_sender_enabled', 'false'),
  ('campaign_classify_enabled', 'false'),
  ('campaign_enrich_enabled', 'false')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- 3. Pausar cualquier secuencia de prospeccion pendiente para que no se reactive
-- al volver a encender la mensajeria mas adelante.
UPDATE public.prospecting_sequences
SET
  paused = true,
  updated_at = now()
WHERE completed = false
  AND replied = false
  AND paused = false;
