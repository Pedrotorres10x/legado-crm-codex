import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, Globe, MousePointerClick,
  TrendingUp, Mail, PhoneCall, ArrowUpRight,
  Clock, ExternalLink, Copy, CheckCheck, Code2,
  FileText, LogOut, BarChart2, Sun, Moon,
  AlertCircle, ArrowRight, Hash, MapPin, Repeat
} from 'lucide-react';
import {
  format
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Cell
} from 'recharts';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { WebLeadsInboundPanel } from '@/components/webleads/WebLeadsInboundPanel';
import { WebLeadsExclusionsPanel } from '@/components/webleads/WebLeadsExclusionsPanel';
import { WebLeadsCampaignsPanel } from '@/components/webleads/WebLeadsCampaignsPanel';
import { WebLeadsPagesPanel } from '@/components/webleads/WebLeadsPagesPanel';
import { WebLeadsSessionsPanel } from '@/components/webleads/WebLeadsSessionsPanel';
import { WebLeadsSummaryPanel } from '@/components/webleads/WebLeadsSummaryPanel';
import { WebLeadsTrafficPanel } from '@/components/webleads/WebLeadsTrafficPanel';
import {
  RANGE_OPTIONS,
  Pageview,
  toMadrid,
  useAllTimeAnalytics,
  useAnalytics,
  useExclusions,
  usePropertyTitles,
  useWebLeads,
  WebLeadsRange,
} from '@/hooks/useWebLeadsData';
import { useWebLeadsExclusions } from '@/hooks/useWebLeadsExclusions';
import { useWebLeadsMetrics } from '@/hooks/useWebLeadsMetrics';

const STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', en_seguimiento: 'En seguimiento', activo: 'Activo', cerrado: 'Cerrado',
};
const STAGE_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', visita: 'Visita',
  oferta: 'Oferta', negociacion: 'Negociación', cerrado: 'Cerrado',
};

const ISO_FLAGS: Record<string, string> = {
  ES: '🇪🇸', US: '🇺🇸', GB: '🇬🇧', FR: '🇫🇷', DE: '🇩🇪', IT: '🇮🇹',
  PT: '🇵🇹', NL: '🇳🇱', BE: '🇧🇪', CH: '🇨🇭', SE: '🇸🇪', NO: '🇳🇴',
  DK: '🇩🇰', FI: '🇫🇮', PL: '🇵🇱', RU: '🇷🇺', CN: '🇨🇳', JP: '🇯🇵',
  MX: '🇲🇽', AR: '🇦🇷', BR: '🇧🇷', CO: '🇨🇴', CL: '🇨🇱', PE: '🇵🇪',
  VE: '🇻🇪', MA: '🇲🇦', CA: '🇨🇦', AU: '🇦🇺', IN: '🇮🇳', AE: '🇦🇪',
  SA: '🇸🇦', ZA: '🇿🇦', NG: '🇳🇬', EG: '🇪🇬', TR: '🇹🇷', UA: '🇺🇦',
  // Full name fallbacks
  Spain: '🇪🇸', España: '🇪🇸', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧',
  France: '🇫🇷', Germany: '🇩🇪', Italy: '🇮🇹', Portugal: '🇵🇹',
  Mexico: '🇲🇽', Argentina: '🇦🇷', Brazil: '🇧🇷', Morocco: '🇲🇦',
};
const countryFlag = (c: string) => ISO_FLAGS[c] ?? '🌍';

// Detect if page is a blog article
const isBlog = (page: string) =>
  page.includes('/blog') || page.includes('/articulo') || page.includes('/post') || page.includes('/noticia');

// Clean referrer hostname
const cleanRef = (r: string | null): string => {
  if (!r) return 'Directo';
  try {
    const url = new URL(r);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return r.split('/')[0];
  }
};

// Traffic source category
// pv se usa para distinguir Facebook con UTMs (campaña atribuida) vs solo por referrer
const trafficSource = (ref: string | null, pv?: { utm_source?: string | null }): string => {
  if (!ref) return 'Directo';
  const h = cleanRef(ref).toLowerCase();
  if (h.includes('google')) return 'Google';
  if (h.includes('bing')) return 'Bing';
  if (h.includes('facebook') || h.includes('fb.com') || h.includes('m.facebook') || h.includes('l.facebook')) {
    // Si tiene utm_source con valor 'fb' o 'facebook' Y utm_campaign → atribución completa
    const hasUtm = pv?.utm_source && (pv.utm_source === 'fb' || pv.utm_source === 'facebook');
    return hasUtm ? 'Facebook (campaña)' : 'Facebook';
  }
  if (h.includes('instagram')) return 'Instagram';
  if (h.includes('twitter') || h.includes('t.co') || h.includes('x.com')) return 'Twitter/X';
  if (h.includes('linkedin')) return 'LinkedIn';
  if (h.includes('youtube')) return 'YouTube';
  if (h.includes('whatsapp')) return 'WhatsApp';
  return h || 'Otros';
};

