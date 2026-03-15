
-- Allow channel creator to also see their channel (needed for INSERT...RETURNING)
DROP POLICY IF EXISTS "Members can view their channels" ON public.chat_channels;
CREATE POLICY "Members or creator can view channels"
  ON public.chat_channels
  FOR SELECT
  TO authenticated
  USING (
    is_channel_member(auth.uid(), id)
    OR created_by = auth.uid()
  );
