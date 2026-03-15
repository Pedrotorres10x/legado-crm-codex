
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS id_number text,
ADD COLUMN IF NOT EXISTS email text;
