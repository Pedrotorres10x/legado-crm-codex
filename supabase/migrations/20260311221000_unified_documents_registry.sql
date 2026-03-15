CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  title text NOT NULL,
  document_kind text NOT NULL DEFAULT 'other',
  source_context text NOT NULL DEFAULT 'general',
  notes text,
  mime_type text,
  size_bytes bigint,
  expires_at date,
  uploaded_by uuid,
  contract_id uuid REFERENCES public.generated_contracts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_bucket_storage_path_key UNIQUE (bucket_id, storage_path)
);

CREATE TABLE public.document_contacts (
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  link_role text NOT NULL DEFAULT 'related',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, contact_id)
);

CREATE TABLE public.document_properties (
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, property_id)
);

CREATE INDEX idx_documents_kind ON public.documents(document_kind);
CREATE INDEX idx_documents_expires_at ON public.documents(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_document_contacts_contact_id ON public.document_contacts(contact_id);
CREATE INDEX idx_document_properties_property_id ON public.document_properties(property_id);

CREATE TRIGGER set_updated_at_documents
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view documents"
  ON public.documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert documents"
  ON public.documents FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update documents"
  ON public.documents FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete documents"
  ON public.documents FOR DELETE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can view document contacts"
  ON public.document_contacts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert document contacts"
  ON public.document_contacts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete document contacts"
  ON public.document_contacts FOR DELETE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can view document properties"
  ON public.document_properties FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert document properties"
  ON public.document_properties FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete document properties"
  ON public.document_properties FOR DELETE
  TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public)
SELECT 'signature-documents', 'signature-documents', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'signature-documents'
);

CREATE POLICY "Auth users can upload signature documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'signature-documents');

CREATE POLICY "Auth users can view signature documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'signature-documents');

CREATE POLICY "Auth users can delete signature documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'signature-documents');
