-- Migration: Add indexes for unindexed foreign key columns
-- Without these, FK lookups and ON DELETE CASCADE operations require full
-- table scans, burning Disk IO on every related-row fetch.
-- All use IF NOT EXISTS — safe to re-run.
--
-- NOTE: captaciones, mls_incoming, idealista_mappings, idealista_contact_mappings
-- do not exist in this schema and are excluded.

-- ── matches ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matches_agent_id ON public.matches(agent_id);

-- ── tasks ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id  ON public.tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_property_id ON public.tasks(property_id);

-- ── commissions ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commissions_property_id ON public.commissions(property_id);

-- ── generated_contracts ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_generated_contracts_template_id ON public.generated_contracts(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_contracts_contact_id  ON public.generated_contracts(contact_id);
CREATE INDEX IF NOT EXISTS idx_generated_contracts_property_id ON public.generated_contracts(property_id);

-- ── contract_signers ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contract_signers_contract_id ON public.contract_signers(contract_id);

-- ── contact_invoices ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_contact_invoices_contact_id    ON public.contact_invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_invoices_property_id   ON public.contact_invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_contact_invoices_commission_id ON public.contact_invoices(commission_id);

-- ── match_emails ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_match_emails_demand_id ON public.match_emails(demand_id);
CREATE INDEX IF NOT EXISTS idx_match_emails_match_id  ON public.match_emails(match_id) WHERE match_id IS NOT NULL;

-- ── communication_logs ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_communication_logs_demand_id   ON public.communication_logs(demand_id) WHERE demand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communication_logs_property_id ON public.communication_logs(property_id) WHERE property_id IS NOT NULL;

-- ── property_owners ───────────────────────────────────────────────────────────
-- Note: The UNIQUE(property_id, contact_id) constraint creates a composite
-- index but it only supports lookups starting with property_id. We add a
-- dedicated contact_id index for reverse lookups (find all properties of a contact).
CREATE INDEX IF NOT EXISTS idx_property_owners_property_id ON public.property_owners(property_id);
CREATE INDEX IF NOT EXISTS idx_property_owners_contact_id  ON public.property_owners(contact_id);

-- ── portal_property_exclusions ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_prop_excl_portal_feed_id ON public.portal_property_exclusions(portal_feed_id);
CREATE INDEX IF NOT EXISTS idx_portal_prop_excl_property_id    ON public.portal_property_exclusions(property_id);

-- ── portal_leads ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portal_leads_contact_id  ON public.portal_leads(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portal_leads_property_id ON public.portal_leads(property_id) WHERE property_id IS NOT NULL;

-- ── media_access_logs ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_media_access_logs_property_id ON public.media_access_logs(property_id);

-- ── documents ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_documents_contract_id ON public.documents(contract_id) WHERE contract_id IS NOT NULL;

-- ── portal_feed_properties ────────────────────────────────────────────────────
-- portal_feed_id already has idx_portal_feed_properties_feed
CREATE INDEX IF NOT EXISTS idx_portal_feed_properties_property_id ON public.portal_feed_properties(property_id);

-- ── voice_campaign_contacts ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vcc_contact_id      ON public.voice_campaign_contacts(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vcc_handoff_task_id ON public.voice_campaign_contacts(handoff_task_id) WHERE handoff_task_id IS NOT NULL;

-- ── ai_interactions ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_interactions_prompt_version_id ON public.ai_interactions(prompt_version_id) WHERE prompt_version_id IS NOT NULL;
