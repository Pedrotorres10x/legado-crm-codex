
-- Add purchase_date to contacts (date of property purchase/sale closing)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS purchase_date date;

-- Table to track reengagement messages sent to propietarios
CREATE TABLE public.owner_reengagement (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  message_type text NOT NULL, -- 'cumpleanos', 'navidad', 'semana_santa', 'verano', 'aniversario_venta', 'renta'
  year integer NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'whatsapp', -- 'whatsapp', 'email'
  message_preview text,
  UNIQUE(contact_id, message_type, year)
);

ALTER TABLE public.owner_reengagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view owner_reengagement" ON public.owner_reengagement FOR SELECT USING (true);
CREATE POLICY "Auth insert owner_reengagement" ON public.owner_reengagement FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin delete owner_reengagement" ON public.owner_reengagement FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
