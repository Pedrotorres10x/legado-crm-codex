
-- Property documents table for Horus methodology compliance
CREATE TABLE public.property_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  label text NOT NULL,
  file_url text,
  file_name text,
  notes text,
  expires_at date,
  is_required boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_property_documents_property ON public.property_documents(property_id);
CREATE INDEX idx_property_documents_expiry ON public.property_documents(expires_at) WHERE expires_at IS NOT NULL;

-- Auto-update timestamp
CREATE TRIGGER set_updated_at_property_documents
  BEFORE UPDATE ON public.property_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view property documents"
  ON public.property_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert property documents"
  ON public.property_documents FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update property documents"
  ON public.property_documents FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete property documents"
  ON public.property_documents FOR DELETE
  TO authenticated USING (true);

-- Enable realtime for expiry notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.property_documents;
