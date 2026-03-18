-- Keep only Idealista removed. Restore the other portal feeds used by CRM.

DELETE FROM public.portal_feeds
WHERE lower(coalesce(portal_name, '')) = 'idealista'
   OR lower(coalesce(display_name, '')) = 'idealista'
   OR lower(coalesce(format, '')) = 'idealista';

INSERT INTO public.portal_feeds (portal_name, display_name, is_active, format, feed_token)
VALUES ('pisos', 'Pisos.com', false, 'pisos', gen_random_uuid()::text)
ON CONFLICT (portal_name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    format = EXCLUDED.format;

INSERT INTO public.portal_feeds (portal_name, display_name, is_active, format, feed_token)
VALUES ('todopisos', 'TodoPisos', false, 'todopisos', gen_random_uuid()::text)
ON CONFLICT (portal_name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    format = EXCLUDED.format;

INSERT INTO public.portal_feeds (portal_name, display_name, is_active, format, feed_token)
VALUES ('1001portales', '1001 Portales', false, 'kyero_v3', gen_random_uuid()::text)
ON CONFLICT (portal_name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    format = EXCLUDED.format;
