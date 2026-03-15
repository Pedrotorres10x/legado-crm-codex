-- Add full-text search column and index to properties table
-- Using Spanish language configuration for better tokenization

-- 1. Add a generated tsvector column that combines all text fields
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(city, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(zone, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(address, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(description, '')), 'D')
  ) STORED;

-- 2. Create a GIN index on the generated column for fast full-text queries
CREATE INDEX IF NOT EXISTS properties_search_vector_idx
  ON public.properties USING GIN (search_vector);

-- 3. Also add a GIN index for trigram similarity (for ilike queries)
-- This requires the pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS properties_title_trgm_idx
  ON public.properties USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS properties_description_trgm_idx
  ON public.properties USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS properties_city_trgm_idx
  ON public.properties USING GIN (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS properties_zone_trgm_idx
  ON public.properties USING GIN (zone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS properties_address_trgm_idx
  ON public.properties USING GIN (address gin_trgm_ops);

-- 4. Add trigram indexes on contacts for the improved classic search
CREATE INDEX IF NOT EXISTS contacts_full_name_trgm_idx
  ON public.contacts USING GIN (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS contacts_phone_trgm_idx
  ON public.contacts USING GIN (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS contacts_city_trgm_idx
  ON public.contacts USING GIN (city gin_trgm_ops);