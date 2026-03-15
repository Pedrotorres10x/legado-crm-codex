
-- Create media_access_logs table for audit trail
CREATE TABLE public.media_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'view_gallery', 'open_lightbox'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_access_logs ENABLE ROW LEVEL SECURITY;

-- Admins can see all logs
CREATE POLICY "Admins can view all media logs"
ON public.media_access_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can insert their own log
CREATE POLICY "Users can insert own media logs"
ON public.media_access_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Index for admin queries
CREATE INDEX idx_media_access_logs_created ON public.media_access_logs(created_at DESC);
CREATE INDEX idx_media_access_logs_user ON public.media_access_logs(user_id, created_at DESC);

-- Update storage policies for property-media bucket
-- Remove existing permissive policies and create restrictive ones
-- First drop existing policies on storage.objects for property-media
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname LIKE '%property-media%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Anyone authenticated can VIEW files in property-media
CREATE POLICY "Authenticated users can view property-media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'property-media');

-- Public can also view (bucket is public)
CREATE POLICY "Public can view property-media"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'property-media');

-- Only admins can upload to property-media
CREATE POLICY "Only admins can upload property-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-media' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can update property-media
CREATE POLICY "Only admins can update property-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'property-media' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can delete from property-media
CREATE POLICY "Only admins can delete property-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'property-media' AND public.has_role(auth.uid(), 'admin'));
