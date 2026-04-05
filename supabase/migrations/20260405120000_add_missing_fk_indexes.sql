-- Add missing indexes on foreign key columns used in frequent WHERE/JOIN operations.
-- These columns were identified as unindexed despite being core filter fields.

CREATE INDEX IF NOT EXISTS idx_contacts_agent_id       ON public.contacts(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_agent_id     ON public.properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_visits_contact_id       ON public.visits(contact_id);
CREATE INDEX IF NOT EXISTS idx_visits_agent_id         ON public.visits(agent_id);
CREATE INDEX IF NOT EXISTS idx_offers_contact_id       ON public.offers(contact_id);
CREATE INDEX IF NOT EXISTS idx_offers_agent_id         ON public.offers(agent_id);
CREATE INDEX IF NOT EXISTS idx_interactions_agent_id   ON public.interactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_matches_status          ON public.matches(status);
