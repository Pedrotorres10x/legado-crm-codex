DO $$
DECLARE
  source_name text;
  source_contact_id uuid;
BEGIN
  FOR source_name IN
    SELECT DISTINCT COALESCE(NULLIF(TRIM(source), ''), 'legacy-crm')
    FROM properties
    WHERE COALESCE(source, '') <> 'habihub'
      AND source_metadata ? 'legacy_origin'
  LOOP
    SELECT id
    INTO source_contact_id
    FROM contacts
    WHERE source_ref = 'owner:' || source_name
    ORDER BY created_at NULLS LAST, id
    LIMIT 1;

    IF source_contact_id IS NULL THEN
      SELECT id
      INTO source_contact_id
      FROM contacts
      WHERE full_name = source_name
      ORDER BY created_at NULLS LAST, id
      LIMIT 1;
    END IF;

    IF source_contact_id IS NULL THEN
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
        source_name,
        'propietario',
        'activo',
        NULL,
        ARRAY[source_name, 'sistema', 'propietario']::text[],
        'owner:' || source_name,
        'Propietario técnico automático para inmuebles importados desde ' || source_name || '.'
      )
      RETURNING id INTO source_contact_id;
    ELSE
      UPDATE contacts
      SET
        full_name = source_name,
        contact_type = 'propietario',
        status = 'activo',
        agent_id = NULL,
        source_ref = 'owner:' || source_name,
        tags = ARRAY(
          SELECT DISTINCT tag
          FROM unnest(
            COALESCE(tags, ARRAY[]::text[]) ||
            ARRAY[source_name, 'sistema', 'propietario']::text[]
          ) AS tag
        ),
        notes = COALESCE(
          notes,
          'Propietario técnico automático para inmuebles importados desde ' || source_name || '.'
        )
      WHERE id = source_contact_id;
    END IF;

    UPDATE properties
    SET
      owner_id = source_contact_id,
      key_location = 'oficina'
    WHERE COALESCE(NULLIF(TRIM(source), ''), 'legacy-crm') = source_name
      AND COALESCE(source, '') <> 'habihub'
      AND source_metadata ? 'legacy_origin';

    INSERT INTO property_owners (
      property_id,
      contact_id,
      role,
      notes
    )
    SELECT
      p.id,
      source_contact_id,
      'propietario',
      'Asignado automáticamente desde importación ' || source_name
    FROM properties p
    WHERE COALESCE(NULLIF(TRIM(p.source), ''), 'legacy-crm') = source_name
      AND COALESCE(p.source, '') <> 'habihub'
      AND p.source_metadata ? 'legacy_origin'
    ON CONFLICT (property_id, contact_id) DO UPDATE
    SET
      role = EXCLUDED.role,
      notes = EXCLUDED.notes;
  END LOOP;
END $$;
