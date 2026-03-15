import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Monitor, Tablet, Link2, Globe, ArrowUpRight, Calendar, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LinkInBioOverviewPanel } from '@/components/linkinbio/LinkInBioOverviewPanel';
import { LINK_IN_BIO_COLORS as COLORS, LINK_IN_BIO_RANGE_OPTIONS as RANGE_OPTIONS, formatLinkName, useLinkInBioStats } from '@/hooks/useLinkInBioStats';

export default function LinkInBioStats() {
  const {
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
  } = useLinkInBioStats();

  const DeviceIcon = ({ device }: { device: string }) => {
    if (device === 'mobile') return <Smartphone className="h-4 w-4" />;
    if (device === 'tablet') return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" />
            Estadísticas Link In Bio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canViewAll ? 'Todas las tarjetas de agentes' : 'Tu tarjeta personal'}
          </p>
        </div>
        <div className="flex gap-2">
          {canViewAll && (
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="empresa">🏢 Empresa (RRSS)</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <LinkInBioOverviewPanel
        agentProfile={agentProfile}
        pageviews={pageviews.length}
        uniqueSessions={uniqueSessions}
        clicks={clicks.length}
        ctr={ctr}
      />

      {/* Charts */}
      <Tabs defaultValue="trend" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trend">Tendencia</TabsTrigger>
          <TabsTrigger value="links">Por Enlace</TabsTrigger>
          <TabsTrigger value="sources">Fuentes</TabsTrigger>
          {canViewAll && <TabsTrigger value="agents">Por Agente</TabsTrigger>}
        </TabsList>

        <TabsContent value="trend">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visitas y clics diarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" name="Visitas" stroke="hsl(25, 84%, 53%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="clicks" name="Clics" stroke="hsl(200, 70%, 50%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Clics por enlace</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clicksByLink} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Clics" fill="hsl(25, 84%, 53%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dispositivos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {deviceData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sources">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Referrers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {referrers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin datos de referrer</p>
                ) : (
                  <div className="space-y-3">
                    {referrers.map((r, i) => (
                      <div key={r.name} className="flex items-center justify-between">
                        <span className="text-sm truncate flex-1">{r.name}</span>
                        <Badge variant="secondary">{r.value}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" /> Campañas UTM
                </CardTitle>
              </CardHeader>
              <CardContent>
                {utmSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sin campañas UTM detectadas</p>
                ) : (
                  <div className="space-y-3">
                    {utmSources.map(u => (
                      <div key={u.name} className="flex items-center justify-between">
                        <span className="text-sm truncate flex-1">{u.name}</span>
                        <Badge variant="secondary">{u.value}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {canViewAll && (
          <TabsContent value="agents">
            <div className="space-y-4">
              {/* Link in Bio performance table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Rendimiento Link in Bio por agente</CardTitle>
                  <p className="text-xs text-muted-foreground">Visitas y clics en la tarjeta de cada agente</p>
                </CardHeader>
                <CardContent>
                  {byAgent.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Sin datos todavía</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Agente</th>
                            <th className="text-right py-2 font-medium">Visitas tarjeta</th>
                            <th className="text-right py-2 font-medium">Clics</th>
                            <th className="text-right py-2 font-medium">CTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byAgent.map(a => (
                            <tr key={a.slug} className="border-b last:border-0">
                              <td className="py-2 font-medium">{a.slug === 'empresa' ? '🏢 Empresa (RRSS)' : (agents.find(ag => ag.public_slug === a.slug)?.full_name || a.slug)}</td>
                              <td className="py-2 text-right">{a.views.toLocaleString()}</td>
                              <td className="py-2 text-right">{a.clicks.toLocaleString()}</td>
                              <td className="py-2 text-right">{a.views > 0 ? ((a.clicks / a.views) * 100).toFixed(1) : '0'}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Web attribution section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Atribución Web
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Visitas a tus webs (Legado Colección, etc.) que llegaron desde la tarjeta de cada agente · {totalWebAttributed} visitas · {totalWebSessions} sesiones
                  </p>
                </CardHeader>
                <CardContent>
                  {webByAgent.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Aún no hay visitas web atribuidas. Cuando alguien haga clic en un enlace de la tarjeta y visite tu web, aparecerá aquí.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {webByAgent.map((a, idx) => {
                        const agentName = agents.find(ag => ag.public_slug === a.slug)?.full_name || a.slug;
                        return (
                        <div key={a.slug} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground" style={{ background: COLORS[idx % COLORS.length] }}>
                                  {(agentName || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm">{agentName}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-right">
                                <div>
                                  <p className="text-lg font-bold">{a.views}</p>
                                  <p className="text-xs text-muted-foreground">pageviews</p>
                                </div>
                                <div>
                                  <p className="text-lg font-bold">{a.uniqueVisitors}</p>
                                  <p className="text-xs text-muted-foreground">sesiones</p>
                                </div>
                              </div>
                            </div>
                            {a.topPages.length > 0 && (
                              <div className="pl-11">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Páginas visitadas:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {a.topPages.map(([page, count]) => (
                                    <Badge key={page} variant="outline" className="text-xs font-mono">
                                      {page} <span className="ml-1 text-muted-foreground">×{count}</span>
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Actividad reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin eventos todavía</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recent.map(e => (
                <div key={e.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                  <DeviceIcon device={e.device || 'desktop'} />
                  <Badge variant={e.event_type === 'click' ? 'default' : 'secondary'} className="text-xs">
                    {e.event_type === 'click' ? 'Clic' : 'Vista'}
                  </Badge>
                  {canViewAll && (
                    <span className="text-muted-foreground truncate max-w-24">{e.agent_slug}</span>
                  )}
                  {e.link_id && (
                    <span className="font-medium truncate">{formatLinkName(e.link_id)}</span>
                  )}
                  <span className="text-muted-foreground ml-auto whitespace-nowrap text-xs">
                    {format(new Date(e.created_at), 'dd MMM HH:mm', { locale: es })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
