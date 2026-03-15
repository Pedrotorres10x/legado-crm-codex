-- Trigger para auto-generar portal_token en nuevas propiedades
CREATE OR REPLACE FUNCTION public.auto_assign_portal_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.portal_token IS NULL OR NEW.portal_token = '' THEN
    NEW.portal_token := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_portal_token_on_insert
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_portal_token();