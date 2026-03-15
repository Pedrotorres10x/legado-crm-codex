import { useEffect, useState } from 'react';
import { startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getSemesterRange } from '@/lib/commissions';
import { getAgentKpiSummary, getAgentKpiTargets } from '@/lib/agent-kpis';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

const EMPTY_EDIT_FORM = {
  full_name: '',
  phone: '',
  address: '',
  id_number: '',
  email: '',
  bio: '',
  whatsapp: '',
  linkedin_url: '',
  instagram_url: '',
  facebook_url: '',
};

export const useProfileData = ({
  userId,
  toast,
}: {
  userId?: string;
  toast: ToastFn;
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stats, setStats] = useState({
    properties: 0,
    available: 0,
    sold: 0,
    reserved: 0,
    contacts: 0,
    demands: 0,
    matches: 0,
    matchesSent: 0,
    visits: 0,
    visitsThisMonth: 0,
    captaciones: 0,
    captacionesActivas: 0,
    offers: 0,
    offersAccepted: 0,
    interactions: 0,
  });
  const [kpis, setKpis] = useState({ ventasMes: 0, ventasAno: 0, captacionesMes: 0, citasSemana: 0, toquesHorusHoy: 0 });
  const [kpiTargets, setKpiTargets] = useState({
    ventas_ano: 10,
    captaciones_mes: 2,
    citas_semana: 2,
    toques_horus_dia: 4,
  });
  const [commissions, setCommissions] = useState({ semester: 0, month: 0, count: 0, originatedAccumulated: 0 });
  const [semesterLabel, setSemesterLabel] = useState('');

  const loadAll = async () => {
    if (!userId) return;

    const monthStart = startOfMonth(new Date()).toISOString();
    const semester = getSemesterRange();
    setSemesterLabel(semester.label);

    const [
      profileRes,
      propsRes,
      contactsRes,
      demandsRes,
      matchesRes,
      visitsRes,
      offersRes,
      interactionsRes,
      commRes,
      commMonthRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('properties').select('id, status').eq('agent_id', userId),
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('agent_id', userId),
      supabase.from('demands').select('id', { count: 'exact', head: true }),
      supabase.from('matches').select('id, status').eq('agent_id', userId),
      supabase.from('visits').select('id, visit_date').eq('agent_id', userId),
      supabase.from('offers').select('id, status').eq('agent_id', userId),
      supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('agent_id', userId),
      supabase
        .from('commissions')
        .select('agent_total, agency_commission, listing_origin_agent_id, buying_origin_agent_id')
        .in('status', ['aprobado', 'pagado'])
        .gte('created_at', semester.start.toISOString()),
      supabase
        .from('commissions')
        .select('agent_total')
        .eq('agent_id', userId)
        .in('status', ['aprobado', 'pagado'])
        .gte('created_at', monthStart),
    ]);

    const profileData = profileRes.data;
    setProfile(profileData);
    setEditForm({
      full_name: profileData?.full_name || '',
      phone: profileData?.phone || '',
      address: profileData?.address || '',
      id_number: profileData?.id_number || '',
      email: profileData?.email || '',
      bio: profileData?.bio || '',
      whatsapp: profileData?.whatsapp || '',
      linkedin_url: profileData?.linkedin_url || '',
      instagram_url: profileData?.instagram_url || '',
      facebook_url: profileData?.facebook_url || '',
    });

    const resolvedTargets = await getAgentKpiTargets();
    setKpiTargets(resolvedTargets);

    const propertiesData = propsRes.data || [];
    const matchesData = matchesRes.data || [];
    const visitsData = visitsRes.data || [];
    const offersData = offersRes.data || [];

    setStats({
      properties: propertiesData.length,
      available: propertiesData.filter((property) => property.status === 'disponible').length,
      sold: propertiesData.filter((property) => property.status === 'vendido').length,
      reserved: propertiesData.filter((property) => property.status === 'reservado' || property.status === 'arras').length,
      contacts: contactsRes.count ?? 0,
      demands: demandsRes.count ?? 0,
      matches: matchesData.length,
      matchesSent: matchesData.filter((match) => match.status === 'enviado' || match.status === 'interesado').length,
      visits: visitsData.length,
      visitsThisMonth: visitsData.filter((visit) => visit.visit_date >= monthStart).length,
      captaciones: 0,
      captacionesActivas: 0,
      offers: offersData.length,
      offersAccepted: offersData.filter((offer) => offer.status === 'aceptada').length,
      interactions: interactionsRes.count ?? 0,
    });

    const summary = await getAgentKpiSummary(userId, resolvedTargets);
    setKpis({
      ventasMes: summary.ventasMes,
      ventasAno: summary.ventasAno,
      captacionesMes: summary.captacionesMes,
      citasSemana: summary.citasSemana,
      toquesHorusHoy: summary.toquesHorusHoy,
    });

    const commissionsData = (commRes.data as any[]) || [];
    const semesterTotal = commissionsData.reduce((sum: number, row: any) => sum + (row.agent_total || 0), 0);
    const originatedAccumulated = commissionsData
      .filter((row: any) => row.listing_origin_agent_id === userId || row.buying_origin_agent_id === userId)
      .reduce((sum: number, row: any) => sum + (row.agency_commission || 0), 0);
    const monthTotal = ((commMonthRes.data as any[]) || []).reduce((sum: number, row: any) => sum + (row.agent_total || 0), 0);

    setCommissions({
      semester: semesterTotal,
      month: monthTotal,
      count: commissionsData.length,
      originatedAccumulated,
    });
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    loadAll();
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return false;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ ...editForm } as any)
      .eq('user_id', userId);
    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
      return false;
    }

    toast({ title: 'Perfil actualizado' });
    await loadAll();
    return true;
  };

  const handleAvatarUpload = async (file: File) => {
    if (!userId) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: avatarUrl } as any).eq('user_id', userId);
      setProfile((current: any) => ({ ...current, avatar_url: avatarUrl }));
      toast({ title: 'Foto actualizada' });
    } catch (error: any) {
      toast({ title: 'Error al subir foto', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return {
    profile,
    setProfile,
    editForm,
    setEditForm,
    saving,
    loading,
    uploadingAvatar,
    stats,
    kpis,
    kpiTargets,
    commissions,
    semesterLabel,
    loadAll,
    handleSave,
    handleAvatarUpload,
  };
};
