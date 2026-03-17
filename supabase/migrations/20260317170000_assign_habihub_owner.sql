DO $$
DECLARE
  habihub_contact_id uuid;
BEGIN
  SELECT id
  INTO habihub_contact_id
  FROM contacts
  WHERE source_ref = 'owner:habihub'
  ORDER BY created_at NULLS LAST, id
  LIMIT 1;

  IF habihub_contact_id IS NULL THEN
    SELECT id
    INTO habihub_contact_id
    FROM contacts
    WHERE lower(full_name) = 'habihub'
    ORDER BY created_at NULLS LAST, id
    LIMIT 1;
  END IF;

  IF habihub_contact_id IS NULL THEN
    INSERT INTO contacts (
      full_name,
      contact_type,
      status,
      agent_id,
      tags,
      source_ref,
      notes
    )
    VALUES (
      'habihub',
      'propietario',
      'activo',
      NULL,
      ARRAY['habihub', 'sistema', 'propietario']::text[],
      'owner:habihub',
      'Propietario técnico automático para inmuebles importados desde HabiHub.'
    )
    RETURNING id INTO habihub_contact_id;
  ELSE
    UPDATE contacts
    SET
      full_name = 'habihub',
      contact_type = 'propietario',
      status = 'activo',
      agent_id = NULL,
      source_ref = 'owner:habihub',
      tags = ARRAY(
        SELECT DISTINCT tag
        FROM unnest(
          COALESCE(tags, ARRAY[]::text[]) ||
          ARRAY['habihub', 'sistema', 'propietario']::text[]
        ) AS tag
      ),
      notes = COALESCE(
        notes,
        'Propietario técnico automático para inmuebles importados desde HabiHub.'
      )
    WHERE id = habihub_contact_id;
  END IF;

  UPDATE properties
  SET
    owner_id = habihub_contact_id,
    key_location = 'oficina'
  WHERE source = 'habihub';

  INSERT INTO property_owners (
    property_id,
    contact_id,
    role,
    notes
  )
  SELECT
    p.id,
    habihub_contact_id,
    'propietario',
    'Asignado automáticamente desde feed HabiHub'
  FROM properties p
  WHERE p.source = 'habihub'
  ON CONFLICT (property_id, contact_id) DO UPDATE
  SET
    role = EXCLUDED.role,
    notes = EXCLUDED.notes;
END $$;
