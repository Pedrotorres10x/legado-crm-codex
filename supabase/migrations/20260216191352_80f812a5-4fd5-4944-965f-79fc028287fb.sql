
-- Drop partial index and add a proper unique constraint
DROP INDEX IF EXISTS properties_xml_id_unique;
ALTER TABLE public.properties ADD CONSTRAINT properties_xml_id_key UNIQUE (xml_id);
