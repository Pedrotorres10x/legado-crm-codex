import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AnomalyNotification = {
  id: string;
  description: string;
  created_at: string;
};

type PropertyMatchRow = {
  id: string;
};

type PropertyVisitRow = {
  id: string;
  contacts?: { full_name: string } | null;
};

type PropertyOwnerContact = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  contact_type: string | null;
};

type PropertyOwnerRow = {
  id: string;
  contact_id: string;
  role: string | null;
  ownership_pct: number | null;
  contacts?: PropertyOwnerContact | null;
  contact?: PropertyOwnerContact | null;
};

type AgentProfileRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
};

type PropertyOfferRow = {
  id: string;
  contacts?: PropertyOwnerContact | null;
};

export const usePropertyDetailRelatedData = (propertyId?: string) => {
  const [propertyMatches, setPropertyMatches] = useState<PropertyMatchRow[]>([]);
  const [propertyVisits, setPropertyVisits] = useState<PropertyVisitRow[]>([]);
  const [ownerContact, setOwnerContact] = useState<PropertyOwnerContact | null>(null);
  const [propertyOwners, setPropertyOwners] = useState<PropertyOwnerRow[]>([]);
  const [agentProfile, setAgentProfile] = useState<AgentProfileRow | null>(null);
  const [propertyOffers, setPropertyOffers] = useState<PropertyOfferRow[]>([]);
  const [anomalyNotifications, setAnomalyNotifications] = useState<AnomalyNotification[]>([]);

  const fetchMatches = useCallback(async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from('matches')
      .select('*, demands(id, property_type, operation, min_price, max_price, cities, contact_id, contacts(full_name)), properties(title)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    setPropertyMatches((data || []) as PropertyMatchRow[]);
  }, [propertyId]);

  const fetchVisits = useCallback(async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from('visits')
      .select('*, contacts(full_name)')
      .eq('property_id', propertyId)
      .order('visit_date', { ascending: false });
    setPropertyVisits((data || []) as PropertyVisitRow[]);
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
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
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
    setPropertyOwners(((owners || []) as PropertyOwnerRow[]).map((owner) => ({ ...owner, contact: owner.contacts })));

    if (property?.owner_id) {
      const { data: owner } = await supabase
        .from('contacts')
        .select('id, full_name, phone, email, contact_type')
        .eq('id', property.owner_id)
        .single();
      setOwnerContact((owner || null) as PropertyOwnerContact | null);
    } else {
      setOwnerContact(null);
    }

    if (property?.agent_id) {
      const { data: agent } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, phone, email, avatar_url')
        .eq('user_id', property.agent_id)
        .single();
      setAgentProfile((agent || null) as AgentProfileRow | null);
    } else {
      setAgentProfile(null);
    }

    const { data: offers } = await supabase
      .from('offers')
      .select('*, contacts(id, full_name, phone, email, contact_type)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    setPropertyOffers((offers || []) as PropertyOfferRow[]);
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