function pageName(page: string, propertyMap: Record<string, string> = {}): string {
  const p = page || '/';

  // Strip query params that are internal/technical noise
  const noisy = [
    'forceHideBadge', 'fbclid', 'gclid', 'utm_source',
    'utm_medium', 'utm_campaign', '_ga',
  ];
  try {
    const url = new URL('https://x.com' + p);
    for (const n of noisy) {
      if (url.searchParams.has(n)) {
        url.searchParams.delete(n);
      }
    }
    const clean = url.pathname + (url.search ? url.search : '');
    if (clean !== p) return pageName(clean, propertyMap);
  } catch { /* not a valid path */ }

  const path = p.split('?')[0];

  if (path === '/' || path === '') return '🏠 Inicio';

  const parts = path.split('/').filter(Boolean);

  // /propiedad/<uuid> or /inmueble/<uuid> → look up real title
  if ((parts[0] === 'propiedad' || parts[0] === 'inmueble') && parts[1]) {
    const id = parts[1];
    if (propertyMap[id]) return propertyMap[id];
    // fallback: show a clean "Propiedad" label, no UUID
    return '🏡 Propiedad';
  }

  // /blog/<slug>
  if (parts[0] === 'blog' && parts[1]) {
    const slug = parts[1].replace(/-/g, ' ');
    const title = slug.charAt(0).toUpperCase() + slug.slice(1);
    return `📝 Blog · ${title}`;
  }
  if (parts[0] === 'blog') return '📝 Blog';

  // /articulo/<slug> or /post/<slug>
  if ((parts[0] === 'articulo' || parts[0] === 'post' || parts[0] === 'noticia') && parts[1]) {
    const slug = parts[1].replace(/-/g, ' ');
    const title = slug.charAt(0).toUpperCase() + slug.slice(1);
    return `📝 ${title}`;
  }

  if (parts[0] === 'gracias' || parts[0] === 'thank-you' || parts[0] === 'thanks') return '✅ Gracias';
  if (parts[0] === 'contacto' || parts[0] === 'contact') return '📞 Contacto';
  if (parts[0] === 'nosotros' || parts[0] === 'sobre-nosotros' || parts[0] === 'quienes-somos') return '👥 Nosotros';
  if (parts[0] === 'propiedades' || parts[0] === 'inmuebles' || parts[0] === 'catalogo') return '🏘️ Catálogo';
  if (parts[0] === 'servicios') return '⭐ Servicios';
  if (parts[0] === 'vender' || parts[0] === 'tasacion') return '💰 Vender';
  if (parts[0] === 'comprar') return '🔍 Comprar';
  if (parts[0] === 'alquilar') return '🔑 Alquilar';

  // Generic: humanise the slug
  const last = parts[parts.length - 1];
  const readable = last.replace(/-/g, ' ').replace(/_/g, ' ');
  return '/' + readable.charAt(0).toUpperCase() + readable.slice(1);
}

