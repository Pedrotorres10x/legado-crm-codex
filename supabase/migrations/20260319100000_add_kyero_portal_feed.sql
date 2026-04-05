INSERT INTO public.portal_feeds (
  portal_name,
  display_name,
  format,
  is_active,
  feed_token,
  notes
)
VALUES (
  'kyero',
  'Kyero',
  'kyero_v3',
  true,
  gen_random_uuid()::text,
  'Integrado desde el CRM el 2026-03-19. Publicacion via feed Kyero XML v3.'
)
ON CONFLICT (portal_name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    format = EXCLUDED.format,
    is_active = true,
    notes = COALESCE(NULLIF(public.portal_feeds.notes, ''), EXCLUDED.notes),
    updated_at = now();
