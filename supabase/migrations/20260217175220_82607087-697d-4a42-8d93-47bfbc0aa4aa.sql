
-- Add mandate/exclusivity fields to properties
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS mandate_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mandate_start date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mandate_end date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS mandate_notes text DEFAULT NULL;

-- mandate_type values: 'exclusiva', 'compartida', 'sin_mandato'