export default function WebLeads() {
  const [days, setDays] = useState<WebLeadsRange>(30);
  const [tab, setTab] = useState<'resumen' | 'sesiones' | 'paginas' | 'trafico' | 'campanas' | 'horario' | 'paises' | 'leads' | 'exclusiones'>('resumen');
  const [copied, setCopied] = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);
  const [leadFilter, setLeadFilter] = useState<'all' | 'needs_follow_up' | 'missing_property' | 'general_inquiry' | 'with_offer' | 'with_visit' | 'with_open_task' | 'discarded'>('all');
  const [leadSourceFilter, setLeadSourceFilter] = useState<'all' | 'web' | 'portal' | 'fb'>('all');
  const [leadOriginFilter, setLeadOriginFilter] = useState<'all' | 'legadocoleccion' | 'alicanteconnectnews'>('all');

  // Exclusions panel state
  const { data: exclusions = [], refetch: refetchExclusions } = useExclusions();
  const {
    addExclusion,
    newExcLabel,
    newExcType,
    newExcValue,
    removeExclusion,
    savingExc,
    setNewExcLabel,
    setNewExcType,
    setNewExcValue,
  } = useWebLeadsExclusions(refetchExclusions);

  const { data: pageviews = [], isLoading: pvLoading } = useAnalytics(days === 0 ? 1 : days);
  const { data: allPV = [] } = useAllTimeAnalytics();
  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useWebLeads();
  const propertyMap = usePropertyTitles();
  const {
    avgDuration,
    avgPagesPerSession,
    blogPages,
    bouncedSessions,
    bounceRate,
    channelFunnel,
    convRate,
    dailyData,
    deviceCounts,
    dowData,
    fbLeadsCount,
    filteredLeads,
    hasData,
    hourlyData,
    leadsWithOffers,
    leadsWithOpenTasks,
    leadsWithVisits,
    discardedLeads,
    generalInquiryCount,
    leadsWithoutFollowUp,
    leadsWithoutProperty,
    newVisitors,
    peakHour,
    portalLeadsCount,
    returningCount,
    sessionDetails,
    snippet,
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
    webLeadsCount,
  } = useWebLeadsMetrics({
    days,
    pageviews,
    allPageviews: allPV,
    leads,
  });

  const visibleLeads = useMemo(() => {
    let nextLeads = filteredLeads;

    if (leadSourceFilter !== 'all') {
      nextLeads = nextLeads.filter((lead) => lead.lead_source === leadSourceFilter);
    }

    if (leadOriginFilter !== 'all') {
      nextLeads = nextLeads.filter((lead) => lead.web_origin === leadOriginFilter);
    }

    if (leadFilter === 'needs_follow_up') return nextLeads.filter((lead) => lead.needs_follow_up);
    if (leadFilter === 'general_inquiry') return nextLeads.filter((lead) => lead.is_general_inquiry);
    if (leadFilter === 'missing_property') return nextLeads.filter((lead) => !lead.linked_property);
    if (leadFilter === 'with_offer') return nextLeads.filter((lead) => lead.offer_count > 0);
    if (leadFilter === 'with_visit') return nextLeads.filter((lead) => lead.visit_count > 0);
    if (leadFilter === 'with_open_task') return nextLeads.filter((lead) => lead.open_task_count > 0);
    if (leadFilter === 'discarded') return nextLeads.filter((lead) => lead.is_discarded);
    return nextLeads;
  }, [filteredLeads, leadFilter, leadOriginFilter, leadSourceFilter]);

  const handleDiscardLead = async (leadId: string, reason: string) => {
    const cleanReason = reason.trim().toLowerCase().replace(/\s+/g, '_');
    const lead = leads.find((item) => item.id === leadId);
    const currentTags = lead?.tags || [];
    const nextTags = [
      ...currentTags.filter((tag) => !tag.startsWith('loss_reason:')),
      `loss_reason:${cleanReason}`,
    ];

    const { error } = await supabase
      .from('contacts')
      .update({
        pipeline_stage: 'sin_interes',
        tags: nextTags,
      })
      .eq('id', leadId);

    if (!error) {
      await refetchLeads();
    }
  };


  const copySnippet = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'sesiones', label: `Sesiones (${uniqueSessions})` },
    { id: 'paginas', label: 'Páginas' },
    { id: 'trafico', label: 'Tráfico' },
    { id: 'campanas', label: `Campañas${totalUtmPV > 0 ? ` (${totalUtmPV})` : ''}` },
    { id: 'horario', label: 'Horario' },
    { id: 'paises', label: `Países${topCountries.length > 0 ? ` (${topCountries.length})` : ''}` },
    { id: 'leads', label: `Leads (${totalLeads})` },
    { id: 'exclusiones', label: `🚫 Exclusiones (${exclusions.length})` },
  ] as const;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">Legado Colección</h1>
            <Badge variant="outline" className="text-xs">Analytics avanzado</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {days === 0 ? 'Hoy' : days === -1 ? 'Ayer' : `Últimos ${days} días`} · actualización automática cada minuto
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days as WebLeadsRange)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  days === opt.days
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSnippet(!showSnippet)}>
            <Code2 className="h-4 w-4 mr-1" />
            {showSnippet ? 'Ocultar' : 'Código tracking'}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.legadocoleccion.es" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />Ver web
            </a>
          </Button>
        </div>
      </div>

      {/* Snippet */}
      {showSnippet && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" />
              Snippet de tracking — pega en Legado Colección
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Añade este código en el <code className="bg-muted px-1 rounded">{'<body>'}</code> de tu index.html o componente raíz.
            </p>
            <div className="relative">
              <pre className="bg-muted rounded-lg p-4 text-[10px] leading-relaxed overflow-x-auto font-mono whitespace-pre">
                {snippet}
              </pre>
              <Button size="sm" className="absolute top-2 right-2 h-7 px-2 text-xs gap-1" onClick={copySnippet}>
                {copied ? <><CheckCheck className="h-3.5 w-3.5" />Copiado</> : <><Copy className="h-3.5 w-3.5" />Copiar</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3">
        {[
          { label: 'Páginas vistas', value: totalPV, icon: MousePointerClick, color: 'text-primary' },
          { label: 'Sesiones', value: uniqueSessions, icon: Users, color: 'text-primary' },
          { label: 'Recurrentes', value: returningCount, icon: Repeat, color: 'text-primary' },
          { label: 'Pág/sesión', value: avgPagesPerSession, icon: FileText, color: 'text-muted-foreground' },
          { label: 'Tasa rebote', value: `${bounceRate}%`, icon: LogOut, color: 'text-destructive' },
          { label: 'Duración media', value: avgDuration ?? '—', icon: Clock, color: 'text-muted-foreground' },
          { label: 'Conversión web', value: `${convRate}%`, icon: TrendingUp, color: 'text-primary' },
          { label: 'Leads web', value: webLeadsCount, icon: Globe, color: 'text-primary' },
          { label: 'Leads portal', value: portalLeadsCount + fbLeadsCount, icon: Users, color: 'text-blue-600' },
        ].map(k => (
          <Card key={k.label} className="min-w-0">
            <CardContent className="pt-3 pb-3 px-3">
              <k.icon className={`h-3.5 w-3.5 mb-1.5 ${k.color}`} />
              <div className="text-xl font-bold text-foreground truncate">{k.value}</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No data state */}
      {!hasData && !pvLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Code2 className="h-12 w-12 opacity-20" />
            <p className="font-medium text-sm">Aún no hay datos de visitas</p>
            <p className="text-xs opacity-60 text-center max-w-sm">
              Añade el snippet de tracking a Legado Colección y los datos aparecerán aquí en tiempo real.
            </p>
            <Button size="sm" variant="outline" onClick={() => setShowSnippet(true)}>
              <Code2 className="h-4 w-4 mr-1" />Ver código de tracking
            </Button>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* Main chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Páginas vistas por día
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="dia" tick={{ fontSize: 9 }} interval={Math.floor(dailyData.length / 10)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [v, 'Páginas vistas']} />
                  <Bar dataKey="visitas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex gap-0.5 border-b border-border overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── RESUMEN ── */}
          {tab === 'resumen' && (
            <WebLeadsSummaryPanel
              deviceCounts={deviceCounts}
              totalPV={totalPV}
              newVisitors={newVisitors}
              returningCount={returningCount}
              uniqueSessions={uniqueSessions}
              topSources={topSources}
              topPages={topPages}
              avgPagesPerSession={avgPagesPerSession}
              avgDuration={avgDuration}
              bounceRate={bounceRate}
              bouncedSessions={bouncedSessions}
              blogVisits={pageviews.filter((p) => isBlog(p.page)).length || 0}
              peakHour={peakHour}
              pageName={(page) => pageName(page, propertyMap)}
            />
          )}

          {/* ── SESIONES ── */}
          {tab === 'sesiones' && (
            <WebLeadsSessionsPanel
              sessionDetails={sessionDetails}
              pageName={(page) => pageName(page, propertyMap)}
              countryFlag={countryFlag}
            />
          )}

          {/* ── PÁGINAS ── */}
          {tab === 'paginas' && (
            <WebLeadsPagesPanel
              topPages={topPages}
              totalPV={totalPV}
              topEntryPages={topEntryPages}
              topExitPages={topExitPages}
              blogPages={blogPages}
              pageName={(page) => pageName(page, propertyMap)}
            />
          )}

          {/* ── TRÁFICO ── */}
          {tab === 'trafico' && (
            <WebLeadsTrafficPanel
              topSources={topSources}
              uniqueSessions={uniqueSessions}
              topReferrers={topReferrers}
            />
          )}

          {/* ── CAMPAÑAS UTM ── */}
          {tab === 'campanas' && (
            <WebLeadsCampaignsPanel
              totalUtmPV={totalUtmPV}
              topUtmSources={topUtmSources}
              topUtmMediums={topUtmMediums}
              topUtmCampaigns={topUtmCampaigns}
              utmMediumCounts={utmMediumCounts}
              utmCampaignCounts={utmCampaignCounts}
            />
          )}

          {/* ── HORARIO ── */}
          {tab === 'horario' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Tráfico por hora del día
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickFormatter={h => `${h}h`} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} labelFormatter={h => `${h}:00h`} formatter={(v: number) => [v, 'Páginas']} />
                      <Bar dataKey="visitas" radius={[2, 2, 0, 0]}>
                        {hourlyData.map((entry, i) => (
                          <Cell key={i} fill={entry.visitas === peakHour.visitas && entry.visitas > 0 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.4)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Mañana (6-14h)', hours: hourlyData.slice(6, 14), icon: '🌅' },
                      { label: 'Tarde (14-20h)', hours: hourlyData.slice(14, 20), icon: '☀️' },
                      { label: 'Noche (20-6h)', hours: [...hourlyData.slice(20), ...hourlyData.slice(0, 6)], icon: '🌙' },
                    ].map(t => (
                      <div key={t.label} className="bg-muted/40 rounded-lg p-2">
                        <div className="text-lg">{t.icon}</div>
                        <div className="text-sm font-bold text-foreground">{t.hours.reduce((s, h) => s + h.visitas, 0)}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight">{t.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sun className="h-4 w-4 text-primary" /> Tráfico por día de la semana
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={dowData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [v, 'Páginas']} />
                      <Bar dataKey="visitas" fill="hsl(var(--primary) / 0.7)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex justify-center gap-4 text-[10px] text-muted-foreground">
                    <span>📅 Mejor día: <strong className="text-foreground">{dowData.reduce((max, d) => d.visitas > max.visitas ? d : max, dowData[0]).dia}</strong></span>
                    <span>💤 Menor: <strong className="text-foreground">{dowData.reduce((min, d) => d.visitas < min.visitas ? d : min, dowData[0]).dia}</strong></span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── PAÍSES ── */}
          {tab === 'paises' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Países de origen · {totalWithCountry} visitas geolocalizadas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {topCountries.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                    <Globe className="h-10 w-10 opacity-20" />
                    <p className="text-sm font-medium">Sin datos de país aún</p>
                    <p className="text-xs opacity-60 text-center max-w-xs px-4">
                      Los países se detectan automáticamente cuando el tráfico pasa por Cloudflare (header cf-ipcountry).
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {topCountries.map(([country, count]) => {
                      const pct = totalWithCountry > 0 ? Math.round((count / totalWithCountry) * 100) : 0;
                      return (
                        <div key={country} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                          <span className="text-lg w-8 text-center shrink-0">{countryFlag(country)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-medium text-foreground truncate">{country}</span>
                              <span className="text-sm font-bold text-foreground shrink-0">{count}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── LEADS ── */}
          {tab === 'leads' && (
            <WebLeadsInboundPanel
              totalLeads={totalLeads}
              webLeadsCount={webLeadsCount}
              portalLeadsCount={portalLeadsCount}
              fbLeadsCount={fbLeadsCount}
              convRate={convRate}
              leadsWithoutFollowUp={leadsWithoutFollowUp}
              leadsWithOpenTasks={leadsWithOpenTasks}
              leadsWithVisits={leadsWithVisits}
              leadsWithOffers={leadsWithOffers}
              leadsWithoutProperty={leadsWithoutProperty}
              generalInquiryCount={generalInquiryCount}
              discardedLeads={discardedLeads}
              topLossReasons={topLossReasons}
              channelFunnel={channelFunnel}
              leadsLoading={leadsLoading}
              filteredLeadsCount={filteredLeads.length}
              visibleLeads={visibleLeads}
              leadFilter={leadFilter}
              setLeadFilter={setLeadFilter}
              leadSourceFilter={leadSourceFilter}
              setLeadSourceFilter={setLeadSourceFilter}
              leadOriginFilter={leadOriginFilter}
              setLeadOriginFilter={setLeadOriginFilter}
              onDiscardLead={handleDiscardLead}
            />
          )}

          {/* ── EXCLUSIONES ── */}
          {tab === 'exclusiones' && (
            <WebLeadsExclusionsPanel
              exclusions={exclusions}
              newExcType={newExcType}
              setNewExcType={setNewExcType}
              newExcValue={newExcValue}
              setNewExcValue={setNewExcValue}
              newExcLabel={newExcLabel}
              setNewExcLabel={setNewExcLabel}
              addExclusion={addExclusion}
              removeExclusion={removeExclusion}
              savingExc={savingExc}
            />
          )}
        </>
      )}
    </div>
  );
}
