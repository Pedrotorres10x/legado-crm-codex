-- Migration: Split ALL-command admin policies into explicit per-command policies
-- An ALL policy covers SELECT/INSERT/UPDATE/DELETE. When a separate SELECT
-- policy also exists, PostgreSQL evaluates BOTH for every SELECT — double work.
-- Fix: replace ALL with explicit INSERT/UPDATE/DELETE, leaving SELECT to the
-- existing SELECT-only policy (or merging where needed).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ai_knowledge_base ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin manage ai_knowledge_base" ON public.ai_knowledge_base;
CREATE POLICY "Admin insert ai_knowledge_base" ON public.ai_knowledge_base FOR INSERT
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin update ai_knowledge_base" ON public.ai_knowledge_base FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin delete ai_knowledge_base" ON public.ai_knowledge_base FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ── ai_memory ─────────────────────────────────────────────────────────────────
-- System INSERT/UPDATE (true) already cover those commands; admin only needs DELETE
DROP POLICY IF EXISTS "Admin manage ai_memory" ON public.ai_memory;
CREATE POLICY "Admin delete ai_memory" ON public.ai_memory FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ── ai_prompt_versions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin manage ai_prompt_versions" ON public.ai_prompt_versions;
CREATE POLICY "Admin delete ai_prompt_versions" ON public.ai_prompt_versions FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ── featured_cache ────────────────────────────────────────────────────────────
-- System INSERT/UPDATE (true) cover those commands; SELECT (true) covers everyone
DROP POLICY IF EXISTS "Admin manage featured_cache" ON public.featured_cache;
CREATE POLICY "Admin delete featured_cache" ON public.featured_cache FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ── analytics_exclusions ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage exclusions" ON public.analytics_exclusions;
CREATE POLICY "Admin insert analytics_exclusions" ON public.analytics_exclusions FOR INSERT
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin update analytics_exclusions" ON public.analytics_exclusions FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin delete analytics_exclusions" ON public.analytics_exclusions FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ── portal_feeds ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage portal feeds" ON public.portal_feeds;
CREATE POLICY "Admin insert portal_feeds" ON public.portal_feeds FOR INSERT
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin update portal_feeds" ON public.portal_feeds FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin delete portal_feeds" ON public.portal_feeds FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ── portal_property_exclusions ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins manage exclusions" ON public.portal_property_exclusions;
CREATE POLICY "Admin insert portal_property_exclusions" ON public.portal_property_exclusions FOR INSERT
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin update portal_property_exclusions" ON public.portal_property_exclusions FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin delete portal_property_exclusions" ON public.portal_property_exclusions FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ── portal_publication_status ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "portal_pub_status_insert_update" ON public.portal_publication_status;
CREATE POLICY "Admin coord insert portal_pub_status" ON public.portal_publication_status FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'coordinadora'::app_role])
  ));
CREATE POLICY "Admin coord update portal_pub_status" ON public.portal_publication_status FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'coordinadora'::app_role])
  ));
CREATE POLICY "Admin coord delete portal_pub_status" ON public.portal_publication_status FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'coordinadora'::app_role])
  ));

-- ── app_config ────────────────────────────────────────────────────────────────
-- SELECT (true) covers everyone including admin
DROP POLICY IF EXISTS "Admin manage app_config" ON public.app_config;
CREATE POLICY "Admin insert app_config" ON public.app_config FOR INSERT
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin update app_config" ON public.app_config FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin delete app_config" ON public.app_config FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));

-- ── xml_feeds ─────────────────────────────────────────────────────────────────
-- SELECT (true) covers everyone
DROP POLICY IF EXISTS "Admins can manage feeds" ON public.xml_feeds;
CREATE POLICY "Admin insert xml_feeds" ON public.xml_feeds FOR INSERT
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin update xml_feeds" ON public.xml_feeds FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admin delete xml_feeds" ON public.xml_feeds FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role));
