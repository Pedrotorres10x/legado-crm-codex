
-- Remove Mitula, Nestoria, SpainHouses, Trovit
DELETE FROM portal_feeds WHERE portal_name IN ('mitula', 'nestoria', 'spainhouses', 'trovit');

-- Add 1001 Portales
INSERT INTO portal_feeds (portal_name, display_name, is_active, format, feed_token)
VALUES ('1001portales', '1001 Portales', false, 'kyero_v3', gen_random_uuid()::text)
ON CONFLICT DO NOTHING;
