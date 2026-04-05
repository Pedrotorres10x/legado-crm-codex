UPDATE public.portal_feeds
SET
  feed_token = '7a6b6fb9-0b6f-4b9a-98d3-4a8d31f61c52',
  updated_at = now(),
  notes = CASE
    WHEN coalesce(notes, '') = '' THEN 'Feed token Kyero rotado el 2026-03-19 para validacion inicial.'
    WHEN notes ILIKE '%Feed token Kyero rotado el 2026-03-19%' THEN notes
    ELSE notes || ' Feed token Kyero rotado el 2026-03-19 para validacion inicial.'
  END
WHERE portal_name = 'kyero';
