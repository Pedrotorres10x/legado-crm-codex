import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ContactDetailRow = {
  id: string;
  agent_id?: string | null;
};

type PropertyCardRow = {
  id: string;
  title: string | null;
  address?: string | null;
  price?: number | null;
  status?: string | null;
  images?: string[] | null;
};

type VisitDetailRow = {
  id: string;
  visit_date: string;
  properties?: PropertyCardRow | null;
};

type OfferDetailRow = {
  id: string;
  created_at: string;
  properties?: PropertyCardRow | null;
};

type InteractionDetailRow = {
  id: string;
  interaction_date: string;
  properties?: { title: string | null } | null;
};

type DemandDetailRow = {
  id: string;
  created_at: string;
};

type MatchDetailRow = {
  id: string;
  properties?: PropertyCardRow | null;
  demands?: { property_type?: string | null; operation?: string | null } | null;
};

type OwnerReengagementRow = {
  id: string;
  sent_at: string;
};

type ArrasBuyerPropertyRow = PropertyCardRow & {
  arras_status?: string | null;
  arras_date?: string | null;
  arras_amount?: number | null;
};

type TaskDetailRow = {
  id: string;
  due_date: string;
  properties?: { title: string | null } | null;
};

type CommunicationLogRow = {
  id: string;
  created_at: string;
};

type ContactInvoiceRow = {
  id: string;
  created_at: string;
};

export const useContactDetailData = (
  contactId?: string,
  options?: {
    viewerUserId?: string;
    canViewAll?: boolean;
  },
) => {
  const [contact, setContact] = useState<ContactDetailRow | null>(null);
  const [visits, setVisits] = useState<VisitDetailRow[]>([]);
  const [offers, setOffers] = useState<OfferDetailRow[]>([]);
  const [interactions, setInteractions] = useState<InteractionDetailRow[]>([]);
  const [ownedProperties, setOwnedProperties] = useState<PropertyCardRow[]>([]);
  const [demands, setDemands] = useState<DemandDetailRow[]>([]);
  const [contactMatches, setContactMatches] = useState<MatchDetailRow[]>([]);
  const [reengagementHistory, setReengagementHistory] = useState<OwnerReengagementRow[]>([]);
  const [arrasBuyerProperties, setArrasBuyerProperties] = useState<ArrasBuyerPropertyRow[]>([]);
  const [contactTasks, setContactTasks] = useState<TaskDetailRow[]>([]);
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLogRow[]>([]);
  const [contactInvoices, setContactInvoices] = useState<ContactInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!contactId) return;

    setLoading(true);

    let contactQuery = supabase.from('contacts').select('*').eq('id', contactId);
    if (!options?.canViewAll && options?.viewerUserId) {
      contactQuery = contactQuery.eq('agent_id', options.viewerUserId);
    }

    const contactRes = await contactQuery.maybeSingle();

    if (!contactRes.data) {
      setContact(null);
      setVisits([]);
      setOffers([]);
      setInteractions([]);
      setOwnedProperties([]);
      setDemands([]);
      setContactMatches([]);
      setReengagementHistory([]);
      setArrasBuyerProperties([]);
      setContactTasks([]);
      setCommunicationLogs([]);
      setContactInvoices([]);
      setLoading(false);
      return;
    }

    const [visitsRes, offersRes, interactionsRes, ownedRes, demandsRes] = await Promise.all([
      supabase.from('visits').select('*, properties(id, title, address, price, status, images)').eq('contact_id', contactId).order('visit_date', { ascending: false }),
      supabase.from('offers').select('*, properties(id, title, address, price, status, images)').eq('contact_id', contactId).order('created_at', { ascending: false }),
      supabase.from('interactions').select('*, properties(title)').eq('contact_id', contactId).order('interaction_date', { ascending: false }),
      supabase.from('properties').select('id, title, address, price, status, images').eq('owner_id', contactId),
      supabase.from('demands').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }),
    ]);

    setContact((contactRes.data || null) as ContactDetailRow | null);
    setVisits((visitsRes.data || []) as VisitDetailRow[]);
    setOffers((offersRes.data || []) as OfferDetailRow[]);
    setInteractions((interactionsRes.data || []) as InteractionDetailRow[]);
    setOwnedProperties((ownedRes.data || []) as PropertyCardRow[]);
    setDemands((demandsRes.data || []) as DemandDetailRow[]);

    const demandIds = ((demandsRes.data || []) as DemandDetailRow[]).map((demand) => demand.id);
    if (demandIds.length > 0) {
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*, properties(id, title, address, price, status, images), demands(property_type, operation)')
        .in('demand_id', demandIds)
        .order('created_at', { ascending: false });
      setContactMatches((matchesData || []) as MatchDetailRow[]);
    } else {
      setContactMatches([]);
    }

    const [{ data: reengData }, { data: arrasProps }] = await Promise.all([
      supabase.from('owner_reengagement').select('*').eq('contact_id', contactId).order('sent_at', { ascending: false }),
      supabase.from('properties').select('id, title, address, price, status, images, arras_status, arras_date, arras_amount').eq('arras_buyer_id', contactId),
    ]);
    setReengagementHistory((reengData || []) as OwnerReengagementRow[]);
    setArrasBuyerProperties((arrasProps || []) as ArrasBuyerPropertyRow[]);

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, properties(title)')
      .eq('contact_id', contactId)
      .order('due_date', { ascending: false });
    setContactTasks((tasksData || []) as TaskDetailRow[]);

    const { data: commLogsData } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setCommunicationLogs((commLogsData || []) as CommunicationLogRow[]);

    const { data: invoicesData } = await supabase
      .from('contact_invoices')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setContactInvoices((invoicesData || []) as ContactInvoiceRow[]);

    setLoading(false);
  }, [contactId, options?.canViewAll, options?.viewerUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    contact,
    setContact,
    visits,
    setVisits,
    offers,
    interactions,
    ownedProperties,
    demands,
    setDemands,
    contactMatches,
    reengagementHistory,
    arrasBuyerProperties,
    contactTasks,
    communicationLogs,
    contactInvoices,
    loading,
    loadData,
  };
};
