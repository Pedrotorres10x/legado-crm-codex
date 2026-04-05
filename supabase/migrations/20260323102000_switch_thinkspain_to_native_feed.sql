UPDATE public.portal_feeds
SET
  format = 'thinkspain',
  notes = CASE
    WHEN coalesce(notes, '') = '' THEN 'Feed thinkSPAIN nativo v1.16 servido desde el CRM.'
    WHEN notes ILIKE '%thinkSPAIN nativo v1.16%' THEN notes
    ELSE notes || ' Feed thinkSPAIN nativo v1.16 servido desde el CRM.'
  END,
  updated_at = now()
WHERE portal_name = 'thinkspain';
