-- Create storage bucket for property documents
INSERT INTO storage.buckets (id, name, public) VALUES ('property-documents', 'property-documents', true);

-- Allow authenticated users to upload documents
CREATE POLICY "Auth users can upload property documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

-- Allow authenticated users to view documents
CREATE POLICY "Auth users can view property documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their documents
CREATE POLICY "Auth users can delete property documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-documents' AND auth.role() = 'authenticated');
