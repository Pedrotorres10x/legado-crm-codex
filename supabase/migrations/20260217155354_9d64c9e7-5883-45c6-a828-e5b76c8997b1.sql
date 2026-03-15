
-- Store image ordering and labels as JSONB array
-- Each element: { "name": "filename.jpg", "label": "Salón principal", "source": "storage"|"xml" }
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS image_order jsonb DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.properties.image_order IS 'Ordered array of image metadata with labels for each photo';
