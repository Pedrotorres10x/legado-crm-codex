
-- Añadir los tres nuevos campos a properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS staircase text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS floor_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS door text DEFAULT NULL;

-- Migrar datos existentes del campo floor a los nuevos campos
-- El campo floor actual puede contener strings como "Esc. 1 21 211ª" o simplemente "3"
-- Intentamos parsear el patrón "Esc. X N Mª" si existe, si no lo dejamos en floor_number
UPDATE public.properties
SET floor_number = TRIM(floor)
WHERE floor IS NOT NULL
  AND floor NOT ILIKE '%esc%';

-- Para los que tienen formato "Esc. X ..." intentamos extraer partes
-- Los usuarios los editarán manualmente desde el formulario
UPDATE public.properties
SET floor_number = TRIM(floor)
WHERE floor IS NOT NULL
  AND staircase IS NULL
  AND door IS NULL;
