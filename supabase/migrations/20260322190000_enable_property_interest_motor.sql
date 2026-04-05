-- Nuevo motor acotado:
-- demanda con propiedad concreta -> WhatsApp inicial sin enlace ->
-- respuesta del cliente -> envio del enlace de la propiedad.
-- Mantiene apagados el resto de automatismos generales.

INSERT INTO public.app_config (key, value)
VALUES ('property_interest_automation_enabled', 'true')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
