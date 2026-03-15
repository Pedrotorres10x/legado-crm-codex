-- Add new contact types for closed transactions
ALTER TYPE public.contact_type ADD VALUE IF NOT EXISTS 'comprador_cerrado';
ALTER TYPE public.contact_type ADD VALUE IF NOT EXISTS 'vendedor_cerrado';