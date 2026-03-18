import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Users, Calendar, BarChart2, Minus } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

type PortalLead = {
  id: string;
  portal_name: string;
  contact_id: string | null;
  property_id: string | null;
  status: string;
  created_at: string;
};

const PORTAL_COLORS: Record<string, string> = {
  idealista: '#1FC780',
  fotocasa: '#E4002B',
  todopisos: '#FF6B00',
  'pisos.com': '#0066CC',
  '1001portales': '#8B5CF6',
  otro: '#94A3B8',
};

const PORTAL_LABELS: Record<string, string> = {
  idealista: 'Portal legacy',
  fotocasa: 'Fotocasa',
  todopisos: 'TodoPisos',
  'pisos.com': 'Pisos.com',
  '1001portales': '1001 Portales',
  otro: 'Otro',
};

function usePortalLeads() {
  return useQuery({
    queryKey: ['portal-leads-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_leads')
        .select('id, portal_name, contact_id, property_id, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalLead[];
    },
    refetchInterval: 60_000,
  });
}

function useContactStages(contactIds: string[]) {
  return useQuery({
    queryKey: ['portal-lead-stages', contactIds.length],
    queryFn: async () => {
      if (contactIds.length === 0) return [];
      // Fetch in batches of 100
      const results: { id: string; pipeline_stage: string | null }[] = [];
      for (let i = 0; i < contactIds.length; i += 100) {
        const batch = contactIds.slice(i, i + 100);
        const { data } = await supabase
          .from('contacts')
          .select('id, pipeline_stage')
          .in('id', batch);
        if (data) results.push(...data);
      }
      return results;
    },
    enabled: contactIds.length > 0,
  });
}

export default function PortalLeadStats() {
  const { data: leads = [], isLoading } = usePortalLeads();
  const contactIds = [...new Set(leads.map(l => l.contact_id).filter(Boolean))] as string[];
  const { data: stages = [] } = useContactStages(contactIds);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Estadísticas de Leads por Portal</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><div className="h-16 animate-pulse bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Estadísticas de Leads por Portal</h2>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Aún no se han recibido leads desde portales.</p>
            <p className="text-sm mt-1">Configura el email <code>portal-lead@inbound.planhogar.es</code> en tus portales.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const thisMonth = leads.filter(l => new Date(l.created_at) >= thisMonthStart);
  const lastMonth = leads.filter(l => {
    const d = new Date(l.created_at);
    return d >= lastMonthStart && d <= lastMonthEnd;
  });

  const pctChange = lastMonth.length > 0
    ? Math.round(((thisMonth.length - lastMonth.length) / lastMonth.length) * 100)
    : thisMonth.length > 0 ? 100 : 0;

  // Conversion: contacts that advanced past 'nuevo'
  const stageMap = new Map(stages.map(s => [s.id, s.pipeline_stage]));
  const advancedStages = ['contactado', 'visita', 'oferta', 'negociacion', 'cerrado'];
  const converted = contactIds.filter(id => {
    const stage = stageMap.get(id);
    return stage && advancedStages.includes(stage);
  });
  const conversionRate = contactIds.length > 0
    ? Math.round((converted.length / contactIds.length) * 100)
    : 0;

  // Per-portal stats
  const portalMap = new Map<string, PortalLead[]>();
  for (const l of leads) {
    const arr = portalMap.get(l.portal_name) || [];
    arr.push(l);
    portalMap.set(l.portal_name, arr);
  }

  const portalStats = [...portalMap.entries()]
    .map(([name, items]) => {
      const thisMonthCount = items.filter(i => new Date(i.created_at) >= thisMonthStart).length;
      const lastLead = items[0]; // already sorted desc
      const portalContactIds = [...new Set(items.map(i => i.contact_id).filter(Boolean))] as string[];
      const portalConverted = portalContactIds.filter(id => {
        const stage = stageMap.get(id);
        return stage && advancedStages.includes(stage);
      });
      return {
        name,
        label: PORTAL_LABELS[name] || name.charAt(0).toUpperCase() + name.slice(1),
        total: items.length,
        thisMonth: thisMonthCount,
        lastLead: lastLead?.created_at,
        conversion: portalContactIds.length > 0
          ? Math.round((portalConverted.length / portalContactIds.length) * 100)
          : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Chart data: last 6 months stacked by portal
  const portals = [...portalMap.keys()];
  const chartData: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = endOfMonth(subMonths(now, i));
    const label = format(monthStart, 'MMM yy', { locale: es });
    const row: any = { month: label };
    for (const p of portals) {
      const items = portalMap.get(p) || [];
      row[p] = items.filter(l => {
        const d = new Date(l.created_at);
        return d >= monthStart && d <= monthEnd;
      }).length;
    }
    chartData.push(row);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Estadísticas de Leads por Portal</h2>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leads.length}</div>
            <p className="text-xs text-muted-foreground">Histórico completo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Este mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisMonth.length}</div>
            <div className="flex items-center gap-1 text-xs">
              {pctChange > 0 ? (
                <><TrendingUp className="h-3 w-3 text-green-600" /><span className="text-green-600">+{pctChange}%</span></>
              ) : pctChange < 0 ? (
                <><TrendingDown className="h-3 w-3 text-red-600" /><span className="text-red-600">{pctChange}%</span></>
              ) : (
                <><Minus className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">0%</span></>
              )}
              <span className="text-muted-foreground">vs mes anterior ({lastMonth.length})</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasa conversión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">{converted.length} de {contactIds.length} contactos avanzaron</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Portales activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portals.length}</div>
            <p className="text-xs text-muted-foreground">con leads recibidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart2 className="h-4 w-4" /> Evolución últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip />
                <Legend />
                {portals.map(p => (
                  <Bar
                    key={p}
                    dataKey={p}
                    name={PORTAL_LABELS[p] || p}
                    stackId="a"
                    fill={PORTAL_COLORS[p] || '#94A3B8'}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-portal table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Detalle por portal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">Portal</th>
                  <th className="text-right px-4 py-2.5 font-medium">Total</th>
                  <th className="text-right px-4 py-2.5 font-medium">Este mes</th>
                  <th className="text-right px-4 py-2.5 font-medium">Conversión</th>
                  <th className="text-right px-4 py-2.5 font-medium">Último lead</th>
                </tr>
              </thead>
              <tbody>
                {portalStats.map(ps => (
                  <tr key={ps.name} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PORTAL_COLORS[ps.name] || '#94A3B8' }}
                        />
                        <span className="font-medium">{ps.label}</span>
                      </div>
                    </td>
                    <td className="text-right px-4 py-2.5 font-mono">{ps.total}</td>
                    <td className="text-right px-4 py-2.5 font-mono">{ps.thisMonth}</td>
                    <td className="text-right px-4 py-2.5">
                      <Badge variant={ps.conversion >= 30 ? 'default' : ps.conversion >= 10 ? 'secondary' : 'outline'}>
                        {ps.conversion}%
                      </Badge>
                    </td>
                    <td className="text-right px-4 py-2.5 text-muted-foreground">
                      {ps.lastLead ? (
                        <span className="flex items-center justify-end gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(ps.lastLead), 'dd MMM yyyy', { locale: es })}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
