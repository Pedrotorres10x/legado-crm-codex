
-- =============================================
-- 1. ADD key_location FIELD TO PROPERTIES
-- =============================================
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS key_location text DEFAULT 'oficina';
COMMENT ON COLUMN public.properties.key_location IS 'Where are the keys: oficina, propietario, inquilino, caja_seguridad, otro';

-- =============================================
-- 2. RESTRICT RLS ON CONTACTS
-- =============================================
-- Drop old permissive policies
DROP POLICY IF EXISTS "Auth view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Auth update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Auth insert contacts" ON public.contacts;

-- Agents see only their own contacts, admins see all
CREATE POLICY "Agent view own contacts" ON public.contacts
  FOR SELECT USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent update own contacts" ON public.contacts
  FOR UPDATE USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent insert contacts" ON public.contacts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 3. RESTRICT RLS ON PROPERTIES
-- =============================================
DROP POLICY IF EXISTS "Auth view properties" ON public.properties;
DROP POLICY IF EXISTS "Auth update properties" ON public.properties;
DROP POLICY IF EXISTS "Auth insert properties" ON public.properties;

CREATE POLICY "Agent view own properties" ON public.properties
  FOR SELECT USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent update own properties" ON public.properties
  FOR UPDATE USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent insert properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 4. RESTRICT RLS ON INTERACTIONS
-- =============================================
DROP POLICY IF EXISTS "Auth view interactions" ON public.interactions;
DROP POLICY IF EXISTS "Auth update interactions" ON public.interactions;
DROP POLICY IF EXISTS "Auth insert interactions" ON public.interactions;

CREATE POLICY "Agent view own interactions" ON public.interactions
  FOR SELECT USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent update own interactions" ON public.interactions
  FOR UPDATE USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent insert interactions" ON public.interactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 5. RESTRICT RLS ON VISITS
-- =============================================
DROP POLICY IF EXISTS "Auth view visits" ON public.visits;
DROP POLICY IF EXISTS "Auth update visits" ON public.visits;
DROP POLICY IF EXISTS "Auth insert visits" ON public.visits;

CREATE POLICY "Agent view own visits" ON public.visits
  FOR SELECT USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR (confirmation_token IS NOT NULL AND confirmation_token = confirmation_token));

CREATE POLICY "Agent update own visits" ON public.visits
  FOR UPDATE USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR (confirmation_token IS NOT NULL));

CREATE POLICY "Agent insert visits" ON public.visits
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Remove old public token policy (merged above)
DROP POLICY IF EXISTS "Public can view visit by confirmation token" ON public.visits;

-- =============================================
-- 6. RESTRICT RLS ON OFFERS
-- =============================================
DROP POLICY IF EXISTS "Auth view offers" ON public.offers;
DROP POLICY IF EXISTS "Auth update offers" ON public.offers;
DROP POLICY IF EXISTS "Auth insert offers" ON public.offers;

CREATE POLICY "Agent view own offers" ON public.offers
  FOR SELECT USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent update own offers" ON public.offers
  FOR UPDATE USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent insert offers" ON public.offers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 7. RESTRICT RLS ON MATCHES
-- =============================================
DROP POLICY IF EXISTS "Auth view matches" ON public.matches;
DROP POLICY IF EXISTS "Auth update matches" ON public.matches;
DROP POLICY IF EXISTS "Auth insert matches" ON public.matches;

CREATE POLICY "Agent view own matches" ON public.matches
  FOR SELECT USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent update own matches" ON public.matches
  FOR UPDATE USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent insert matches" ON public.matches
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 8. RESTRICT RLS ON CAPTACIONES
-- =============================================
DROP POLICY IF EXISTS "Auth view captaciones" ON public.captaciones;
DROP POLICY IF EXISTS "Auth update captaciones" ON public.captaciones;
DROP POLICY IF EXISTS "Auth insert captaciones" ON public.captaciones;

CREATE POLICY "Agent view own captaciones" ON public.captaciones
  FOR SELECT USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent update own captaciones" ON public.captaciones
  FOR UPDATE USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Agent insert captaciones" ON public.captaciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 9. RESTRICT RLS ON DEMANDS (via contact ownership)
-- =============================================
DROP POLICY IF EXISTS "Auth view demands" ON public.demands;
DROP POLICY IF EXISTS "Auth update demands" ON public.demands;
DROP POLICY IF EXISTS "Auth insert demands" ON public.demands;

CREATE POLICY "Agent view own demands" ON public.demands
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE contacts.id = demands.contact_id AND (contacts.agent_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Agent update own demands" ON public.demands
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.contacts WHERE contacts.id = demands.contact_id AND (contacts.agent_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Agent insert demands" ON public.demands
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- 10. FUNCTION TO FIND DUPLICATE CONTACTS
-- =============================================
CREATE OR REPLACE FUNCTION public.find_duplicate_contacts()
RETURNS TABLE(
  contact_id_1 uuid,
  contact_id_2 uuid,
  name_1 text,
  name_2 text,
  match_field text,
  match_value text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Phone duplicates
  SELECT c1.id, c2.id, c1.full_name, c2.full_name, 'phone', c1.phone
  FROM contacts c1
  JOIN contacts c2 ON c1.phone = c2.phone AND c1.id < c2.id
  WHERE c1.phone IS NOT NULL AND c1.phone <> ''
  UNION ALL
  -- Email duplicates
  SELECT c1.id, c2.id, c1.full_name, c2.full_name, 'email', c1.email
  FROM contacts c1
  JOIN contacts c2 ON lower(c1.email) = lower(c2.email) AND c1.id < c2.id
  WHERE c1.email IS NOT NULL AND c1.email <> ''
  UNION ALL
  -- Phone2 matches phone
  SELECT c1.id, c2.id, c1.full_name, c2.full_name, 'phone2', c1.phone2
  FROM contacts c1
  JOIN contacts c2 ON c1.phone2 = c2.phone AND c1.id <> c2.id
  WHERE c1.phone2 IS NOT NULL AND c1.phone2 <> '';
$$;
