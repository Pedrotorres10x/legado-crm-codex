ALTER TABLE commissions
  ADD COLUMN listing_origin_agent_id uuid,
  ADD COLUMN listing_field_agent_id uuid,
  ADD COLUMN buying_origin_agent_id uuid,
  ADD COLUMN buying_field_agent_id uuid,
  ADD COLUMN origin_pct numeric NOT NULL DEFAULT 30,
  ADD COLUMN field_pct numeric NOT NULL DEFAULT 70,
  ADD COLUMN listing_origin_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN listing_field_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN buying_origin_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN buying_field_amount numeric NOT NULL DEFAULT 0;