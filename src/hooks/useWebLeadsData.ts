import { useQuery } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export const TRACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-track`;

export const RANGE_OPTIONS = [
  { label: 'Hoy', days: 0 },
  { label: 'Ayer', days: -1 },
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
] as const;

export type WebLeadsRange = -1 | 0 | 7 | 30 | 90;

export type Pageview = {
  id: string;
  session_id: string;
  page: string;
  referrer: string | null;
  device: string | null;
  country: string | null;
  created_at: string;
  user_agent: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

export type WebLead = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  agent_id: string | null;
  status: string;
  pipeline_stage: string | null;
  created_at: string;
  tags: string[];
  linked_property: {
    id: string;
    title: string | null;
    reference: string | null;
  } | null;
  lead_source: 'web' | 'portal' | 'fb';
  web_origin: 'legadocoleccion' | 'alicanteconnectnews' | null;
  web_origin_label: string | null;
  portal_name: string | null;
  open_task_count: number;
  total_task_count: number;
  visit_count: number;
  offer_count: number;
  last_interaction_at: string | null;
  needs_follow_up: boolean;
  is_discarded: boolean;
  loss_reason: string | null;
  is_general_inquiry: boolean;
};

export type AnalyticsExclusion = {
  id: string;
  type: string;
  value: string;
  label: string;
  created_at: string;
};

type ContactTask = {
  id: string;
  contact_id: string;
  completed: boolean | null;
};

type ContactVisit = {
  id: string;
  contact_id: string;
};

type ContactOffer = {
  id: string;
  contact_id: string;
};

type ContactInteraction = {
  property_id: string | null;
  created_at: string | null;
  properties?: {
    id: string;
    title: string | null;
    reference: string | null;
  } | null;
};

type ContactRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  agent_id: string | null;
  status: string;
  pipeline_stage: string | null;
  created_at: string;
  tags: string[] | null;
  interactions?: ContactInteraction[] | null;
};

function madridNow(): Date {
  const madridStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' });
  return new Date(madridStr);
}

function getMadridOffsetMs(date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const madridStr = date.toLocaleString('en-US', { timeZone: 'Europe/Madrid' });
  return new Date(madridStr).getTime() - new Date(utcStr).getTime();
}

export function madridStartOfDay(daysOffset = 0): string {
  const now = madridNow();
  const day = new Date(now);
  day.setDate(day.getDate() + daysOffset);
  day.setHours(0, 0, 0, 0);
  return new Date(day.getTime() - getMadridOffsetMs(day)).toISOString();
}

export function madridEndOfDay(daysOffset = 0): string {
  const now = madridNow();
  const day = new Date(now);
  day.setDate(day.getDate() + daysOffset);
  day.setHours(23, 59, 59, 999);
  return new Date(day.getTime() - getMadridOffsetMs(day)).toISOString();
}

export function toMadrid(utcDateStr: string): Date {
  return new Date(new Date(utcDateStr).toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
}

const BOT_RE = /bot|crawl|spider|slurp|fetch|scrape|headless|phantom|selenium|puppeteer|playwright|googlebot|bingbot|yandex|baidu|duckduck|facebookexternal|twitterbot|linkedinbot|applebot|curl|wget|python-requests|axios|go-http-client|semrush|ahrefs|mj12bot|dotbot/i;
const INTERNAL_REF_RE = /127\.0\.0\.1|localhost/i;
const INTERNAL_PAGE_RE = /forceHideBadge/;

function isSuspectedBot(ua: string): boolean {
  if (!ua) return false;
  if (ua.startsWith('[FBAN/')) return true;
  if (/Android \d+; K\)/i.test(ua)) return true;
  if (/Chrome\/(\d+)\.0\.0\.0/.test(ua) && !/FB_IAB|Instagram|SamsungBrowser|Edg\//.test(ua)) return true;
  const chromeVer = ua.match(/Chrome\/(\d+)\./);
  if (chromeVer && parseInt(chromeVer[1], 10) < 100 && !/FB_IAB|Instagram|Edg\//.test(ua)) return true;
  const iosMatch = ua.match(/CPU iPhone OS (\d+)_/);
  if (iosMatch && parseInt(iosMatch[1], 10) >= 26) return true;
  if (/Version\/2[6-9]\./.test(ua) && /Safari/.test(ua)) return true;
  if (iosMatch && parseInt(iosMatch[1], 10) === 18) {
    const subMatch = ua.match(/iPhone OS 18_(\d+)/);
    if (subMatch && parseInt(subMatch[1], 10) >= 7) return true;
  }
  return false;
}

function isHumanPageview(pageview: Pick<Pageview, 'page' | 'referrer' | 'user_agent'>): boolean {
  const ua = pageview.user_agent ?? '';
  if (!ua || ua.trim().length < 10) return false;
  if (BOT_RE.test(ua)) return false;
  if (isSuspectedBot(ua)) return false;
  if (pageview.referrer && INTERNAL_REF_RE.test(pageview.referrer)) return false;
  if (INTERNAL_PAGE_RE.test(pageview.page)) return false;
  return true;
}

export function useAnalytics(days: number) {
  return useQuery({
    queryKey: ['web-analytics', days],
    queryFn: async () => {
      let from: string;
      let to: string | undefined;
      if (days === 0) {
        from = madridStartOfDay(0);
      } else if (days === -1) {
        from = madridStartOfDay(-1);
        to = madridEndOfDay(-1);
      } else {
        from = subDays(new Date(), days).toISOString();
      }

      let query = supabase
        .from('web_pageviews')
        .select('id, session_id, page, referrer, device, country, created_at, user_agent, utm_source, utm_medium, utm_campaign, utm_content, utm_term')
        .gte('created_at', from)
        .order('created_at', { ascending: true });

      if (to) {
        query = query.lte('created_at', to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).filter(isHumanPageview) as Pageview[];
    },
    refetchInterval: 60_000,
  });
}

export function useAllTimeAnalytics() {
  return useQuery({
    queryKey: ['web-analytics-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('web_pageviews')
        .select('session_id, created_at, page, referrer, device, country, user_agent')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).filter(isHumanPageview) as Pageview[];
    },
    refetchInterval: 300_000,
  });
}

export function usePropertyTitles(): Record<string, string> {
  const { data } = useQuery({
    queryKey: ['property-titles-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, property_type, city, operation');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  if (!data) return {};

  const map: Record<string, string> = {};
  const operationLabel: Record<string, string> = { venta: 'venta', alquiler: 'alquiler', ambas: '' };
  for (const property of data) {
    const type = property.property_type
      ? property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1)
      : 'Inmueble';
    const city = property.city ? ` en ${property.city}` : '';
    const operation =
      property.operation && property.operation !== 'ambas'
        ? ` · ${operationLabel[property.operation] ?? property.operation}`
        : '';
    map[property.id] = `🏡 ${type}${city}${operation}`;
    if (property.title) {
      map[`title:${property.id}`] = property.title;
    }
  }

  return map;
}

export function useWebLeads() {
  return useQuery({
    queryKey: ['web-leads-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id, full_name, email, phone, agent_id, status, pipeline_stage, created_at, tags,
          interactions(property_id, created_at, properties(id, title, reference))
        `)
        .or('tags.cs.{web-lead},tags.cs.{portal-lead},tags.cs.{fb-lead-ads}')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const contacts = (data ?? []) as ContactRow[];
      const contactIds = contacts.map((contact) => contact.id);

      let tasksByContact = new Map<string, Array<{ completed: boolean | null }>>();
      let visitsByContact = new Map<string, Array<{ id: string }>>();
      let offersByContact = new Map<string, Array<{ id: string }>>();

      if (contactIds.length > 0) {
        const [tasksResult, visitsResult, offersResult] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, contact_id, completed')
            .in('contact_id', contactIds),
          supabase
            .from('visits')
            .select('id, contact_id')
            .in('contact_id', contactIds),
          supabase
            .from('offers')
            .select('id, contact_id')
            .in('contact_id', contactIds),
        ]);

        if (tasksResult.error) throw tasksResult.error;
        if (visitsResult.error) throw visitsResult.error;
        if (offersResult.error) throw offersResult.error;

        tasksByContact = ((tasksResult.data ?? []) as ContactTask[]).reduce((map, task) => {
          const list = map.get(task.contact_id) ?? [];
          list.push(task);
          map.set(task.contact_id, list);
          return map;
        }, new Map<string, Array<{ completed: boolean | null }>>());

        visitsByContact = ((visitsResult.data ?? []) as ContactVisit[]).reduce((map, visit) => {
          const list = map.get(visit.contact_id) ?? [];
          list.push(visit);
          map.set(visit.contact_id, list);
          return map;
        }, new Map<string, Array<{ id: string }>>());

        offersByContact = ((offersResult.data ?? []) as ContactOffer[]).reduce((map, offer) => {
          const list = map.get(offer.contact_id) ?? [];
          list.push(offer);
          map.set(offer.contact_id, list);
          return map;
        }, new Map<string, Array<{ id: string }>>());
      }

      return contacts.map((contact) => {
        const propertyInteraction = contact.interactions?.find((interaction) => interaction.property_id && interaction.properties);
        const tags: string[] = contact.tags ?? [];
        const isPortalLead = tags.includes('portal-lead');
        const isFbLead = tags.includes('fb-lead-ads');
        const isGeneralInquiry = tags.includes('general-web-lead');
        const webOrigin = tags.includes('alicanteconnectnews')
          ? 'alicanteconnectnews'
          : tags.includes('legadocoleccion')
            ? 'legadocoleccion'
            : null;
        const webOriginLabel = webOrigin === 'alicanteconnectnews'
          ? 'Costa Blanca Chronicle'
          : webOrigin === 'legadocoleccion'
            ? 'Legado Colección'
            : null;
        const portalTag = tags.find((tag: string) => tag.startsWith('portal:'));
        const portalName = portalTag ? portalTag.split(':')[1] : null;
        const interactions = contact.interactions ?? [];
        const lastInteractionAt = interactions
          .map((interaction) => interaction.created_at)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null;
        const tasks = tasksByContact.get(contact.id) ?? [];
        const visits = visitsByContact.get(contact.id) ?? [];
        const offers = offersByContact.get(contact.id) ?? [];
        const openTaskCount = tasks.filter((task) => !task.completed).length;
        const totalTaskCount = tasks.length;
        const visitCount = visits.length;
        const offerCount = offers.length;
        const lossReasonTag = tags.find((tag: string) => tag.startsWith('loss_reason:'));
        const lossReason = lossReasonTag ? lossReasonTag.replace('loss_reason:', '').replace(/_/g, ' ') : null;
        const isDiscarded = ['sin_interes', 'inactivo'].includes(contact.pipeline_stage || '');
        const needsFollowUp =
          !isDiscarded &&
          openTaskCount === 0 &&
          visitCount === 0 &&
          offerCount === 0 &&
          (!contact.pipeline_stage || ['nuevo', 'contactado'].includes(contact.pipeline_stage));

        return {
          ...contact,
          linked_property: propertyInteraction?.properties ?? null,
          lead_source: isFbLead ? 'fb' : isPortalLead ? 'portal' : 'web',
          web_origin: webOrigin,
          web_origin_label: webOriginLabel,
          portal_name: isFbLead
            ? 'Facebook Ads'
            : portalName
            ? portalName.charAt(0).toUpperCase() + portalName.slice(1)
            : null,
          open_task_count: openTaskCount,
          total_task_count: totalTaskCount,
          visit_count: visitCount,
          offer_count: offerCount,
          last_interaction_at: lastInteractionAt,
          needs_follow_up: needsFollowUp,
          is_discarded: isDiscarded,
          loss_reason: lossReason,
          is_general_inquiry: isGeneralInquiry,
        } satisfies WebLead;
      });
    },
  });
}

export function useExclusions() {
  return useQuery({
    queryKey: ['analytics-exclusions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('analytics_exclusions' as never)
        .select('id, type, value, label, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnalyticsExclusion[];
    },
  });
}
