INSERT INTO public.app_config (key, value)
VALUES ('messaging_enabled', 'true')
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
