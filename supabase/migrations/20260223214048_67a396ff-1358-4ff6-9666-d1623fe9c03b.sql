
-- Make property-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'property-documents';

-- Make imports bucket private
UPDATE storage.buckets SET public = false WHERE id = 'imports';

-- Drop the overly permissive public read policy on imports
DROP POLICY IF EXISTS "Public read imports" ON storage.objects;

-- Replace with auth-only read for imports (admin only)
CREATE POLICY "Admin can read imports"
ON storage.objects FOR SELECT
USING (bucket_id = 'imports' AND has_role(auth.uid(), 'admin'::app_role));
