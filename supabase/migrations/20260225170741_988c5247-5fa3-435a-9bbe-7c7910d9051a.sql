ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS arras_date date,
  ADD COLUMN IF NOT EXISTS arras_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS arras_status text NOT NULL DEFAULT 'sin_arras',
  ADD COLUMN IF NOT EXISTS arras_buyer_id uuid REFERENCES public.contacts(id);