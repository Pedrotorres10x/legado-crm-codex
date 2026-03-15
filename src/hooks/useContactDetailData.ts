import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useContactDetailData = (
  contactId?: string,
  options?: {
    viewerUserId?: string;
    canViewAll?: boolean;
  },
) => {
  const [contact, setContact] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [ownedProperties, setOwnedProperties] = useState<any[]>([]);
  const [demands, setDemands] = useState<any[]>([]);
  const [contactMatches, setContactMatches] = useState<any[]>([]);
  const [reengagementHistory, setReengagementHistory] = useState<any[]>([]);
  const [arrasBuyerProperties, setArrasBuyerProperties] = useState<any[]>([]);
  const [contactTasks, setContactTasks] = useState<any[]>([]);
  const [communicationLogs, setCommunicationLogs] = useState<any[]>([]);
  const [contactInvoices, setContactInvoices] = useState<any[]>([]);
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

    setContact(contactRes.data);
    setVisits(visitsRes.data || []);
    setOffers(offersRes.data || []);
    setInteractions(interactionsRes.data || []);
    setOwnedProperties(ownedRes.data || []);
    setDemands(demandsRes.data || []);

    const demandIds = (demandsRes.data || []).map((d: any) => d.id);
    if (demandIds.length > 0) {
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*, properties(id, title, address, price, status, images), demands(property_type, operation)')
        .in('demand_id', demandIds)
        .order('created_at', { ascending: false });
      setContactMatches(matchesData || []);
    } else {
      setContactMatches([]);
    }

    const [{ data: reengData }, { data: arrasProps }] = await Promise.all([
      supabase.from('owner_reengagement').select('*').eq('contact_id', contactId).order('sent_at', { ascending: false }),
      supabase.from('properties').select('id, title, address, price, status, images, arras_status, arras_date, arras_amount').eq('arras_buyer_id', contactId),
    ]);
    setReengagementHistory(reengData || []);
    setArrasBuyerProperties(arrasProps || []);

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, properties(title)')
      .eq('contact_id', contactId)
      .order('due_date', { ascending: false });
    setContactTasks(tasksData || []);

    const { data: commLogsData } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setCommunicationLogs(commLogsData || []);

    const { data: invoicesData } = await supabase
      .from('contact_invoices')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setContactInvoices(invoicesData || []);

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
