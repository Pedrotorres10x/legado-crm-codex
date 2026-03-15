import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AnomalyNotification = {
  id: string;
  description: string;
  created_at: string;
};

export const usePropertyDetailRelatedData = (propertyId?: string) => {
  const [propertyMatches, setPropertyMatches] = useState<any[]>([]);
  const [propertyVisits, setPropertyVisits] = useState<any[]>([]);
  const [ownerContact, setOwnerContact] = useState<any>(null);
  const [propertyOwners, setPropertyOwners] = useState<any[]>([]);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [propertyOffers, setPropertyOffers] = useState<any[]>([]);
  const [anomalyNotifications, setAnomalyNotifications] = useState<AnomalyNotification[]>([]);

  const fetchMatches = useCallback(async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from('matches')
      .select('*, demands(id, property_type, operation, min_price, max_price, cities, contact_id, contacts(full_name)), properties(title)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    setPropertyMatches(data || []);
  }, [propertyId]);

  const fetchVisits = useCallback(async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from('visits')
      .select('*, contacts(full_name)')
      .eq('property_id', propertyId)
      .order('visit_date', { ascending: false });
    setPropertyVisits(data || []);
  }, [propertyId]);

  const fetchAnomalyNotifications = useCallback(async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, description, created_at')
      .eq('entity_type', 'property')
      .eq('entity_id', propertyId)
      .eq('event_type', 'data_anomaly')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setAnomalyNotifications(data as AnomalyNotification[]);
  }, [propertyId]);

  const dismissAnomaly = useCallback(async (notificationId: string) => {
    await supabase.from('notifications').update({ is_read: true } as any).eq('id', notificationId);
    setAnomalyNotifications((current) => current.filter((notification) => notification.id !== notificationId));
  }, []);

  const fetchOwnerAndOffers = useCallback(async () => {
    if (!propertyId) return;

    const { data: property } = await supabase
      .from('properties')
      .select('owner_id, agent_id')
      .eq('id', propertyId)
      .single();

    const { data: owners } = await supabase
      .from('property_owners')
      .select('id, contact_id, role, ownership_pct, contacts(id, full_name, phone, email, contact_type)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true });
    setPropertyOwners((owners || []).map((owner: any) => ({ ...owner, contact: owner.contacts })));

    if (property?.owner_id) {
      const { data: owner } = await supabase
        .from('contacts')
        .select('id, full_name, phone, email, contact_type')
        .eq('id', property.owner_id)
        .single();
      setOwnerContact(owner);
    } else {
      setOwnerContact(null);
    }

    if (property?.agent_id) {
      const { data: agent } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone, email, avatar_url')
        .eq('user_id', property.agent_id)
        .single();
      setAgentProfile(agent);
    } else {
      setAgentProfile(null);
    }

    const { data: offers } = await supabase
      .from('offers')
      .select('*, contacts(id, full_name, phone, email, contact_type)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    setPropertyOffers(offers || []);
  }, [propertyId]);

  const refreshRelatedData = useCallback(async () => {
    await Promise.all([
      fetchMatches(),
      fetchVisits(),
      fetchOwnerAndOffers(),
      fetchAnomalyNotifications(),
    ]);
  }, [fetchAnomalyNotifications, fetchMatches, fetchOwnerAndOffers, fetchVisits]);

  useEffect(() => {
    refreshRelatedData();
  }, [refreshRelatedData]);

  return {
    propertyMatches,
    propertyVisits,
    ownerContact,
    propertyOwners,
    agentProfile,
    propertyOffers,
    anomalyNotifications,
    fetchMatches,
    fetchVisits,
    fetchOwnerAndOffers,
    fetchAnomalyNotifications,
    dismissAnomaly,
    refreshRelatedData,
  };
};
