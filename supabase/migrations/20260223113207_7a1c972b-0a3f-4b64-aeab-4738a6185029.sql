
-- 1. Resincronizar secuencia al maximo actual
SELECT setval('property_reference_seq',
  GREATEST(
    COALESCE(
      (SELECT max(substring(crm_reference from 5)::bigint) 
       FROM properties 
       WHERE crm_reference ~ '^LGD-[0-9]+$'),
      0
    ),
    (SELECT last_value FROM property_reference_seq)
  ) + 1,
  false
);

-- 2. Reemplazar la funcion del trigger con reintento anti-colision
CREATE OR REPLACE FUNCTION public.auto_assign_property_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  IF NEW.crm_reference IS NULL OR NEW.crm_reference = '' THEN
    LOOP
      candidate := 'LGD-' || lpad(nextval('property_reference_seq')::text, 4, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM properties WHERE crm_reference = candidate
      );
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'No se pudo generar referencia CRM unica tras 10 intentos';
      END IF;
    END LOOP;
    NEW.crm_reference := candidate;
  END IF;
  RETURN NEW;
END;
$$;
