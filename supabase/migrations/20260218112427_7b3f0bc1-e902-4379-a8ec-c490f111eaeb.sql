
-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: detect_property_anomalies
-- Fires on INSERT/UPDATE of properties, checks for suspicious field values,
-- and inserts a notification for every admin and coordinadora found.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.detect_property_anomalies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anomalies text[] := '{}';
  r         record;
  floor_num int;
BEGIN
  -- ── Floor number ──────────────────────────────────────────────────────────
  IF NEW.floor_number IS NOT NULL AND NEW.floor_number ~ '^\d+$' THEN
    floor_num := NEW.floor_number::int;
    IF floor_num > 50 THEN
      anomalies := anomalies || ('Planta sospechosa: "' || NEW.floor_number || '" (¿concatenación con puerta?)');
    END IF;
  END IF;

  -- ── Price ─────────────────────────────────────────────────────────────────
  IF NEW.price IS NOT NULL THEN
    IF NEW.price < 1000 THEN
      anomalies := anomalies || ('Precio muy bajo: ' || NEW.price::text || ' €');
    ELSIF NEW.price > 50000000 THEN
      anomalies := anomalies || ('Precio muy alto: ' || NEW.price::text || ' €');
    END IF;
  END IF;

  -- ── Surface area ─────────────────────────────────────────────────────────
  IF NEW.surface_area IS NOT NULL THEN
    IF NEW.surface_area < 5 THEN
      anomalies := anomalies || ('Superficie muy pequeña: ' || NEW.surface_area::text || ' m²');
    ELSIF NEW.surface_area > 50000 THEN
      anomalies := anomalies || ('Superficie muy grande: ' || NEW.surface_area::text || ' m²');
    END IF;
  END IF;

  -- ── Bedrooms ─────────────────────────────────────────────────────────────
  IF NEW.bedrooms IS NOT NULL AND NEW.bedrooms > 30 THEN
    anomalies := anomalies || ('Número de habitaciones inusual: ' || NEW.bedrooms::text);
  END IF;

  -- ── Bathrooms ────────────────────────────────────────────────────────────
  IF NEW.bathrooms IS NOT NULL AND NEW.bathrooms > 20 THEN
    anomalies := anomalies || ('Número de baños inusual: ' || NEW.bathrooms::text);
  END IF;

  -- ── Built > Surface ───────────────────────────────────────────────────────
  IF NEW.built_area IS NOT NULL AND NEW.surface_area IS NOT NULL
     AND NEW.built_area > NEW.surface_area * 2 THEN
    anomalies := anomalies || ('Superficie construida (' || NEW.built_area::text || ') muy superior a útil (' || NEW.surface_area::text || ')');
  END IF;

  -- ── Zip code format (Spain: 5 digits) ────────────────────────────────────
  IF NEW.zip_code IS NOT NULL AND NEW.zip_code !~ '^\d{5}$' THEN
    anomalies := anomalies || ('Código postal inválido: "' || NEW.zip_code || '"');
  END IF;

  -- ── Owner price > Sale price (with big margin) ───────────────────────────
  IF NEW.owner_price IS NOT NULL AND NEW.price IS NOT NULL
     AND NEW.owner_price > NEW.price * 1.5 THEN
    anomalies := anomalies || ('Precio propietario (' || NEW.owner_price::text || ' €) muy superior al precio venta (' || NEW.price::text || ' €)');
  END IF;

  -- ── Nothing suspicious → exit ────────────────────────────────────────────
  IF array_length(anomalies, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── Notify every admin and coordinadora ──────────────────────────────────
  FOR r IN
    SELECT user_id
    FROM public.user_roles
    WHERE role IN ('admin', 'coordinadora')
  LOOP
    INSERT INTO public.notifications (
      event_type, entity_type, entity_id,
      title, description, agent_id
    ) VALUES (
      'data_anomaly',
      'property',
      NEW.id,
      '⚠️ Dato sospechoso en inmueble: ' || NEW.title,
      array_to_string(anomalies, ' · '),
      r.user_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop old trigger if it exists, then recreate
DROP TRIGGER IF EXISTS trg_detect_property_anomalies ON public.properties;

CREATE TRIGGER trg_detect_property_anomalies
  AFTER INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_property_anomalies();
