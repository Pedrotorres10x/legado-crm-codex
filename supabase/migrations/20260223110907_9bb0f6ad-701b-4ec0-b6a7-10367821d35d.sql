
-- Table to store invoice references generated from the CRM
CREATE TABLE public.contact_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  commission_id UUID REFERENCES public.commissions(id) ON DELETE SET NULL,
  agent_id UUID,
  invoice_number TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  concept TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'generada',
  faktura_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_invoices ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view invoices
CREATE POLICY "Authenticated users can view invoices"
  ON public.contact_invoices FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can create invoices
CREATE POLICY "Authenticated users can create invoices"
  ON public.contact_invoices FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update invoices
CREATE POLICY "Authenticated users can update invoices"
  ON public.contact_invoices FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_contact_invoices_updated_at
  BEFORE UPDATE ON public.contact_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
