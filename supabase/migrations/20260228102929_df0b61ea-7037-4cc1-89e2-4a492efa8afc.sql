
-- Create storage bucket for contact backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-backups', 'contact-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins can read/write backups
CREATE POLICY "Admin read contact-backups"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contact-backups' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service insert contact-backups"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contact-backups');

CREATE POLICY "Service update contact-backups"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'contact-backups');

CREATE POLICY "Service delete contact-backups"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contact-backups');
