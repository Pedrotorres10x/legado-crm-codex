-- Reactivate the publication gateways that replace the old CRM.
-- We keep existing tokens, filters and credentials when present.

INSERT INTO public.portal_feeds (
  portal_name,
  display_name,
  format,
  is_active,
  feed_token,
  notes
)
VALUES
  (
    'fotocasa',
    'Fotocasa',
    'fotocasa',
    true,
    gen_random_uuid()::text,
    'Migrado del CRM legacy el 2026-03-18. La publicacion se gestiona desde este CRM.'
  ),
  (
    'pisos',
    'Pisos.com',
    'pisos',
    true,
    gen_random_uuid()::text,
    'Migrado del CRM legacy el 2026-03-18. La publicacion se gestiona desde este CRM.'
  ),
  (
    'todopisos',
    'TodoPisos',
    'todopisos',
    true,
    gen_random_uuid()::text,
    'Migrado del CRM legacy el 2026-03-18. La publicacion se gestiona desde este CRM.'
  ),
  (
    '1001portales',
    '1001 Portales',
    'kyero_v3',
    true,
    gen_random_uuid()::text,
    'Migrado del CRM legacy el 2026-03-18. La publicacion se gestiona desde este CRM.'
  )
ON CONFLICT (portal_name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    format = EXCLUDED.format,
    is_active = true,
    notes = COALESCE(NULLIF(public.portal_feeds.notes, ''), EXCLUDED.notes),
    updated_at = now();
