
INSERT INTO storage.buckets (id, name, public) 
VALUES ('imports', 'imports', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read imports" ON storage.objects
FOR SELECT USING (bucket_id = 'imports');

CREATE POLICY "Service role insert imports" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'imports');
