-- Add public slug for agent cards
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS public_slug text UNIQUE;

-- Add agent bio and social links for the card
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS whatsapp text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS instagram_url text;

-- Generate initial slugs from existing names (simple version without unaccent)
UPDATE public.profiles
SET public_slug = lower(
  regexp_replace(
    regexp_replace(
      full_name,
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
)
WHERE full_name IS NOT NULL AND full_name <> '' AND public_slug IS NULL;

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_profiles_public_slug ON public.profiles (public_slug);
