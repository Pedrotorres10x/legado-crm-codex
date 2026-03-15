
-- CONTACTS
DROP POLICY IF EXISTS "Agent view own contacts" ON contacts;
CREATE POLICY "Agent view own contacts" ON contacts FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Agent update own contacts" ON contacts;
CREATE POLICY "Agent update own contacts" ON contacts FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- PROPERTIES
DROP POLICY IF EXISTS "Agent view own properties" ON properties;
CREATE POLICY "Agent view own properties" ON properties FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Agent update own properties" ON properties;
CREATE POLICY "Agent update own properties" ON properties FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- INTERACTIONS
DROP POLICY IF EXISTS "Agent view own interactions" ON interactions;
CREATE POLICY "Agent view own interactions" ON interactions FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Agent update own interactions" ON interactions;
CREATE POLICY "Agent update own interactions" ON interactions FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- VISITS
DROP POLICY IF EXISTS "Agent view own visits" ON visits;
CREATE POLICY "Agent view own visits" ON visits FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role) OR (confirmation_token IS NOT NULL AND confirmation_token = confirmation_token));

DROP POLICY IF EXISTS "Agent update own visits" ON visits;
CREATE POLICY "Agent update own visits" ON visits FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role) OR confirmation_token IS NOT NULL);

-- OFFERS
DROP POLICY IF EXISTS "Agent view own offers" ON offers;
CREATE POLICY "Agent view own offers" ON offers FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Agent update own offers" ON offers;
CREATE POLICY "Agent update own offers" ON offers FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- MATCHES
DROP POLICY IF EXISTS "Agent view own matches" ON matches;
CREATE POLICY "Agent view own matches" ON matches FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Agent update own matches" ON matches;
CREATE POLICY "Agent update own matches" ON matches FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- CAPTACIONES
DROP POLICY IF EXISTS "Agent view own captaciones" ON captaciones;
CREATE POLICY "Agent view own captaciones" ON captaciones FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Agent update own captaciones" ON captaciones;
CREATE POLICY "Agent update own captaciones" ON captaciones FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- DEMANDS
DROP POLICY IF EXISTS "Agent view own demands" ON demands;
CREATE POLICY "Agent view own demands" ON demands FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = demands.contact_id AND contacts.agent_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Agent update own demands" ON demands;
CREATE POLICY "Agent update own demands" ON demands FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = demands.contact_id AND contacts.agent_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- COMMISSIONS
DROP POLICY IF EXISTS "Agent view own commissions" ON commissions;
CREATE POLICY "Agent view own commissions" ON commissions FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR listing_agent_id = auth.uid() OR buying_agent_id = auth.uid()
  OR listing_field_agent_id = auth.uid() OR buying_field_agent_id = auth.uid()
  OR listing_origin_agent_id = auth.uid() OR buying_origin_agent_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- GENERATED CONTRACTS
DROP POLICY IF EXISTS "Agent view own contracts" ON generated_contracts;
CREATE POLICY "Agent view own contracts" ON generated_contracts FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Agent update own contracts" ON generated_contracts;
CREATE POLICY "Agent update own contracts" ON generated_contracts FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- TASKS
DROP POLICY IF EXISTS "Agents view own tasks" ON tasks;
CREATE POLICY "Agents view own tasks" ON tasks FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Agents update own tasks" ON tasks;
CREATE POLICY "Agents update own tasks" ON tasks FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Admins can view notifications" ON notifications;
CREATE POLICY "Admin coord view notifications" ON notifications FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

DROP POLICY IF EXISTS "Admins can update notifications" ON notifications;
CREATE POLICY "Admin coord update notifications" ON notifications FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- OWNER REENGAGEMENT
DROP POLICY IF EXISTS "Admin view reengagement" ON owner_reengagement;
DROP POLICY IF EXISTS "Admin coord view reengagement" ON owner_reengagement;
CREATE POLICY "Admin coord view reengagement" ON owner_reengagement FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

-- MEDIA ACCESS LOGS
DROP POLICY IF EXISTS "Admins can view all media logs" ON media_access_logs;
DROP POLICY IF EXISTS "Admin coord view media logs" ON media_access_logs;
CREATE POLICY "Admin coord view media logs" ON media_access_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));
