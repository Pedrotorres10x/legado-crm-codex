import { useMemo } from 'react';
import { differenceInSeconds, format, parseISO, startOfMonth, subDays } from 'date-fns';
import {
  madridEndOfDay,
  madridStartOfDay,
  Pageview,
  toMadrid,
  TRACK_URL,
  WebLead,
  WebLeadsRange,
} from '@/hooks/useWebLeadsData';

export type SessionDetail = {
  sid: string;
  pvs: { page: string; created_at: string }[];
  device: string | null;
  country: string | null;
  source: string;
  entryPage: string;
  exitPage: string;
  durationSec: number | null;
  isReturning: boolean;
  firstSeen: string;
  lastSeen: string;
  pageCount: number;
};

const NOISE_PATTERNS = [/__lovable_token/, /forceHideBadge/, /fbclid/, /gclid/, /utm_/];

function madridNow(): Date {
  return toMadrid(new Date().toISOString());
}

function isBlog(page: string) {
  return page.includes('/blog') || page.includes('/articulo') || page.includes('/post') || page.includes('/noticia');
}

function cleanRef(referrer: string | null): string {
  if (!referrer) return 'Directo';
  try {
    const url = new URL(referrer);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return referrer.split('/')[0];
  }
}

function trafficSource(referrer: string | null, pageview?: { utm_source?: string | null }): string {
  if (!referrer) return 'Directo';
  const hostname = cleanRef(referrer).toLowerCase();
  if (hostname.includes('google')) return 'Google';
  if (hostname.includes('bing')) return 'Bing';
  if (hostname.includes('facebook') || hostname.includes('fb.com') || hostname.includes('m.facebook') || hostname.includes('l.facebook')) {
    const hasUtm = pageview?.utm_source && (pageview.utm_source === 'fb' || pageview.utm_source === 'facebook');
    return hasUtm ? 'Facebook (campana)' : 'Facebook';
  }
  if (hostname.includes('instagram')) return 'Instagram';
  if (hostname.includes('twitter') || hostname.includes('t.co') || hostname.includes('x.com')) return 'Twitter/X';
  if (hostname.includes('linkedin')) return 'LinkedIn';
  if (hostname.includes('youtube')) return 'YouTube';
  if (hostname.includes('whatsapp')) return 'WhatsApp';
  if (hostname.includes('lovable')) return 'Preview (internal)';
  return hostname || 'Otros';
}

