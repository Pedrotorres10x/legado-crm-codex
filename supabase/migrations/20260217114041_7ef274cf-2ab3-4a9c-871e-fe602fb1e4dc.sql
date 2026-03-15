-- Add owner price and commission columns to properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_price numeric DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS commission numeric DEFAULT NULL;