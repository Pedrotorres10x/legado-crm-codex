
-- Create portal_leads table for tracking leads from real estate portals
CREATE TABLE public.portal_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_name text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  raw_email_subject text,
  raw_email_from text,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'nuevo',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_leads ENABLE ROW LEVEL SECURITY;

-- Admins and coordinadoras can read
CREATE POLICY "Admin coord view portal_leads"
ON public.portal_leads FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- Service role inserts (from edge function)
CREATE POLICY "System insert portal_leads"
ON public.portal_leads FOR INSERT
WITH CHECK (true);

-- Admin can delete
CREATE POLICY "Admin delete portal_leads"
ON public.portal_leads FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for portal stats queries
CREATE INDEX idx_portal_leads_portal_name ON public.portal_leads(portal_name);
CREATE INDEX idx_portal_leads_created_at ON public.portal_leads(created_at);
