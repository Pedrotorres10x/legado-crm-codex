INSERT INTO public.portal_feeds (
  portal_name,
  display_name,
  format,
  is_active,
  feed_token,
  filters,
  notes
)
VALUES (
  'thinkspain',
  'thinkSPAIN',
  'kyero_v3',
  true,
  'e59bf3b5-8cc4-4d8e-bd81-41bca80a7cf3',
  jsonb_build_object(
    'required_tags',
    jsonb_build_array('portal_cohort_alicante_50')
  ),
  'Integrado desde el CRM el 2026-03-20. Publica la misma cohorte editorial que Kyero.'
)
ON CONFLICT (portal_name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    format = EXCLUDED.format,
    is_active = true,
    feed_token = EXCLUDED.feed_token,
    filters = COALESCE(public.portal_feeds.filters, '{}'::jsonb) || jsonb_build_object(
      'required_tags',
      jsonb_build_array('portal_cohort_alicante_50')
    ),
    notes = CASE
      WHEN coalesce(public.portal_feeds.notes, '') = '' THEN EXCLUDED.notes
      WHEN public.portal_feeds.notes ILIKE '%misma cohorte editorial que Kyero%' THEN public.portal_feeds.notes
      ELSE public.portal_feeds.notes || ' Publica la misma cohorte editorial que Kyero.'
    END,
    updated_at = now();
