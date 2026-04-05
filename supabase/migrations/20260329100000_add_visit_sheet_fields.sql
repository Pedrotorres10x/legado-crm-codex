ALTER TABLE public.visits
ADD COLUMN IF NOT EXISTS visitor_declared_name text,
ADD COLUMN IF NOT EXISTS visitor_declared_dni text,
ADD COLUMN IF NOT EXISTS visitor_declaration_acknowledged_at timestamptz,
ADD COLUMN IF NOT EXISTS visit_sheet_channel text CHECK (visit_sheet_channel IN ('whatsapp', 'email')),
ADD COLUMN IF NOT EXISTS visit_sheet_sent_at timestamptz;
