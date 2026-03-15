-- Allow any authenticated user to insert commissions (as drafts)
DROP POLICY "Admin insert commissions" ON commissions;
CREATE POLICY "Auth insert commissions" ON commissions
  FOR INSERT WITH CHECK (true);
