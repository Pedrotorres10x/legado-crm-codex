-- Migration: Add remaining unindexed FK columns flagged by Supabase advisor
-- Covers: chat_messages, contracts, interactions, offers, properties,
--         property_source_identity, tasks, visits

-- ── chat_messages ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON public.chat_messages(channel_id);

-- ── contracts ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contracts_possession_confirmed_by ON public.contracts(possession_confirmed_by) WHERE possession_confirmed_by IS NOT NULL;

-- ── interactions ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_interactions_property_id ON public.interactions(property_id) WHERE property_id IS NOT NULL;

-- ── offers ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_offers_property_id ON public.offers(property_id);

-- ── properties ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_properties_arras_buyer_id ON public.properties(arras_buyer_id) WHERE arras_buyer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties(owner_id) WHERE owner_id IS NOT NULL;

-- ── property_source_identity ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_property_source_identity_source_feed_id ON public.property_source_identity(source_feed_id) WHERE source_feed_id IS NOT NULL;

-- ── tasks ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent_id ON public.tasks(recurrence_parent_id) WHERE recurrence_parent_id IS NOT NULL;

-- ── visits ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_visits_property_id ON public.visits(property_id);
