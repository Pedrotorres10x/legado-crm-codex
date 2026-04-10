-- Migration: wrap auth.uid() and auth.role() in (select ...) across all RLS policies
-- This fixes 169 auth_rls_initplan advisor warnings.
-- PostgreSQL was re-evaluating auth.uid() for every row scanned instead of once per
-- query, causing excessive Disk IO. Wrapping in (select ...) makes it a stable
-- subquery evaluated once per statement.

-- Helper: apply replacement idempotently
-- Strategy: replace any existing (select auth.uid()) with placeholder, then replace
-- bare auth.uid() with (select auth.uid()), then restore (same for auth.role()).

-- ai_interactions
ALTER POLICY "Admin view ai_interactions" ON public."ai_interactions"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent view own ai_interactions" ON public."ai_interactions"
  USING ((agent_id = (select auth.uid())));

-- ai_knowledge_base
ALTER POLICY "Admin manage ai_knowledge_base" ON public."ai_knowledge_base"
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Auth view ai_knowledge_base" ON public."ai_knowledge_base"
  USING (((select auth.uid()) IS NOT NULL));

-- ai_memory
ALTER POLICY "Admin manage ai_memory" ON public."ai_memory"
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Auth view ai_memory" ON public."ai_memory"
  USING (((select auth.uid()) IS NOT NULL));

-- ai_prompt_versions
ALTER POLICY "Admin manage ai_prompt_versions" ON public."ai_prompt_versions"
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Auth view ai_prompt_versions" ON public."ai_prompt_versions"
  USING (((select auth.uid()) IS NOT NULL));

-- analytics_exclusions
ALTER POLICY "Admins can manage exclusions" ON public."analytics_exclusions"
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Auth users can view exclusions" ON public."analytics_exclusions"
  USING (((select auth.uid()) IS NOT NULL));

-- announcements
ALTER POLICY "Admin delete announcements" ON public."announcements"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin insert announcements" ON public."announcements"
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin update announcements" ON public."announcements"
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- app_config
ALTER POLICY "Admin manage app_config" ON public."app_config"
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- audit_log
ALTER POLICY "Admin coord view audit" ON public."audit_log"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- change_requests
ALTER POLICY "Admin coord update change_requests" ON public."change_requests"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Admin delete change_requests" ON public."change_requests"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agents insert own change_requests" ON public."change_requests"
  WITH CHECK (((select auth.uid()) = requested_by));

