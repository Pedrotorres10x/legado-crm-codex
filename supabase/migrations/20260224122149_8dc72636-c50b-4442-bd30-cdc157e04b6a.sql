-- Add country column to properties table (default 'España' for existing data)
ALTER TABLE public.properties ADD COLUMN country text NOT NULL DEFAULT 'España';