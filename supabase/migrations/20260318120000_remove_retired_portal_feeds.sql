-- Remove retired portal feeds that should no longer appear in CRM.

DELETE FROM public.portal_property_exclusions
WHERE portal_feed_id IN (
  SELECT id
  FROM public.portal_feeds
  WHERE lower(coalesce(portal_name, '')) IN ('idealista', 'pisos', 'todopisos', '1001portales')
     OR lower(coalesce(display_name, '')) IN ('idealista', 'pisos.com', 'todopisos', '1001 portales')
     OR lower(coalesce(format, '')) IN ('idealista', 'pisos', 'todopisos')
);

DELETE FROM public.portal_feed_properties
WHERE portal_feed_id IN (
  SELECT id
  FROM public.portal_feeds
  WHERE lower(coalesce(portal_name, '')) IN ('idealista', 'pisos', 'todopisos', '1001portales')
     OR lower(coalesce(display_name, '')) IN ('idealista', 'pisos.com', 'todopisos', '1001 portales')
     OR lower(coalesce(format, '')) IN ('idealista', 'pisos', 'todopisos')
);

DELETE FROM public.portal_feeds
WHERE lower(coalesce(portal_name, '')) IN ('idealista', 'pisos', 'todopisos', '1001portales')
   OR lower(coalesce(display_name, '')) IN ('idealista', 'pisos.com', 'todopisos', '1001 portales')
   OR lower(coalesce(format, '')) IN ('idealista', 'pisos', 'todopisos');
