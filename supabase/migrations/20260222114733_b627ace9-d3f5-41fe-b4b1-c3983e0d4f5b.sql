
-- 1. Fix find_duplicate_contacts: add admin/coordinadora permission check
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
  WITH authorized AS (
    SELECT has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role) AS is_authorized
  )
  SELECT * FROM (
    -- Phone duplicates
    SELECT c1.id, c2.id, c1.full_name, c2.full_name, 'phone'::text, c1.phone
    FROM contacts c1
    JOIN contacts c2 ON c1.phone = c2.phone AND c1.id < c2.id
    WHERE c1.phone IS NOT NULL AND c1.phone <> ''
    UNION ALL
    -- Email duplicates
    SELECT c1.id, c2.id, c1.full_name, c2.full_name, 'email'::text, c1.email
    FROM contacts c1
    JOIN contacts c2 ON lower(c1.email) = lower(c2.email) AND c1.id < c2.id
    WHERE c1.email IS NOT NULL AND c1.email <> ''
    UNION ALL
    -- Phone2 matches phone
    SELECT c1.id, c2.id, c1.full_name, c2.full_name, 'phone2'::text, c1.phone2
    FROM contacts c1
    JOIN contacts c2 ON c1.phone2 = c2.phone AND c1.id <> c2.id
    WHERE c1.phone2 IS NOT NULL AND c1.phone2 <> ''
  ) AS dups
  WHERE (SELECT is_authorized FROM authorized);
$$;

-- 2. Fix contract_signers: drop the permissive UPDATE policy (edge function uses service role)
DROP POLICY IF EXISTS "System update contract signers" ON public.contract_signers;

-- 3. Fix profiles: drop anon access (public-agent-card uses service role)
DROP POLICY IF EXISTS "Anon can view profiles" ON public.profiles;

-- 4. Fix web_pageviews: restrict to admin only
DROP POLICY IF EXISTS "Admins can read pageviews" ON public.web_pageviews;
CREATE POLICY "Admins can read pageviews"
ON public.web_pageviews FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
