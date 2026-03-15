-- Allow authenticated users to delete demands (admin only for safety)
CREATE POLICY "Admin delete demands_v2"
ON public.demands
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also allow the agent who owns the contact to delete
CREATE POLICY "Agent delete own demands"
ON public.demands
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contacts
    WHERE contacts.id = demands.contact_id
    AND contacts.agent_id = auth.uid()
  )
);