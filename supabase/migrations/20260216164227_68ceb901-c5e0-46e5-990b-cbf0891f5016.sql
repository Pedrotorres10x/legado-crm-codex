ALTER TABLE commissions
  ADD COLUMN listing_agent_id uuid,
  ADD COLUMN buying_agent_id uuid,
  ADD COLUMN listing_pct numeric NOT NULL DEFAULT 60,
  ADD COLUMN buying_pct numeric NOT NULL DEFAULT 40,
  ADD COLUMN listing_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN buying_amount numeric NOT NULL DEFAULT 0;