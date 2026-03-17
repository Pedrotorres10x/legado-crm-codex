DO $$
DECLARE
  orphan_contact_ids uuid[];
BEGIN
  DELETE FROM property_owners po
  USING properties p, contacts c
  WHERE po.property_id = p.id
    AND c.id = po.contact_id
    AND COALESCE(p.source, '') <> 'habihub'
    AND p.source_metadata ? 'legacy_origin'
    AND c.source_ref LIKE 'owner:%'
    AND c.source_ref <> 'owner:habihub'
    AND po.notes LIKE 'Asignado automáticamente desde importación %';

  UPDATE properties
  SET owner_id = NULL
  WHERE COALESCE(source, '') <> 'habihub'
    AND source_metadata ? 'legacy_origin'
    AND owner_id IN (
      SELECT id
      FROM contacts
      WHERE source_ref LIKE 'owner:%'
        AND source_ref <> 'owner:habihub'
        AND notes LIKE 'Propietario técnico automático para inmuebles importados desde %.'
    );

  SELECT ARRAY(
    SELECT c.id
    FROM contacts c
    WHERE c.source_ref LIKE 'owner:%'
      AND c.source_ref <> 'owner:habihub'
      AND c.notes LIKE 'Propietario técnico automático para inmuebles importados desde %.'
      AND NOT EXISTS (
        SELECT 1
        FROM properties p
        WHERE p.owner_id = c.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM property_owners po
        WHERE po.contact_id = c.id
      )
  )
  INTO orphan_contact_ids;

  IF array_length(orphan_contact_ids, 1) IS NOT NULL THEN
    DELETE FROM contacts
    WHERE id = ANY(orphan_contact_ids);
  END IF;
END $$;
