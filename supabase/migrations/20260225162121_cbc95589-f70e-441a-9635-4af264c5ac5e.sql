
-- Fix: allow any authenticated user to create channels (public or direct)
DROP POLICY IF EXISTS "Admins can create public channels" ON public.chat_channels;
CREATE POLICY "Authenticated users can create channels"
  ON public.chat_channels
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Fix: allow channel creator to add members (not just admins)
DROP POLICY IF EXISTS "Admins can insert members" ON public.chat_channel_members;
CREATE POLICY "Channel creators and admins can insert members"
  ON public.chat_channel_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (SELECT created_by FROM chat_channels WHERE id = channel_id) = auth.uid()
    OR (SELECT is_direct FROM chat_channels WHERE id = channel_id) = true
  );
