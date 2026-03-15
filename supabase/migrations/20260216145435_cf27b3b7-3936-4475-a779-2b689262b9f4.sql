
-- Create storage bucket for property media
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-media', 'property-media', true);

-- Allow authenticated users to upload files
CREATE POLICY "Auth users can upload property media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-media');

-- Allow public read access
CREATE POLICY "Public can view property media"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-media');

-- Allow authenticated users to update their uploads
CREATE POLICY "Auth users can update property media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'property-media');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Auth users can delete property media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'property-media');

-- Add virtual_tour column to properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS virtual_tour_url text;
