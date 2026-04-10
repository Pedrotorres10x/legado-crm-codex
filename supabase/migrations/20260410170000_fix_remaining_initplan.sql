-- Migration: Fix remaining auth_rls_initplan on property_source_identity
-- The INSERT policy used auth.role() without (select ...) wrapper,
-- causing per-row re-evaluation instead of once per query.
ALTER POLICY "Service role manages property source identity inserts"
  ON public.property_source_identity
  WITH CHECK ((SELECT auth.role()) = 'service_role'::text);
