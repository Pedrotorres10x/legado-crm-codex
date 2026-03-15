-- Add 'arras' to property_status enum
ALTER TYPE public.property_status ADD VALUE IF NOT EXISTS 'arras' AFTER 'reservado';

-- Add 'no_disponible' to property_status enum  
ALTER TYPE public.property_status ADD VALUE IF NOT EXISTS 'no_disponible' AFTER 'retirado';