ALTER POLICY "Agents view own change_requests" ON public."change_requests"
  USING (((requested_by = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- chat_channel_members
ALTER POLICY "Channel creators and admins can insert members" ON public."chat_channel_members"
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR (( SELECT chat_channels.created_by
   FROM chat_channels
  WHERE (chat_channels.id = chat_channel_members.channel_id)) = (select auth.uid())) OR (( SELECT chat_channels.is_direct
   FROM chat_channels
  WHERE (chat_channels.id = chat_channel_members.channel_id)) = true)));

ALTER POLICY "Members can view channel members" ON public."chat_channel_members"
  USING (is_channel_member((select auth.uid()), channel_id));

ALTER POLICY "Users can update own membership" ON public."chat_channel_members"
  USING ((user_id = (select auth.uid())));

-- chat_channels
ALTER POLICY "Authenticated users can create channels" ON public."chat_channels"
  WITH CHECK (((select auth.uid()) = created_by));

ALTER POLICY "Members or creator can view channels" ON public."chat_channels"
  USING ((is_channel_member((select auth.uid()), id) OR (created_by = (select auth.uid()))));

-- chat_messages
ALTER POLICY "Members can send messages" ON public."chat_messages"
  WITH CHECK ((((select auth.uid()) = user_id) AND is_channel_member((select auth.uid()), channel_id)));

ALTER POLICY "Members can view channel messages" ON public."chat_messages"
  USING (is_channel_member((select auth.uid()), channel_id));

-- commissions
ALTER POLICY "Admin delete commissions" ON public."commissions"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin insert commissions" ON public."commissions"
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin update commissions" ON public."commissions"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agent view own commissions" ON public."commissions"
  USING (((agent_id = (select auth.uid())) OR (listing_agent_id = (select auth.uid())) OR (buying_agent_id = (select auth.uid())) OR (listing_field_agent_id = (select auth.uid())) OR (buying_field_agent_id = (select auth.uid())) OR (listing_origin_agent_id = (select auth.uid())) OR (buying_origin_agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- communication_logs
ALTER POLICY "Admin delete communication_logs" ON public."communication_logs"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agent view own communication_logs" ON public."communication_logs"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- contacts
ALTER POLICY "Admin delete contacts" ON public."contacts"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agent insert contacts" ON public."contacts"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Agent update own contacts" ON public."contacts"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent view own contacts" ON public."contacts"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- contract_signers
ALTER POLICY "Admin delete contract signers" ON public."contract_signers"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agent insert contract signers" ON public."contract_signers"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM generated_contracts gc
  WHERE ((gc.id = contract_signers.contract_id) AND ((gc.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role))))));

ALTER POLICY "Agent view own contract signers" ON public."contract_signers"
  USING ((EXISTS ( SELECT 1
   FROM generated_contracts gc
  WHERE ((gc.id = contract_signers.contract_id) AND ((gc.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))));

-- contract_templates
ALTER POLICY "Admin delete templates" ON public."contract_templates"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin insert templates" ON public."contract_templates"
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin update templates" ON public."contract_templates"
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- contracts
ALTER POLICY "agents_insert_contracts" ON public."contracts"
  WITH CHECK ((created_by = (select auth.uid())));

ALTER POLICY "agents_see_own_contracts" ON public."contracts"
  USING (((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'coordinadora'::app_role])))))));

ALTER POLICY "agents_update_own_contracts" ON public."contracts"
  USING (((created_by = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'coordinadora'::app_role])))))));

-- demands
ALTER POLICY "Admin delete demands" ON public."demands"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin delete demands_v2" ON public."demands"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agent delete own demands" ON public."demands"
  USING ((EXISTS ( SELECT 1
   FROM contacts
  WHERE ((contacts.id = demands.contact_id) AND (contacts.agent_id = (select auth.uid()))))));

