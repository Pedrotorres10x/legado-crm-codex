import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Target, Users, UserCheck, UserX, HelpCircle, Send, Banknote, MapPin, AlertTriangle, Snowflake, TrendingUp, BarChart3, Shuffle, Mail, MessageSquare, Clock, Power, PowerOff, Reply, Percent, ArrowUpRight, ArrowDownLeft, Zap } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { CampaignSummaryCards } from '@/components/campaigns/CampaignSummaryCards';
import { CampaignChartsPanel } from '@/components/campaigns/CampaignChartsPanel';
import { CampaignEngagementPanel } from '@/components/campaigns/CampaignEngagementPanel';

interface CampaignEngagement {
  source: string;
  label: string;
  icon: string;
  outbound_total: number;
  outbound_email: number;
  outbound_whatsapp: number;
  inbound_total: number;
  inbound_email: number;
  inbound_whatsapp: number;
  classified: number;
  revision: number;
  errors: number;
  response_rate: number;
  first_sent: string | null;
  last_sent: string | null;
}

const COLORS = {
  success: 'hsl(var(--primary))',
  warning: 'hsl(45, 93%, 47%)',
  danger: 'hsl(0, 72%, 51%)',
  info: 'hsl(221, 83%, 53%)',
  muted: 'hsl(var(--muted-foreground))',
  accent: 'hsl(280, 67%, 55%)',
  cyan: 'hsl(190, 80%, 45%)',
};

interface ClassifyStats {
  pending_send: number;
  sent_pending: number;
  comprador: number;
  prospecto: number;
  inactivo: number;
  needs_review: number;
}

interface EnrichStats {
  total_incomplete: number;
  missing_budget: number;
  missing_zone: number;
  pending_response: number;
  enriched: number;
  no_response: number;
  nevera: number;
}

interface CrucesStats {
  enabled: boolean;
  lastRun: string | null;
  emailsSent: number;
  emailsFailed: number;
  whatsappSent: number;
  matchesCreated: number;
  contactsProcessed: number;
  durationMs: number | null;
  errors: string[];
}

const CampaignDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // Campaign enabled settings
  const { data: campaignSettings } = useQuery({
    queryKey: ['campaign-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['campaign_classify_enabled', 'campaign_enrich_enabled', 'match_sender_enabled']);
      const map: Record<string, boolean> = {};
      (data || []).forEach((r: any) => {
        map[r.key] = r.value === true || r.value === 'true';
      });
      return map;
    },
  });

  const isEnabled = (key: string) => campaignSettings?.[key] ?? false;

  const handleToggle = async (key: string, newValue: boolean) => {
    setTogglingKey(key);
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value: newValue } as any, { onConflict: 'key' });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: newValue ? '✅ Campaña activada' : '⏸️ Campaña pausada' });
      queryClient.invalidateQueries({ queryKey: ['campaign-settings'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-dashboard-cruces'] });
    }
    setTogglingKey(null);
  };
  // Classification campaign stats
  const { data: classifyStats, isLoading: classifyLoading } = useQuery({
    queryKey: ['campaign-dashboard-classify'],
    queryFn: async (): Promise<ClassifyStats> => {
      const [
        { count: pendingSend },
        { count: sentPending },
        { count: comprador },
        { count: prospecto },
        { count: inactivo },
        { count: needsReview },
      ] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('contact_type', 'contacto')
          .not('tags', 'cs', '{clasificacion-pendiente}')
          .not('tags', 'cs', '{clasificado-campana}'),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['clasificacion-pendiente']),
        supabase.from('communication_logs').select('id', { count: 'exact', head: true })
          .eq('source', 'campaign_classify')
          .eq('status', 'clasificado')
          .contains('metadata', { classification: 'comprador' } as any),
        supabase.from('communication_logs').select('id', { count: 'exact', head: true })
          .eq('source', 'campaign_classify')
          .eq('status', 'clasificado')
          .contains('metadata', { classification: 'prospecto' } as any),
        supabase.from('communication_logs').select('id', { count: 'exact', head: true })
          .eq('source', 'campaign_classify')
          .eq('status', 'clasificado')
          .contains('metadata', { classification: 'inactivo' } as any),
        supabase.from('communication_logs').select('id', { count: 'exact', head: true })
          .eq('source', 'campaign_classify')
          .eq('status', 'revision_manual'),
      ]);

      return {
        pending_send: pendingSend || 0,
        sent_pending: sentPending || 0,
        comprador: comprador || 0,
        prospecto: prospecto || 0,
        inactivo: inactivo || 0,
        needs_review: needsReview || 0,
      };
    },
    refetchInterval: 60000,
  });

  // Enrichment campaign stats
  const { data: enrichStats, isLoading: enrichLoading } = useQuery({
    queryKey: ['campaign-dashboard-enrich'],
    queryFn: async (): Promise<EnrichStats> => {
      const { data: demands } = await supabase
        .from('demands')
        .select('id, max_price, cities')
        .eq('is_active', true);

      const allDemands = demands || [];
      const incomplete = allDemands.filter(d => d.max_price == null || !d.cities?.length);

      const [
        { count: pendingResponse },
        { count: enriched },
        { count: noResponse },
        { count: nevera },
      ] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['demanda-enrich-pendiente']),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['demanda-enriquecida']),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['demanda-enrich-sin-respuesta']),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['nevera']),
      ]);

      return {
        total_incomplete: incomplete.length,
        missing_budget: allDemands.filter(d => d.max_price == null).length,
        missing_zone: allDemands.filter(d => !d.cities?.length).length,
        pending_response: pendingResponse || 0,
        enriched: enriched || 0,
        no_response: noResponse || 0,
        nevera: nevera || 0,
      };
    },
    refetchInterval: 60000,
  });

  // Cruces (matching engine) stats
  const { data: crucesStats, isLoading: crucesLoading } = useQuery({
    queryKey: ['campaign-dashboard-cruces'],
    queryFn: async (): Promise<CrucesStats> => {
      const [settingResult, logsResult] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'match_sender_enabled').maybeSingle(),
        supabase.from('match_sender_logs').select('*').order('run_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const enabled = settingResult.data?.value === true || settingResult.data?.value === 'true';
      const log = logsResult.data;

      return {
        enabled,
        lastRun: log?.run_at || null,
        emailsSent: log?.emails_sent || 0,
        emailsFailed: log?.emails_failed || 0,
        whatsappSent: log?.whatsapp_sent || 0,
        matchesCreated: log?.matches_created || 0,
        contactsProcessed: log?.contacts_processed || 0,
        durationMs: log?.duration_ms || null,
        errors: (log?.errors as string[]) || [],
      };
    },
    refetchInterval: 60000,
  });

  // ── Engagement stats per campaign source ──
  const CAMPAIGN_SOURCES = [
    { source: 'campaign_classify', label: 'Clasificación', icon: 'megaphone' },
    { source: 'campaign_demand_enrich', label: 'Enriquecimiento', icon: 'target' },
    { source: 'campaign_qualify', label: 'Cualificación', icon: 'users' },
    { source: 'campaign_demand_followup', label: 'Follow-up demanda', icon: 'reply' },
  ];

  const { data: engagementStats } = useQuery({
    queryKey: ['campaign-engagement-stats'],
    queryFn: async (): Promise<CampaignEngagement[]> => {
      const results: CampaignEngagement[] = [];

      for (const src of CAMPAIGN_SOURCES) {
        const [
          { count: outTotal },
          { count: outEmail },
          { count: outWhatsapp },
          { count: inTotal },
          { count: inEmail },
          { count: inWhatsapp },
          { count: classified },
          { count: revision },
          { count: errors },
          { data: firstRow },
          { data: lastRow },
        ] = await Promise.all([
          supabase.from('communication_logs').select('id', { count: 'exact', head: true })
            .eq('source', src.source).eq('direction', 'outbound'),
          supabase.from('communication_logs').select('id', { count: 'exact', head: true })
            .eq('source', src.source).eq('direction', 'outbound').eq('channel', 'email'),
          supabase.from('communication_logs').select('id', { count: 'exact', head: true })
            .eq('source', src.source).eq('direction', 'outbound').eq('channel', 'whatsapp'),
          supabase.from('communication_logs').select('id', { count: 'exact', head: true })
            .eq('source', src.source).eq('direction', 'inbound'),
          supabase.from('communication_logs').select('id', { count: 'exact', head: true })
            .eq('source', src.source).eq('direction', 'inbound').eq('channel', 'email'),
          supabase.from('communication_logs').select('id', { count: 'exact', head: true })
            .eq('source', src.source).eq('direction', 'inbound').eq('channel', 'whatsapp'),
          supabase.from('communication_logs').select('id', { count: 'exact', head: true })
            .eq('source', src.source).eq('status', 'clasificado'),
          supabase.from('communication_logs').select('id', { count: 'exact', head: true })
            .eq('source', src.source).eq('status', 'revision_manual'),
          supabase.from('communication_logs').select('id', { count: 'exact', head: true })
            .eq('source', src.source).eq('status', 'error'),
          supabase.from('communication_logs').select('created_at')
            .eq('source', src.source).eq('direction', 'outbound')
            .order('created_at', { ascending: true }).limit(1).maybeSingle(),
          supabase.from('communication_logs').select('created_at')
            .eq('source', src.source).eq('direction', 'outbound')
            .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        const out = outTotal || 0;
        const inn = inTotal || 0;

        results.push({
          ...src,
          outbound_total: out,
          outbound_email: outEmail || 0,
          outbound_whatsapp: outWhatsapp || 0,
          inbound_total: inn,
          inbound_email: inEmail || 0,
          inbound_whatsapp: inWhatsapp || 0,
          classified: classified || 0,
          revision: revision || 0,
          errors: errors || 0,
          response_rate: out > 0 ? Math.round((inn / out) * 100) : 0,
          first_sent: firstRow?.created_at || null,
          last_sent: lastRow?.created_at || null,
        });
      }

      return results;
    },
    refetchInterval: 120000,
  });

  // ── Match emails engagement ──
  const { data: matchEmailStats } = useQuery({
    queryKey: ['campaign-match-email-stats'],
    queryFn: async () => {
      const [
        { count: totalSent },
        { count: sentOk },
        { count: sentFailed },
        { data: recentLogs },
      ] = await Promise.all([
        supabase.from('match_emails').select('id', { count: 'exact', head: true }),
        supabase.from('match_emails').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
        supabase.from('match_emails').select('id', { count: 'exact', head: true }).eq('status', 'error'),
        supabase.from('match_sender_logs')
          .select('run_at, emails_sent, emails_failed, whatsapp_sent, matches_created, contacts_processed')
          .order('run_at', { ascending: false }).limit(10),
      ]);

      return {
        total_sent: totalSent || 0,
        sent_ok: sentOk || 0,
        sent_failed: sentFailed || 0,
        delivery_rate: (totalSent || 0) > 0 ? Math.round(((sentOk || 0) / (totalSent || 1)) * 100) : 0,
        recent_runs: recentLogs || [],
      };
    },
    refetchInterval: 120000,
  });

  const classifyTotal = useMemo(() => {
    if (!classifyStats) return 0;
    return classifyStats.pending_send + classifyStats.sent_pending + classifyStats.comprador + classifyStats.prospecto + classifyStats.inactivo + classifyStats.needs_review;
  }, [classifyStats]);

  const classifyProcessed = useMemo(() => {
    if (!classifyStats) return 0;
    return classifyStats.comprador + classifyStats.prospecto + classifyStats.inactivo;
  }, [classifyStats]);

  const classifyProgress = classifyTotal > 0 ? Math.round((classifyProcessed / classifyTotal) * 100) : 0;

  const enrichPendingSend = useMemo(() => {
    if (!enrichStats) return 0;
    return Math.max(0, enrichStats.total_incomplete - enrichStats.pending_response - enrichStats.enriched - enrichStats.no_response - enrichStats.nevera);
  }, [enrichStats]);

  const enrichTotal = useMemo(() => {
    if (!enrichStats) return 0;
    return enrichStats.total_incomplete;
  }, [enrichStats]);

  const enrichProgress = enrichTotal > 0 ? Math.round(((enrichStats?.enriched || 0) / enrichTotal) * 100) : 0;

  const classifyPieData = useMemo(() => {
    if (!classifyStats) return [];
    return [
      { name: 'Compradores', value: classifyStats.comprador, color: COLORS.success },
      { name: 'Prospectos', value: classifyStats.prospecto, color: COLORS.warning },
      { name: 'Inactivos', value: classifyStats.inactivo, color: COLORS.danger },
      { name: 'Revisión', value: classifyStats.needs_review, color: COLORS.accent },
      { name: 'Esperando', value: classifyStats.sent_pending, color: COLORS.info },
      { name: 'Pendientes', value: classifyStats.pending_send, color: COLORS.muted },
    ].filter(d => d.value > 0);
  }, [classifyStats]);

  const enrichPieData = useMemo(() => {
    if (!enrichStats) return [];
    return [
      { name: 'Enriquecidas', value: enrichStats.enriched, color: COLORS.success },
      { name: 'Esperando', value: enrichStats.pending_response, color: COLORS.info },
      { name: 'Sin respuesta', value: enrichStats.no_response, color: COLORS.danger },
      { name: 'Nevera', value: enrichStats.nevera, color: COLORS.cyan },
      { name: 'Pendientes', value: enrichPendingSend, color: COLORS.muted },
    ].filter(d => d.value > 0);
  }, [enrichStats, enrichPendingSend]);

  const comparisonData = useMemo(() => {
    if (!classifyStats || !enrichStats) return [];
    return [
      {
        name: 'Clasificación',
        Procesados: classifyProcessed,
        Pendientes: classifyStats.pending_send + classifyStats.sent_pending + classifyStats.needs_review,
      },
      {
        name: 'Enriquecimiento',
        Procesados: enrichStats.enriched,
        Pendientes: enrichPendingSend + enrichStats.pending_response + enrichStats.no_response,
      },
      ...(crucesStats ? [{
        name: 'Cruces',
        Procesados: crucesStats.emailsSent + crucesStats.whatsappSent,
        Pendientes: crucesStats.emailsFailed,
      }] : []),
    ];
  }, [classifyStats, enrichStats, crucesStats, classifyProcessed, enrichPendingSend]);

  const isLoading = classifyLoading || enrichLoading || crucesLoading;

  return (
    <div className="space-y-6">
      <CampaignSummaryCards
        isLoading={isLoading}
        classifyStats={classifyStats}
        enrichStats={enrichStats}
        crucesStats={crucesStats}
        classifyProgress={classifyProgress}
        enrichProgress={enrichProgress}
        isEnabled={isEnabled}
        togglingKey={togglingKey}
        onToggle={handleToggle}
      />

      <CampaignChartsPanel
        classifyPieData={classifyPieData}
        enrichPieData={enrichPieData}
        comparisonData={comparisonData}
        successColor={COLORS.success}
        mutedColor={COLORS.muted}
      />

      <CampaignEngagementPanel
        engagementStats={engagementStats}
        infoColor={COLORS.info}
        successColor={COLORS.success}
        accentColor={COLORS.accent}
        dangerColor={COLORS.danger}
      />

      {/* ── Match Emails Stats ── */}
      {matchEmailStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" /> Emails de cruces — Resumen acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{matchEmailStats.total_sent}</p>
                <p className="text-xs text-muted-foreground">Total enviados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{matchEmailStats.sent_ok}</p>
                <p className="text-xs text-muted-foreground">Entregados OK</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{matchEmailStats.sent_failed}</p>
                <p className="text-xs text-muted-foreground">Fallidos</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{matchEmailStats.delivery_rate}%</p>
                <p className="text-xs text-muted-foreground">Tasa de entrega</p>
              </div>
            </div>
            {matchEmailStats.recent_runs.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium mb-2">Últimas 10 ejecuciones</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={matchEmailStats.recent_runs.reverse().map((r: any) => ({
                    fecha: format(new Date(r.run_at), 'dd/MM'),
                    Emails: r.emails_sent,
                    WhatsApp: r.whatsapp_sent,
                    Fallidos: r.emails_failed,
                  }))}>
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="Emails" fill={COLORS.info} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="WhatsApp" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Fallidos" fill={COLORS.danger} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CampaignDashboard;
