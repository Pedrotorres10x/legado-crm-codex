CREATE OR REPLACE FUNCTION public.sync_property_owner_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Set owner_id if property has none
  UPDATE public.properties
  SET owner_id = NEW.contact_id
  WHERE id = NEW.property_id AND owner_id IS NULL;

  -- Promote contact to propietario if needed
  UPDATE public.contacts
  SET contact_type = CASE
    WHEN contact_type IN ('comprador'::contact_type, 'ambos'::contact_type)
      THEN 'ambos'::contact_type
    ELSE 'propietario'::contact_type
  END,
  updated_at = now()
  WHERE id = NEW.contact_id
    AND contact_type NOT IN ('propietario'::contact_type, 'ambos'::contact_type, 'vendedor_cerrado'::contact_type, 'comprador_cerrado'::contact_type);

  RETURN NEW;
END;
$function$;