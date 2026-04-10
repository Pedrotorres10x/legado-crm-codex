-- Migration: Consolidate multiple permissive policies into single unified policies
-- Having N permissive policies on the same table/command causes PostgreSQL to
-- evaluate ALL of them per row and OR the results together — N times the work.
-- Each group below is replaced by one policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ai_interactions SELECT ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin view ai_interactions"  ON public.ai_interactions;
DROP POLICY IF EXISTS "Agent view own ai_interactions" ON public.ai_interactions;
CREATE POLICY "View ai_interactions" ON public.ai_interactions FOR SELECT
  USING (
    agent_id = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'coordinadora'::app_role)
  );

-- ── app_config SELECT — both policies are USING (true), drop the duplicate ───
DROP POLICY IF EXISTS "Service read app_config" ON public.app_config;

-- ── demands DELETE — drop duplicate admin policy, merge admin + agent ─────────
DROP POLICY IF EXISTS "Admin delete demands_v2"  ON public.demands;
DROP POLICY IF EXISTS "Admin delete demands"     ON public.demands;
DROP POLICY IF EXISTS "Agent delete own demands" ON public.demands;
CREATE POLICY "Delete demands" ON public.demands FOR DELETE
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = demands.contact_id
        AND contacts.agent_id = (SELECT auth.uid())
    )
  );

-- ── generated_contracts SELECT ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Agent view own contracts"                    ON public.generated_contracts;
DROP POLICY IF EXISTS "Public can view contract by signature token" ON public.generated_contracts;
CREATE POLICY "View generated_contracts" ON public.generated_contracts FOR SELECT
  USING (
    agent_id = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'coordinadora'::app_role)
    OR signature_token IS NOT NULL
  );

-- ── internal_comments DELETE ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin delete any comment"  ON public.internal_comments;
DROP POLICY IF EXISTS "Auth delete own comments"  ON public.internal_comments;
CREATE POLICY "Delete internal_comments" ON public.internal_comments FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
  );

-- ── linkinbio_events SELECT ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin coord view all events" ON public.linkinbio_events;
DROP POLICY IF EXISTS "Agents view own events"      ON public.linkinbio_events;
CREATE POLICY "View linkinbio_events" ON public.linkinbio_events FOR SELECT
  USING (
    agent_id = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'coordinadora'::app_role)
  );

-- ── notifications SELECT ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin coord view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Agent view own notifications"   ON public.notifications;
CREATE POLICY "View notifications" ON public.notifications FOR SELECT
  USING (
    agent_id = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'coordinadora'::app_role)
  );

-- ── notifications UPDATE ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin coord update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Agent update own notifications"   ON public.notifications;
CREATE POLICY "Update notifications" ON public.notifications FOR UPDATE
  USING (
    agent_id = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'coordinadora'::app_role)
  );

-- ── profiles SELECT ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins coordinadoras can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"                 ON public.profiles;
CREATE POLICY "View profiles" ON public.profiles FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'coordinadora'::app_role)
  );

-- ── properties SELECT ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Agents view all properties"        ON public.properties;
DROP POLICY IF EXISTS "Anon can view available properties" ON public.properties;
CREATE POLICY "View properties" ON public.properties FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL
    OR status = ANY (ARRAY['disponible'::property_status, 'reservado'::property_status])
  );

-- ── suggestions SELECT ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users can view own suggestions"  ON public.suggestions;
CREATE POLICY "View suggestions" ON public.suggestions FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
  );

-- ── user_roles SELECT ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins coordinadoras can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles"                ON public.user_roles;
CREATE POLICY "View user_roles" ON public.user_roles FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'coordinadora'::app_role)
  );
