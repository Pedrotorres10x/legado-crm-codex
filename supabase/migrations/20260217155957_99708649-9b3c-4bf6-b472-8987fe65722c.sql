
-- =============================================
-- HARDEN RLS: commissions
-- =============================================
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Auth insert commissions" ON commissions;
DROP POLICY IF EXISTS "Auth view commissions" ON commissions;

-- Agents can only view commissions where they participate (as agent, listing, buying, field, or origin)
CREATE POLICY "Agent view own commissions" ON commissions
FOR SELECT TO authenticated
USING (
  agent_id = auth.uid()
  OR listing_agent_id = auth.uid()
  OR buying_agent_id = auth.uid()
  OR listing_field_agent_id = auth.uid()
  OR buying_field_agent_id = auth.uid()
  OR listing_origin_agent_id = auth.uid()
  OR buying_origin_agent_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Only admins can create commissions
CREATE POLICY "Admin insert commissions" ON commissions
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- HARDEN RLS: contract_templates
-- =============================================
DROP POLICY IF EXISTS "Auth insert templates" ON contract_templates;
DROP POLICY IF EXISTS "Auth update templates" ON contract_templates;
DROP POLICY IF EXISTS "Auth view templates" ON contract_templates;

-- All authenticated can view templates (they're shared resources)
CREATE POLICY "Auth view templates" ON contract_templates
FOR SELECT TO authenticated
USING (true);

-- Only admins can create/update templates
CREATE POLICY "Admin insert templates" ON contract_templates
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update templates" ON contract_templates
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- HARDEN RLS: generated_contracts
-- =============================================
DROP POLICY IF EXISTS "Auth insert contracts" ON generated_contracts;
DROP POLICY IF EXISTS "Auth update contracts" ON generated_contracts;
DROP POLICY IF EXISTS "Auth view contracts" ON generated_contracts;

-- Agents see only their own contracts, admins see all
CREATE POLICY "Agent view own contracts" ON generated_contracts
FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Agents can create contracts assigned to themselves
CREATE POLICY "Agent insert own contracts" ON generated_contracts
FOR INSERT TO authenticated
WITH CHECK (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Agents can update only their own contracts, admins can update all
CREATE POLICY "Agent update own contracts" ON generated_contracts
FOR UPDATE TO authenticated
USING (agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- HARDEN RLS: owner_reengagement
-- =============================================
DROP POLICY IF EXISTS "Auth insert owner_reengagement" ON owner_reengagement;
DROP POLICY IF EXISTS "Auth view owner_reengagement" ON owner_reengagement;

-- Only admins can view reengagement logs (it's a system/admin feature)
CREATE POLICY "Admin view reengagement" ON owner_reengagement
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service/admin can insert (cron job inserts these)
CREATE POLICY "Admin insert reengagement" ON owner_reengagement
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- HARDEN RLS: match_sender_logs
-- =============================================
DROP POLICY IF EXISTS "Service insert match_sender_logs" ON match_sender_logs;

-- Only admins can insert logs (service role bypasses RLS anyway, this prevents agent abuse)
CREATE POLICY "Admin insert match_sender_logs" ON match_sender_logs
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
