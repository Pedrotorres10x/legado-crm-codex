import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, isAfter, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const LINK_IN_BIO_RANGE_OPTIONS = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: 'all', label: 'Todo' },
];

export const LINK_IN_BIO_COLORS = [
  'hsl(25, 84%, 53%)',
  'hsl(200, 70%, 50%)',
  'hsl(150, 60%, 45%)',
  'hsl(280, 60%, 55%)',
  'hsl(340, 70%, 50%)',
  'hsl(45, 80%, 50%)',
];

export function formatLinkName(id: string): string {
  const names: Record<string, string> = {
    'quiz-situacion': '¿Pensando en Vender?',
    'guia-compraventa': 'Guía Compraventa',
    'guia-comprador': 'Guía Comprador',
    whatsapp: 'WhatsApp',
    'social-instagram': 'Instagram',
    'social-linkedin': 'LinkedIn',
    'social-facebook': 'Facebook',
  };
  return names[id] || id;
}

export function useLinkInBioStats() {
  const { user, canViewAll } = useAuth();
  const [range, setRange] = useState('30');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  const { data: agentProfile } = useQuery({
    queryKey: ['agent-profile-linkinbio', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, public_slug, avatar_url')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['linkinbio-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('linkinbio_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: webAttribution = [] } = useQuery({
    queryKey: ['linkinbio-web-attribution'],
    enabled: canViewAll,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('web_pageviews')
        .select('id, page, utm_content, utm_campaign, device, created_at, session_id, country')
        .eq('utm_source', 'linkinbio')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['linkinbio-agents'],
    enabled: canViewAll,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, public_slug');
      return (data || []).filter((profile) => profile.public_slug);
    },
  });

  const filtered = useMemo(() => {
    let result = events;
    if (range !== 'all') {
      const cutoff = startOfDay(subDays(new Date(), parseInt(range)));
      result = result.filter((event) => isAfter(new Date(event.created_at), cutoff));
    }
    if (selectedAgent === 'empresa') {
      result = result.filter((event) => event.agent_slug === 'empresa');
    } else if (selectedAgent !== 'all') {
      result = result.filter((event) => event.agent_id === selectedAgent);
    }
    return result;
  }, [events, range, selectedAgent]);

  const pageviews = filtered.filter((event) => event.event_type === 'pageview');
  const clicks = filtered.filter((event) => event.event_type === 'click');
  const uniqueSessions = new Set(pageviews.map((event) => event.session_id)).size;
  const ctr = pageviews.length > 0 ? ((clicks.length / pageviews.length) * 100).toFixed(1) : '0';

  const clicksByLink = useMemo(() => {
    const map: Record<string, number> = {};
    clicks.forEach((event) => {
      const key = event.link_id || 'unknown';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name: formatLinkName(name), value }))
      .sort((a, b) => b.value - a.value);
  }, [clicks]);

  const deviceData = useMemo(() => {
    const map: Record<string, number> = {};
    pageviews.forEach((event) => {
      const device = event.device || 'unknown';
      map[device] = (map[device] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [pageviews]);

  const dailyTrend = useMemo(() => {
    const days = range === 'all' ? 90 : parseInt(range);
    const map: Record<string, { views: number; clicks: number }> = {};
    for (let index = 0; index < days; index += 1) {
      const date = format(subDays(new Date(), index), 'yyyy-MM-dd');
      map[date] = { views: 0, clicks: 0 };
    }
    filtered.forEach((event) => {
      const date = format(new Date(event.created_at), 'yyyy-MM-dd');
      if (map[date]) {
        if (event.event_type === 'pageview') map[date].views += 1;
        else map[date].clicks += 1;
      }
    });
    return Object.entries(map)
      .map(([date, values]) => ({ date: format(new Date(date), 'dd MMM', { locale: es }), ...values }))
      .reverse();
  }, [filtered, range]);

  const referrers = useMemo(() => {
    const map: Record<string, number> = {};
    pageviews.forEach((event) => {
      if (!event.referrer) return;
      try {
        const host = new URL(event.referrer).hostname.replace('www.', '');
        map[host] = (map[host] || 0) + 1;
      } catch {
        // ignore bad referrers
      }
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [pageviews]);

  const utmSources = useMemo(() => {
    const map: Record<string, number> = {};
    pageviews.forEach((event) => {
      if (!event.utm_source) return;
      const key = `${event.utm_source}${event.utm_medium ? ` / ${event.utm_medium}` : ''}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [pageviews]);

  const byAgent = useMemo(() => {
    if (!canViewAll) return [];
    const map: Record<string, { views: number; clicks: number; slug: string }> = {};
    filtered.forEach((event) => {
      const key = event.agent_slug;
      if (!map[key]) map[key] = { views: 0, clicks: 0, slug: key };
      if (event.event_type === 'pageview') map[key].views += 1;
      else map[key].clicks += 1;
    });
    return Object.values(map).sort((a, b) => {
      if (a.slug === 'empresa') return -1;
      if (b.slug === 'empresa') return 1;
      return b.views - a.views;
    });
  }, [filtered, canViewAll]);

  const filteredWebAttribution = useMemo(() => {
    let result = webAttribution;
    if (range !== 'all') {
      const cutoff = startOfDay(subDays(new Date(), parseInt(range)));
      result = result.filter((event) => isAfter(new Date(event.created_at), cutoff));
    }
    return result;
  }, [webAttribution, range]);

  const webByAgent = useMemo(() => {
    const map: Record<string, { slug: string; views: number; sessions: Set<string>; pages: Record<string, number> }> = {};
    filteredWebAttribution.forEach((event) => {
      const slug = event.utm_content || 'desconocido';
      if (!map[slug]) map[slug] = { slug, views: 0, sessions: new Set(), pages: {} };
      map[slug].views += 1;
      map[slug].sessions.add(event.session_id);
      const page = event.page || '/';
      map[slug].pages[page] = (map[slug].pages[page] || 0) + 1;
    });
    return Object.values(map)
      .map((agent) => ({
        slug: agent.slug,
        views: agent.views,
        uniqueVisitors: agent.sessions.size,
        topPages: Object.entries(agent.pages).sort((a, b) => b[1] - a[1]).slice(0, 5),
      }))
      .sort((a, b) => b.views - a.views);
  }, [filteredWebAttribution]);

  const totalWebAttributed = filteredWebAttribution.length;
  const totalWebSessions = new Set(filteredWebAttribution.map((event) => event.session_id)).size;
  const recent = filtered.slice(0, 20);

  return {
    user,
    canViewAll,
    range,
    setRange,
    selectedAgent,
    setSelectedAgent,
    agentProfile,
    agents,
    isLoading,
    pageviews,
    clicks,
    uniqueSessions,
    ctr,
    clicksByLink,
    deviceData,
    dailyTrend,
    referrers,
    utmSources,
    byAgent,
    webByAgent,
    totalWebAttributed,
    totalWebSessions,
    recent,
  };
}
