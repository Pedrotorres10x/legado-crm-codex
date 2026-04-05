ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS preferred_language TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contacts_preferred_language_check'
  ) THEN
    ALTER TABLE public.contacts
    ADD CONSTRAINT contacts_preferred_language_check
    CHECK (preferred_language IS NULL OR preferred_language IN ('es', 'en', 'fr', 'de'));
  END IF;
END $$;

UPDATE public.contacts AS c
SET preferred_language = normalized.lang
FROM (
  SELECT
    id,
    CASE
      WHEN lower(coalesce(preferred_language, '')) LIKE 'es%' THEN 'es'
      WHEN lower(coalesce(preferred_language, '')) LIKE 'en%' THEN 'en'
      WHEN lower(coalesce(preferred_language, '')) LIKE 'fr%' THEN 'fr'
      WHEN lower(coalesce(preferred_language, '')) LIKE 'de%' THEN 'de'
      WHEN lower(notes) ~ 'idioma:\s*(es|español|spanish|castellano)' THEN 'es'
      WHEN lower(notes) ~ 'idioma:\s*(fr|français|francais|french)' THEN 'fr'
      WHEN lower(notes) ~ 'idioma:\s*(de|deutsch|german|alemán|aleman)' THEN 'de'
      WHEN lower(notes) ~ 'idioma:\s*(en|english|inglés|ingles)' THEN 'en'
      ELSE NULL
    END AS lang
  FROM public.contacts
) AS normalized
WHERE c.id = normalized.id
  AND normalized.lang IS NOT NULL
  AND c.preferred_language IS DISTINCT FROM normalized.lang;

WITH latest_language AS (
  SELECT DISTINCT ON (contact_id)
    contact_id,
    CASE
      WHEN metadata->>'preferred_language' IN ('es', 'en', 'fr', 'de') THEN metadata->>'preferred_language'
      ELSE NULL
    END AS lang
  FROM public.communication_logs
  WHERE contact_id IS NOT NULL
    AND metadata ? 'preferred_language'
  ORDER BY contact_id, created_at DESC
)
UPDATE public.contacts AS c
SET preferred_language = latest_language.lang
FROM latest_language
WHERE c.id = latest_language.contact_id
  AND latest_language.lang IS NOT NULL
  AND c.preferred_language IS DISTINCT FROM latest_language.lang;
