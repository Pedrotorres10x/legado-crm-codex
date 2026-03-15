
-- Allow agents to view their own notifications
CREATE POLICY "Agent view own notifications"
ON public.notifications
FOR SELECT
USING (agent_id = auth.uid());

-- Allow agents to update (mark read) their own notifications
CREATE POLICY "Agent update own notifications"
ON public.notifications
FOR UPDATE
USING (agent_id = auth.uid());