function isNoisyPage(page: string) {
  return NOISE_PATTERNS.some((pattern) => pattern.test(page));
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function useWebLeadsMetrics({
  days,
  pageviews,
  allPageviews,
  leads,
}: {
  days: WebLeadsRange;
  pageviews: Pageview[];
  allPageviews: Pageview[];
  leads: WebLead[];
}) {
  return useMemo(() => {
    const totalPV = pageviews.length;

    const sessionMap = new Map<string, Pageview[]>();
    pageviews.forEach((pageview) => {
      if (!sessionMap.has(pageview.session_id)) {
        sessionMap.set(pageview.session_id, []);
      }
      sessionMap.get(pageview.session_id)!.push(pageview);
    });

    const uniqueSessions = sessionMap.size;

    const allTimeSessions = new Map<string, string[]>();
    allPageviews.forEach((pageview) => {
      if (!allTimeSessions.has(pageview.session_id)) {
        allTimeSessions.set(pageview.session_id, []);
      }
      allTimeSessions.get(pageview.session_id)!.push(pageview.created_at);
    });

    const returningSessionIds = new Set<string>();
    allTimeSessions.forEach((dates, sessionId) => {
      const seenDays = new Set(dates.map((date) => date.substring(0, 10)));
      if (seenDays.size >= 2) {
        returningSessionIds.add(sessionId);
      }
    });

    const returningCount = [...sessionMap.keys()].filter((sessionId) => returningSessionIds.has(sessionId)).length;
    const newVisitors = uniqueSessions - returningCount;

    const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
    pageviews.forEach((pageview) => {
      const device = pageview.device ?? 'desktop';
      if (device in deviceCounts) {
        deviceCounts[device as keyof typeof deviceCounts] += 1;
      }
    });

    const sessionDetails: SessionDetail[] = Array.from(sessionMap.entries())
      .map(([sid, pageviewsInSession]) => {
        const sorted = [...pageviewsInSession].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const rawDuration =
          sorted.length > 1 ? differenceInSeconds(parseISO(last.created_at), parseISO(first.created_at)) : null;
        const durationSec = rawDuration !== null && rawDuration <= 1800 ? rawDuration : null;
        return {
          sid,
          pvs: sorted,
          device: first.device,
          country: first.country,
          source: trafficSource(first.referrer, first),
          entryPage: first.page,
          exitPage: last.page,
          durationSec,
          isReturning: returningSessionIds.has(sid),
          firstSeen: first.created_at,
          lastSeen: last.created_at,
          pageCount: sorted.length,
        };
      })
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

    const avgPagesPerSession = uniqueSessions > 0 ? (totalPV / uniqueSessions).toFixed(1) : '0';
    const sessionsWithDuration = sessionDetails.filter((session) => session.durationSec !== null && session.durationSec > 0);
    const avgDuration = sessionsWithDuration.length
      ? formatDuration(
          Math.round(
            sessionsWithDuration.reduce((sum, session) => sum + (session.durationSec ?? 0), 0) / sessionsWithDuration.length,
          ),
        )
      : null;

    const bouncedSessions = sessionDetails.filter((session) => session.pageCount === 1).length;
    const bounceRate = uniqueSessions > 0 ? Math.round((bouncedSessions / uniqueSessions) * 100) : 0;

    const pageCounts: Record<string, number> = {};
    pageviews
      .filter((pageview) => !isNoisyPage(pageview.page))
      .forEach((pageview) => {
        pageCounts[pageview.page] = (pageCounts[pageview.page] ?? 0) + 1;
      });
    const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const blogPages = topPages.filter(([page]) => isBlog(page));

    const entryPageCounts: Record<string, number> = {};
    const exitPageCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    sessionDetails.forEach((session) => {
      entryPageCounts[session.entryPage] = (entryPageCounts[session.entryPage] ?? 0) + 1;
      exitPageCounts[session.exitPage] = (exitPageCounts[session.exitPage] ?? 0) + 1;
      sourceCounts[session.source] = (sourceCounts[session.source] ?? 0) + 1;
    });

    const topEntryPages = Object.entries(entryPageCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topExitPages = Object.entries(exitPageCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

    const rawRefCounts: Record<string, number> = {};
    pageviews
      .filter((pageview) => pageview.referrer)
      .forEach((pageview) => {
        const ref = cleanRef(pageview.referrer);
        rawRefCounts[ref] = (rawRefCounts[ref] ?? 0) + 1;
      });
    const topReferrers = Object.entries(rawRefCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const utmSourceCounts: Record<string, number> = {};
    const utmMediumCounts: Record<string, number> = {};
    const utmCampaignCounts: Record<string, number> = {};
    pageviews.forEach((pageview) => {
      if (pageview.utm_source) utmSourceCounts[pageview.utm_source] = (utmSourceCounts[pageview.utm_source] ?? 0) + 1;
      if (pageview.utm_medium) utmMediumCounts[pageview.utm_medium] = (utmMediumCounts[pageview.utm_medium] ?? 0) + 1;
      if (pageview.utm_campaign) utmCampaignCounts[pageview.utm_campaign] = (utmCampaignCounts[pageview.utm_campaign] ?? 0) + 1;
    });

    const topUtmSources = Object.entries(utmSourceCounts).sort((a, b) => b[1] - a[1]);
    const topUtmMediums = Object.entries(utmMediumCounts).sort((a, b) => b[1] - a[1]);
    const topUtmCampaigns = Object.entries(utmCampaignCounts).sort((a, b) => b[1] - a[1]);
    const totalUtmPV = Object.values(utmSourceCounts).reduce((sum, count) => sum + count, 0);

    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({ hour, visitas: 0 }));
    pageviews.forEach((pageview) => {
      hourlyData[toMadrid(pageview.created_at).getHours()].visitas += 1;
    });
    const peakHour = hourlyData.reduce((max, hour) => (hour.visitas > max.visitas ? hour : max), hourlyData[0]);

    const weekdayLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const dowData = Array.from({ length: 7 }, (_, index) => ({ dia: weekdayLabels[index], visitas: 0 }));
    pageviews.forEach((pageview) => {
      dowData[toMadrid(pageview.created_at).getDay()].visitas += 1;
    });

    const visibleDays = Math.min(days <= 0 ? 1 : days, 30);
    const baseDate = days === -1 ? subDays(madridNow(), 1) : madridNow();
    const dailyBuckets: Record<string, number> = {};
    for (let index = visibleDays - 1; index >= 0; index -= 1) {
      const date = subDays(baseDate, index);
      dailyBuckets[format(date, 'dd/MM')] = 0;
    }
    pageviews.forEach((pageview) => {
      const bucket = format(toMadrid(pageview.created_at), 'dd/MM');
      if (bucket in dailyBuckets) {
        dailyBuckets[bucket] += 1;
      }
    });
    const dailyData = Object.entries(dailyBuckets).map(([dia, visitas]) => ({ dia, visitas }));

    const countryCounts: Record<string, number> = {};
    pageviews
      .filter((pageview) => pageview.country)
      .forEach((pageview) => {
        countryCounts[pageview.country!] = (countryCounts[pageview.country!] ?? 0) + 1;
      });
    const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const totalWithCountry = Object.values(countryCounts).reduce((sum, count) => sum + count, 0);

    const leadsFrom =
      days === 0 ? new Date(madridStartOfDay(0)) : days === -1 ? new Date(madridStartOfDay(-1)) : subDays(new Date(), days);
    const leadsTo = days === -1 ? new Date(madridEndOfDay(-1)) : new Date();
    const filteredLeads = leads.filter((lead) => {
      const createdAt = parseISO(lead.created_at);
      return createdAt >= leadsFrom && createdAt <= leadsTo;
    });
    const totalLeads = filteredLeads.length;
    const webLeadsCount = filteredLeads.filter((lead) => lead.lead_source === 'web').length;
    const portalLeadsCount = filteredLeads.filter((lead) => lead.lead_source === 'portal').length;
    const fbLeadsCount = filteredLeads.filter((lead) => lead.lead_source === 'fb').length;
    const leadsWithoutProperty = filteredLeads.filter((lead) => !lead.linked_property).length;
    const leadsWithoutFollowUp = filteredLeads.filter((lead) => lead.needs_follow_up).length;
    const leadsWithVisits = filteredLeads.filter((lead) => lead.visit_count > 0).length;
      const leadsWithOffers = filteredLeads.filter((lead) => lead.offer_count > 0).length;
      const leadsWithOpenTasks = filteredLeads.filter((lead) => lead.open_task_count > 0).length;
      const discardedLeads = filteredLeads.filter((lead) => lead.is_discarded).length;
      const lossReasonCounts = filteredLeads
        .filter((lead) => lead.is_discarded && lead.loss_reason)
        .reduce((acc, lead) => {
          const key = lead.loss_reason as string;
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      const topLossReasons = Object.entries(lossReasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const leadsThisMonth = leads.filter((lead) => parseISO(lead.created_at) >= startOfMonth(new Date())).length;
      const convRate = uniqueSessions > 0 ? ((webLeadsCount / uniqueSessions) * 100).toFixed(1) : '0';
      const channelFunnel = [
        { id: 'web', label: 'Web' },
        { id: 'portal', label: 'Portal' },
        { id: 'fb', label: 'FB Ads' },
      ].map((channel) => {
        const channelLeads = filteredLeads.filter((lead) => lead.lead_source === channel.id);
        const total = channelLeads.length;
        const withVisits = channelLeads.filter((lead) => lead.visit_count > 0).length;
        const withOffers = channelLeads.filter((lead) => lead.offer_count > 0).length;
        const withTasks = channelLeads.filter((lead) => lead.open_task_count > 0).length;
        const needsFollowUpCount = channelLeads.filter((lead) => lead.needs_follow_up).length;
        const discardedCount = channelLeads.filter((lead) => lead.is_discarded).length;
        const channelLossReasonCounts = channelLeads
          .filter((lead) => lead.is_discarded && lead.loss_reason)
          .reduce((acc, lead) => {
            const key = lead.loss_reason as string;
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        const topLossReason = Object.entries(channelLossReasonCounts).sort((a, b) => b[1] - a[1])[0] ?? null;
        return {
          id: channel.id,
          label: channel.label,
          total,
          withTasks,
          withVisits,
          withOffers,
          needsFollowUp: needsFollowUpCount,
          discarded: discardedCount,
          topLossReason: topLossReason ? { label: topLossReason[0], count: topLossReason[1] } : null,
          taskRate: total > 0 ? Math.round((withTasks / total) * 100) : 0,
          visitRate: total > 0 ? Math.round((withVisits / total) * 100) : 0,
          offerRate: total > 0 ? Math.round((withOffers / total) * 100) : 0,
        };
      });

    const snippet = `<!-- Analytics Legado CRM — pega en el <head> de tu web -->
<script>
(function() {
  var T = '${TRACK_URL}';
  var sid = sessionStorage.getItem('_lc_sid');
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('_lc_sid', sid);
  }
  function getPage() {
    return window.location.pathname + window.location.search;
  }
  function track(pg) {
    fetch(T, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sid,
        page: pg || getPage(),
        referrer: document.referrer || null
      })
    }).catch(function(){});
  }
  track(getPage());
  var _push = history.pushState.bind(history);
  history.pushState = function(s, t, url) {
    _push(s, t, url);
    setTimeout(function() { track(getPage()); }, 150);
  };
  window.addEventListener('popstate', function() {
    setTimeout(function() { track(getPage()); }, 150);
  });
})();
</script>`;

    return {
      avgDuration,
      avgPagesPerSession,
      blogPages,
      bouncedSessions,
      bounceRate,
      convRate,
      channelFunnel,
      countryCounts,
      dailyData,
      deviceCounts,
      dowData,
      fbLeadsCount,
      filteredLeads,
      hasData: totalPV > 0,
      hourlyData,
      leadsWithOffers,
      leadsWithOpenTasks,
      leadsWithVisits,
      discardedLeads,
      leadsThisMonth,
      leadsWithoutFollowUp,
      leadsWithoutProperty,
      newVisitors,
      peakHour,
      portalLeadsCount,
      rawRefCounts,
      returningCount,
      returningSessionIds,
      sessionDetails,
      sessionMap,
      snippet,
      sourceCounts,
      topCountries,
      topEntryPages,
      topExitPages,
      topLossReasons,
      topPages,
      topReferrers,
      topSources,
      topUtmCampaigns,
      topUtmMediums,
      topUtmSources,
      totalLeads,
      totalPV,
      totalUtmPV,
      totalWithCountry,
      uniqueSessions,
      utmCampaignCounts,
      utmMediumCounts,
      utmSourceCounts,
      webLeadsCount,
    };
  }, [allPageviews, days, leads, pageviews]);
}
