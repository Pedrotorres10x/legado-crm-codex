
-- Fix profiles RLS: restrict visibility to own profile or admin/coordinadora
-- Remove the overly permissive "Users can view all profiles" policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a restricted policy: users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Admin and coordinadora can view all profiles (needed for team management)
CREATE POLICY "Admins coordinadoras can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coordinadora'::app_role)
);
