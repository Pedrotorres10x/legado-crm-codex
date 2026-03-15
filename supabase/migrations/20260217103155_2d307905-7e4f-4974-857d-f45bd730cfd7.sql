-- Add property_types array column to support multiple property types per demand
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS property_types text[] DEFAULT '{}'::text[];

-- Migrate existing single property_type values into the new array column
UPDATE public.demands 
SET property_types = ARRAY[property_type::text] 
WHERE property_type IS NOT NULL AND (property_types IS NULL OR property_types = '{}');