
-- Table for multiple owners per property
CREATE TABLE public.property_owners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'propietario',
  ownership_pct numeric,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, contact_id)
);

ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;

-- RLS: same pattern as properties — agent sees own, admin/coord sees all
CREATE POLICY "Auth users can view property_owners"
  ON public.property_owners FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert property_owners"
  ON public.property_owners FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update property_owners"
  ON public.property_owners FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can delete property_owners"
  ON public.property_owners FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- Migrate existing owner_id data
INSERT INTO public.property_owners (property_id, contact_id, role)
SELECT id, owner_id, 'propietario'
FROM public.properties
WHERE owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Trigger: when first owner is added and property has no owner_id, set it
CREATE OR REPLACE FUNCTION public.sync_property_owner_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set owner_id if property has none
  UPDATE public.properties
  SET owner_id = NEW.contact_id
  WHERE id = NEW.property_id AND owner_id IS NULL;

  -- Promote contact to propietario if needed
  UPDATE public.contacts
  SET contact_type = CASE
    WHEN contact_type IN ('comprador', 'ambos') THEN 'ambos'
    ELSE 'propietario'
  END,
  updated_at = now()
  WHERE id = NEW.contact_id
    AND contact_type NOT IN ('propietario', 'ambos', 'vendedor_cerrado', 'comprador_cerrado');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_property_owner_insert
AFTER INSERT ON public.property_owners
FOR EACH ROW EXECUTE FUNCTION public.sync_property_owner_on_insert();

-- Trigger: when an owner is removed, update owner_id if needed
CREATE OR REPLACE FUNCTION public.sync_property_owner_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_owner uuid;
BEGIN
  -- Only act if the deleted contact was the primary owner
  IF (SELECT owner_id FROM public.properties WHERE id = OLD.property_id) = OLD.contact_id THEN
    -- Find next owner
    SELECT contact_id INTO next_owner
    FROM public.property_owners
    WHERE property_id = OLD.property_id AND contact_id <> OLD.contact_id
    ORDER BY created_at ASC
    LIMIT 1;

    UPDATE public.properties
    SET owner_id = next_owner
    WHERE id = OLD.property_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_property_owner_delete
AFTER DELETE ON public.property_owners
FOR EACH ROW EXECUTE FUNCTION public.sync_property_owner_on_delete();

-- Update auto_close_contacts_on_sale to close ALL owners
CREATE OR REPLACE FUNCTION public.auto_close_contacts_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  buyer_id uuid;
  owner_record RECORD;
BEGIN
  IF NEW.status = 'vendido' AND (OLD.status IS DISTINCT FROM 'vendido') THEN
    
    -- 1. Update ALL owners from property_owners table
    FOR owner_record IN
      SELECT contact_id FROM public.property_owners WHERE property_id = NEW.id
    LOOP
      UPDATE public.contacts
      SET contact_type = 'vendedor_cerrado',
          sale_date = COALESCE(sale_date, CURRENT_DATE),
          updated_at = now()
      WHERE id = owner_record.contact_id
        AND contact_type IN ('propietario', 'prospecto');
    END LOOP;

    -- Fallback: also close owner_id if not in property_owners
    IF NEW.owner_id IS NOT NULL THEN
      UPDATE public.contacts
      SET contact_type = 'vendedor_cerrado',
          sale_date = COALESCE(sale_date, CURRENT_DATE),
          updated_at = now()
      WHERE id = NEW.owner_id
        AND contact_type IN ('propietario', 'prospecto');
    END IF;

    -- 2. Find buyer from accepted offer
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
$$;
