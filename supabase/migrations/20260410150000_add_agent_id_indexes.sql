-- Migration: Add agent_id indexes on tables missing them
-- agent_id is the primary RLS filter for row-level security policies
-- (agent_id = auth.uid()). Without an index, every SELECT forces a
-- full sequential scan for multi-row tables.
-- All indexes use IF NOT EXISTS — safe to re-run.
-- The 20260405120000 migration already covered:
--   contacts, properties, visits, offers, interactions (agent_id)
--
-- NOTE: captaciones does not exist in this schema.

-- ── tasks ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON public.tasks(agent_id);

-- ── commissions ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commissions_agent_id ON public.commissions(agent_id);

-- ── communication_logs ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_communication_logs_agent_id ON public.communication_logs(agent_id) WHERE agent_id IS NOT NULL;

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_agent_id ON public.notifications(agent_id) WHERE agent_id IS NOT NULL;

-- ── match_emails ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_match_emails_agent_id ON public.match_emails(agent_id) WHERE agent_id IS NOT NULL;

-- ── contact_invoices ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contact_invoices_agent_id ON public.contact_invoices(agent_id) WHERE agent_id IS NOT NULL;

-- ── prospecting_sequences ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prospecting_sequences_agent_id ON public.prospecting_sequences(agent_id) WHERE agent_id IS NOT NULL;

-- ── matches ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matches_agent_id ON public.matches(agent_id) WHERE agent_id IS NOT NULL;

-- ── contract_templates ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contract_templates_agent_id ON public.contract_templates(agent_id) WHERE agent_id IS NOT NULL;

-- ── generated_contracts ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_generated_contracts_agent_id ON public.generated_contracts(agent_id) WHERE agent_id IS NOT NULL;

-- ── ai_interactions ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_interactions_agent_id ON public.ai_interactions(agent_id) WHERE agent_id IS NOT NULL;

-- ── xml_feeds ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_xml_feeds_agent_id ON public.xml_feeds(agent_id) WHERE agent_id IS NOT NULL;

-- ── voice_campaigns (created_by acts as agent FK) ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_voice_campaigns_created_by ON public.voice_campaigns(created_by);
