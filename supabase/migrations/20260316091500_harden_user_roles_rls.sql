-- Restrict user_roles visibility: users only need their own roles,
-- while admin/coordinadora may inspect the full team map.

DROP POLICY IF EXISTS "Users can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins coordinadoras can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordinadora'::app_role)
  );
