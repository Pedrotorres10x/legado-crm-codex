-- Harden CRM property references:
-- - Always assign the next sequential LGD number on insert.
-- - Never infer/reuse a previous reference for a new property.
-- - Cycle only after 1,000,000, while still skipping live collisions.

ALTER SEQUENCE IF EXISTS public.property_reference_seq
  MINVALUE 1
  MAXVALUE 1000000
  CYCLE;

SELECT setval(
  'public.property_reference_seq',
  LEAST(
    GREATEST(
      COALESCE(
        (
          SELECT max(substring(crm_reference from 5)::bigint)
          FROM public.properties
          WHERE crm_reference ~ '^LGD-[0-9]+$'
        ),
        0
      ),
      COALESCE(
        (
          SELECT last_value
          FROM public.property_reference_seq
        ),
        0
      )
    ),
    1000000
  ) + CASE
        WHEN LEAST(
          GREATEST(
            COALESCE(
              (
                SELECT max(substring(crm_reference from 5)::bigint)
                FROM public.properties
                WHERE crm_reference ~ '^LGD-[0-9]+$'
              ),
              0
            ),
            COALESCE(
              (
                SELECT last_value
                FROM public.property_reference_seq
              ),
              0
            )
          ),
          1000000
        ) >= 1000000 THEN 0
        ELSE 1
      END,
  false
);

CREATE OR REPLACE FUNCTION public.generate_property_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  candidate_num bigint;
  candidate text;
  attempts integer := 0;
BEGIN
  LOOP
    candidate_num := nextval('public.property_reference_seq');
    candidate := 'LGD-' || lpad(candidate_num::text, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.properties
      WHERE crm_reference = candidate
    );

    attempts := attempts + 1;
    IF attempts > 1000000 THEN
      RAISE EXCEPTION 'No se pudo generar una referencia CRM unica tras recorrer el ciclo completo';
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_property_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.crm_reference IS NULL OR btrim(NEW.crm_reference) = '' THEN
    NEW.crm_reference := public.generate_property_reference();
  END IF;

  RETURN NEW;
END;
$$;
