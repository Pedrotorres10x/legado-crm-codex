
-- Add explicit zone field to properties
ALTER TABLE public.properties ADD COLUMN zone text;

-- Create index for matching performance
CREATE INDEX idx_properties_zone ON public.properties(zone);
