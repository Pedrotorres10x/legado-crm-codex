-- Add floor_plans column to store floor plan image URLs separately from photos
ALTER TABLE public.properties ADD COLUMN floor_plans text[] DEFAULT '{}'::text[];