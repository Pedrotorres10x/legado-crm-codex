-- Allow anonymous (anon key) users to SELECT properties that are publicly visible
-- This enables satellites like Legado to query properties directly via supabase-js
CREATE POLICY "Anon can view available properties"
ON public.properties
FOR SELECT
TO anon
USING (status IN ('disponible', 'reservado'));

-- Allow anonymous users to read mls_listings (for MLS frontend)
CREATE POLICY "Anon can view mls_listings"
ON public.mls_listings
FOR SELECT
TO anon
USING (status = 'published');

-- Allow anon to read profiles (agent info for public pages)
CREATE POLICY "Anon can view profiles"
ON public.profiles
FOR SELECT
TO anon
USING (true);
