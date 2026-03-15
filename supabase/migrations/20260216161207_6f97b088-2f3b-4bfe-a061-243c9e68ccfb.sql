ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS portal_token text UNIQUE;