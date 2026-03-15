-- Harden visit access: public confirmations must go through the confirm-visit
-- edge function, not through broad authenticated RLS exceptions.

DROP POLICY IF EXISTS "Public can view visit by confirmation token" ON public.visits;
DROP POLICY IF EXISTS "Agent view own visits" ON public.visits;
DROP POLICY IF EXISTS "Agent update own visits" ON public.visits;

CREATE POLICY "Agent view own visits" ON public.visits
  FOR SELECT TO authenticated
  USING (
    agent_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordinadora'::app_role)
  );

CREATE POLICY "Agent update own visits" ON public.visits
  FOR UPDATE TO authenticated
  USING (
    agent_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordinadora'::app_role)
  );
