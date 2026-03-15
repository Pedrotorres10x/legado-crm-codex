
-- Add sale_date to contacts (date when owner sold their property through us)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS sale_date date;
