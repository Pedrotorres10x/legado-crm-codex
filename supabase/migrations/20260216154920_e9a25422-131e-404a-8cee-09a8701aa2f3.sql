
-- Contract templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'otro',
  content TEXT NOT NULL DEFAULT '',
  placeholders TEXT[] DEFAULT '{}',
  agent_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view templates" ON public.contract_templates FOR SELECT USING (true);
CREATE POLICY "Auth insert templates" ON public.contract_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update templates" ON public.contract_templates FOR UPDATE USING (true);
CREATE POLICY "Admin delete templates" ON public.contract_templates FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generated contracts table
CREATE TABLE public.generated_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.contract_templates(id),
  contact_id UUID REFERENCES public.contacts(id),
  property_id UUID REFERENCES public.properties(id),
  content TEXT NOT NULL,
  agent_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view contracts" ON public.generated_contracts FOR SELECT USING (true);
CREATE POLICY "Auth insert contracts" ON public.generated_contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update contracts" ON public.generated_contracts FOR UPDATE USING (true);
CREATE POLICY "Admin delete contracts" ON public.generated_contracts FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
