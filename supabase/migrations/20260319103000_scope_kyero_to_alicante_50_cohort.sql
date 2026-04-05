UPDATE public.portal_feeds
SET filters = COALESCE(filters, '{}'::jsonb) || jsonb_build_object(
  'required_tags',
  jsonb_build_array('portal_cohort_alicante_50')
),
notes = CASE
  WHEN coalesce(notes, '') = '' THEN 'Kyero publica exclusivamente la cohorte editorial Alicante 50.'
  WHEN notes ILIKE '%cohorte editorial Alicante 50%' THEN notes
  ELSE notes || ' Kyero publica exclusivamente la cohorte editorial Alicante 50.'
END,
updated_at = now()
WHERE portal_name = 'kyero';
