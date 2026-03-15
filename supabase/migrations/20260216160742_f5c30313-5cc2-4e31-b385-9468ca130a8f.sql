-- Add confirmation fields to visits table
ALTER TABLE public.visits 
ADD COLUMN IF NOT EXISTS confirmation_token text UNIQUE,
ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS confirmation_ip text,
ADD COLUMN IF NOT EXISTS confirmation_user_agent text;

-- RLS: allow public access to visits by confirmation token (for the public confirmation page)
CREATE POLICY "Public can view visit by confirmation token"
ON public.visits
FOR SELECT
USING (confirmation_token IS NOT NULL AND confirmation_token = confirmation_token);

-- Allow public update of confirmation fields via edge function (service role will be used)
