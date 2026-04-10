-- Migration: Drop unused indexes to reduce write IO budget consumption
-- IMPORTANT: This migration is intentionally conservative.
-- We only drop indexes that are clearly redundant based on schema analysis:
--   1. B-tree indexes superseded by trigram indexes on the same column
--
-- All other zero-scan indexes are either:
--   - Newly created (empty tables that will be populated)
--   - System-managed (auth/storage schemas)
--   - Functional features that will be used when the feature is exercised
--
-- Dropped indexes and their replacements:
-- ─────────────────────────────────────────────────────────────────────────────

-- idx_properties_zone is superseded by properties_zone_trgm_idx (584 kB)
-- which covers both equality and LIKE queries. The B-tree is redundant.
DROP INDEX IF EXISTS public.idx_properties_zone;

-- idx_properties_city is superseded by properties_city_trgm_idx (520 kB)
-- which covers both equality and LIKE queries. The B-tree is redundant.
DROP INDEX IF EXISTS public.idx_properties_city;
