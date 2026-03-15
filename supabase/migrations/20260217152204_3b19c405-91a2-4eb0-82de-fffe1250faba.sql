-- When a property is marked as 'vendido', automatically:
-- 1. Change owner to vendedor_cerrado + set sale_date
-- 2. Change buyer (from accepted offer) to comprador_cerrado + set purchase_date
CREATE OR REPLACE FUNCTION public.auto_close_contacts_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  buyer_id uuid;
BEGIN
  -- Only trigger when status changes TO 'vendido'
  IF NEW.status = 'vendido' AND (OLD.status IS DISTINCT FROM 'vendido') THEN
    
    -- 1. Update the owner (propietario → vendedor_cerrado)
    IF NEW.owner_id IS NOT NULL THEN
      UPDATE public.contacts
      SET contact_type = 'vendedor_cerrado',
          sale_date = COALESCE(sale_date, CURRENT_DATE),
          updated_at = now()
      WHERE id = NEW.owner_id
        AND contact_type IN ('propietario', 'prospecto');
    END IF;

    -- 2. Find buyer from accepted offer and update (comprador → comprador_cerrado)
    SELECT o.contact_id INTO buyer_id
    FROM public.offers o
    WHERE o.property_id = NEW.id
      AND o.status = 'aceptada'
    ORDER BY o.updated_at DESC
    LIMIT 1;

    IF buyer_id IS NOT NULL THEN
      UPDATE public.contacts
      SET contact_type = 'comprador_cerrado',
          purchase_date = COALESCE(purchase_date, CURRENT_DATE),
          updated_at = now()
      WHERE id = buyer_id
        AND contact_type IN ('comprador', 'ambos');
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER trg_auto_close_contacts_on_sale
  AFTER UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_close_contacts_on_sale();