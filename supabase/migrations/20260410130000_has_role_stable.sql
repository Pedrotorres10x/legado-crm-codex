-- Migration: Confirm has_role() is STABLE (no-op if already correct)
-- has_role() was already created as STABLE in the initial migration
-- (20260216142514). This migration explicitly re-applies the marking to
-- ensure it is set even if the function was recreated without the keyword.
--
-- STABLE allows PostgreSQL to cache the result for the duration of a
-- single statement instead of re-evaluating per row, which significantly
-- reduces Disk IO when used in RLS policies.

ALTER FUNCTION public.has_role(uuid, public.app_role) STABLE;