ALTER POLICY "Agent insert demands" ON public."demands"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Agent update own demands" ON public."demands"
  USING (((EXISTS ( SELECT 1
   FROM contacts
  WHERE ((contacts.id = demands.contact_id) AND (contacts.agent_id = (select auth.uid()))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent view own demands" ON public."demands"
  USING (((EXISTS ( SELECT 1
   FROM contacts
  WHERE ((contacts.id = demands.contact_id) AND (contacts.agent_id = (select auth.uid()))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- document_contacts
ALTER POLICY "Agent admin coord delete document contacts" ON public."document_contacts"
  USING (((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = document_contacts.contact_id) AND ((c.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent admin coord insert document contacts" ON public."document_contacts"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = document_contacts.contact_id) AND ((c.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent admin coord view document contacts" ON public."document_contacts"
  USING (((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = document_contacts.contact_id) AND ((c.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- document_properties
ALTER POLICY "Agent admin coord delete document properties" ON public."document_properties"
  USING (((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = document_properties.property_id) AND ((p.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent admin coord insert document properties" ON public."document_properties"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = document_properties.property_id) AND ((p.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent admin coord view document properties" ON public."document_properties"
  USING (((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = document_properties.property_id) AND ((p.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- documents
ALTER POLICY "Agent admin coord delete documents" ON public."documents"
  USING (((uploaded_by = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role) OR (EXISTS ( SELECT 1
   FROM (document_contacts dc
     JOIN contacts c ON ((c.id = dc.contact_id)))
  WHERE ((dc.document_id = documents.id) AND (c.agent_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM (document_properties dp
     JOIN properties p ON ((p.id = dp.property_id)))
  WHERE ((dp.document_id = documents.id) AND (p.agent_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM generated_contracts gc
  WHERE ((gc.id = documents.contract_id) AND (gc.agent_id = (select auth.uid())))))));

ALTER POLICY "Agent admin coord insert documents" ON public."documents"
  WITH CHECK ((((uploaded_by = (select auth.uid())) OR (uploaded_by IS NULL) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)) AND ((contract_id IS NULL) OR (EXISTS ( SELECT 1
   FROM generated_contracts gc
  WHERE ((gc.id = documents.contract_id) AND ((gc.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))))));

ALTER POLICY "Agent admin coord update documents" ON public."documents"
  USING (((uploaded_by = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role) OR (EXISTS ( SELECT 1
   FROM (document_contacts dc
     JOIN contacts c ON ((c.id = dc.contact_id)))
  WHERE ((dc.document_id = documents.id) AND (c.agent_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM (document_properties dp
     JOIN properties p ON ((p.id = dp.property_id)))
  WHERE ((dp.document_id = documents.id) AND (p.agent_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM generated_contracts gc
  WHERE ((gc.id = documents.contract_id) AND (gc.agent_id = (select auth.uid())))))))
  WITH CHECK ((((uploaded_by = (select auth.uid())) OR (uploaded_by IS NULL) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)) AND ((contract_id IS NULL) OR (EXISTS ( SELECT 1
   FROM generated_contracts gc
  WHERE ((gc.id = documents.contract_id) AND ((gc.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))))));

ALTER POLICY "Agent admin coord view documents" ON public."documents"
  USING (((uploaded_by = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role) OR (EXISTS ( SELECT 1
   FROM (document_contacts dc
     JOIN contacts c ON ((c.id = dc.contact_id)))
  WHERE ((dc.document_id = documents.id) AND (c.agent_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM (document_properties dp
     JOIN properties p ON ((p.id = dp.property_id)))
  WHERE ((dp.document_id = documents.id) AND (p.agent_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM generated_contracts gc
  WHERE ((gc.id = documents.contract_id) AND (gc.agent_id = (select auth.uid())))))));

-- erp_sync_logs
ALTER POLICY "Admins can view erp sync logs" ON public."erp_sync_logs"
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- featured_cache
ALTER POLICY "Admin manage featured_cache" ON public."featured_cache"
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- generated_contracts
ALTER POLICY "Admin delete contracts" ON public."generated_contracts"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agent insert own contracts" ON public."generated_contracts"
  WITH CHECK (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));

ALTER POLICY "Agent update own contracts" ON public."generated_contracts"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent view own contracts" ON public."generated_contracts"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- interactions
ALTER POLICY "Agent insert interactions" ON public."interactions"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Agent update own interactions" ON public."interactions"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent view own interactions" ON public."interactions"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- internal_comments
ALTER POLICY "Admin delete any comment" ON public."internal_comments"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Auth delete own comments" ON public."internal_comments"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Auth insert own comments" ON public."internal_comments"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Auth view comments" ON public."internal_comments"
  USING (((select auth.uid()) IS NOT NULL));

-- linkinbio_events
ALTER POLICY "Admin coord view all events" ON public."linkinbio_events"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Admin delete events" ON public."linkinbio_events"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agents view own events" ON public."linkinbio_events"
  USING ((agent_id = (select auth.uid())));

-- match_emails
ALTER POLICY "Agent view own match_emails" ON public."match_emails"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- match_sender_logs
ALTER POLICY "Admin insert match_sender_logs" ON public."match_sender_logs"
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- matches
ALTER POLICY "Admin delete matches" ON public."matches"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agent insert matches" ON public."matches"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Agent update own matches" ON public."matches"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent view own matches" ON public."matches"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- media_access_logs
ALTER POLICY "Admin coord view media logs" ON public."media_access_logs"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Users can insert own media logs" ON public."media_access_logs"
  WITH CHECK (((select auth.uid()) = user_id));

-- notifications
ALTER POLICY "Admin coord update notifications" ON public."notifications"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Admin coord view notifications" ON public."notifications"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Admins can delete notifications" ON public."notifications"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agent update own notifications" ON public."notifications"
  USING ((agent_id = (select auth.uid())));

ALTER POLICY "Agent view own notifications" ON public."notifications"
  USING ((agent_id = (select auth.uid())));

-- offers
ALTER POLICY "Agent insert offers" ON public."offers"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Agent update own offers" ON public."offers"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent view own offers" ON public."offers"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- owner_reengagement
ALTER POLICY "Admin coord view reengagement" ON public."owner_reengagement"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Admin delete owner_reengagement" ON public."owner_reengagement"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin insert reengagement" ON public."owner_reengagement"
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- portal_feed_properties
ALTER POLICY "Admin can view portal_feed_properties" ON public."portal_feed_properties"
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- portal_feeds
ALTER POLICY "Admins manage portal feeds" ON public."portal_feeds"
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Auth users view portal feeds" ON public."portal_feeds"
  USING (((select auth.uid()) IS NOT NULL));

-- portal_leads
ALTER POLICY "Admin coord view portal_leads" ON public."portal_leads"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Admin delete portal_leads" ON public."portal_leads"
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- portal_property_exclusions
ALTER POLICY "Admins manage exclusions" ON public."portal_property_exclusions"
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Auth users view exclusions" ON public."portal_property_exclusions"
  USING (((select auth.uid()) IS NOT NULL));

-- portal_publication_status
ALTER POLICY "portal_pub_status_insert_update" ON public."portal_publication_status"
  USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'coordinadora'::app_role]))))));

ALTER POLICY "portal_pub_status_select" ON public."portal_publication_status"
  USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = portal_publication_status.property_id) AND ((p.agent_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM user_roles
          WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = ANY (ARRAY['admin'::app_role, 'coordinadora'::app_role]))))))))));

-- price_history
ALTER POLICY "View price history" ON public."price_history"
  USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = price_history.property_id) AND ((p.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))));

-- profiles
ALTER POLICY "Admins coordinadoras can view all profiles" ON public."profiles"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Users can insert own profile" ON public."profiles"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update own profile" ON public."profiles"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view own profile" ON public."profiles"
  USING (((select auth.uid()) = user_id));

-- properties
ALTER POLICY "Admin delete properties" ON public."properties"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Agent insert properties" ON public."properties"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Agent update own properties" ON public."properties"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agents view all properties" ON public."properties"
  USING (((select auth.uid()) IS NOT NULL));

-- property_documents
ALTER POLICY "Agent admin coord delete property documents" ON public."property_documents"
  USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_documents.property_id) AND ((p.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))));

ALTER POLICY "Agent admin coord insert property documents" ON public."property_documents"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_documents.property_id) AND ((p.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))));

ALTER POLICY "Agent admin coord update property documents" ON public."property_documents"
  USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_documents.property_id) AND ((p.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_documents.property_id) AND ((p.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))));

ALTER POLICY "Agent admin coord view property documents" ON public."property_documents"
  USING ((EXISTS ( SELECT 1
   FROM properties p
  WHERE ((p.id = property_documents.property_id) AND ((p.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))));

-- property_owners
ALTER POLICY "Admin can delete property_owners" ON public."property_owners"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Auth users can insert property_owners" ON public."property_owners"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Auth users can update property_owners" ON public."property_owners"
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Auth users can view property_owners" ON public."property_owners"
  USING (((select auth.uid()) IS NOT NULL));

-- property_source_identity
ALTER POLICY "Authenticated users can view property source identity" ON public."property_source_identity"
  USING (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Service role manages property source identity updates" ON public."property_source_identity"
  USING (((select auth.role()) = 'service_role'::text));

-- prospecting_sequences
ALTER POLICY "Admin delete sequences" ON public."prospecting_sequences"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agents insert own sequences" ON public."prospecting_sequences"
  WITH CHECK (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agents see own sequences" ON public."prospecting_sequences"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agents update own sequences" ON public."prospecting_sequences"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- satellite_config
ALTER POLICY "Admin delete satellite_config" ON public."satellite_config"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin insert satellite_config" ON public."satellite_config"
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admin update satellite_config" ON public."satellite_config"
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- settings
ALTER POLICY "Admin coord insert settings" ON public."settings"
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Admin coord update settings" ON public."settings"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)))
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Safe settings for authenticated" ON public."settings"
  USING (((key = ANY (ARRAY['agent_monthly_cost'::text, 'point_weights'::text, 'popular_features'::text, 'kpi_targets'::text, 'match_sender_enabled'::text])) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- suggestions
ALTER POLICY "Admins can delete suggestions" ON public."suggestions"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can view all suggestions" ON public."suggestions"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Users can insert own suggestions" ON public."suggestions"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can view own suggestions" ON public."suggestions"
  USING (((select auth.uid()) = user_id));

-- tasks
ALTER POLICY "Agents delete own tasks" ON public."tasks"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));

ALTER POLICY "Agents insert own tasks" ON public."tasks"
  WITH CHECK ((agent_id = (select auth.uid())));

ALTER POLICY "Agents update own tasks" ON public."tasks"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agents view own tasks" ON public."tasks"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- user_roles
ALTER POLICY "Admins can delete roles" ON public."user_roles"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can insert roles" ON public."user_roles"
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins can update roles" ON public."user_roles"
  USING (has_role((select auth.uid()), 'admin'::app_role));

ALTER POLICY "Admins coordinadoras can view all roles" ON public."user_roles"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Users can view own roles" ON public."user_roles"
  USING (((select auth.uid()) = user_id));

-- visits
ALTER POLICY "Agent insert visits" ON public."visits"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Agent update own visits" ON public."visits"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent view own visits" ON public."visits"
  USING (((agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- voice_call_runs
ALTER POLICY "Voice call runs admin/coordinadora insert" ON public."voice_call_runs"
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Voice call runs admin/coordinadora select" ON public."voice_call_runs"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Voice call runs admin/coordinadora update" ON public."voice_call_runs"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)))
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- voice_campaign_contacts
ALTER POLICY "Voice campaign contacts admin/coordinadora delete" ON public."voice_campaign_contacts"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Voice campaign contacts admin/coordinadora insert" ON public."voice_campaign_contacts"
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Voice campaign contacts admin/coordinadora select" ON public."voice_campaign_contacts"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Voice campaign contacts admin/coordinadora update" ON public."voice_campaign_contacts"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)))
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- voice_campaigns
ALTER POLICY "Voice campaigns admin/coordinadora insert" ON public."voice_campaigns"
  WITH CHECK ((((select auth.uid()) = created_by) AND (has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))));

ALTER POLICY "Voice campaigns admin/coordinadora select" ON public."voice_campaigns"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Voice campaigns admin/coordinadora update" ON public."voice_campaigns"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)))
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- voice_contact_flags
ALTER POLICY "Voice contact flags admin/coordinadora insert" ON public."voice_contact_flags"
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Voice contact flags admin/coordinadora select" ON public."voice_contact_flags"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Voice contact flags admin/coordinadora update" ON public."voice_contact_flags"
  USING ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)))
  WITH CHECK ((has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

-- web_pageviews
ALTER POLICY "Admins can read pageviews" ON public."web_pageviews"
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- xml_feeds
ALTER POLICY "Admins can manage feeds" ON public."xml_feeds"
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- contact_invoices
ALTER POLICY "Agent admin coord insert invoices" ON public."contact_invoices"
  WITH CHECK (((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_invoices.contact_id) AND ((c.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent admin coord update invoices" ON public."contact_invoices"
  USING (((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_invoices.contact_id) AND ((c.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_invoices.contact_id) AND ((c.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));

ALTER POLICY "Agent admin coord view invoices" ON public."contact_invoices"
  USING (((EXISTS ( SELECT 1
   FROM contacts c
  WHERE ((c.id = contact_invoices.contact_id) AND ((c.agent_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role))))) OR has_role((select auth.uid()), 'admin'::app_role) OR has_role((select auth.uid()), 'coordinadora'::app_role)));
