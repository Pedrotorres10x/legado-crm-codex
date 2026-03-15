
-- Add urgency and financing fields to demands table
ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS urgency_months integer NULL,
  ADD COLUMN IF NOT EXISTS financing_type text NULL DEFAULT 'indistinto',
  ADD COLUMN IF NOT EXISTS max_mortgage_payment numeric NULL,
  ADD COLUMN IF NOT EXISTS preferred_orientation text[] NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS floor_preference text NULL;
