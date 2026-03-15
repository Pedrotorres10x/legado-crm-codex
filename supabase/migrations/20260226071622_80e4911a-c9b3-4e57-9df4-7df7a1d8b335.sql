
CREATE OR REPLACE FUNCTION public.auto_statefox_campaign()
RETURNS trigger AS $$
BEGIN
  -- If contact has 'Statefox' tag, ensure contact_type is 'statefox'
  IF NEW.tags IS NOT NULL AND 'Statefox' = ANY(NEW.tags) THEN
    NEW.contact_type := 'statefox';
    IF TG_OP = 'INSERT' AND NEW.status = 'nuevo' THEN
      -- keep status as nuevo for campaign processing
      NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_statefox_campaign ON public.contacts;

CREATE TRIGGER trg_auto_statefox_campaign
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_statefox_campaign();
