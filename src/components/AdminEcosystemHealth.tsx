import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HeartPulse, Users, AlertTriangle, Clock } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const STALE_DAYS = 30;
const NO_LEAD_DAYS = 21;
const UNTOUCH_DAYS = 14;

type TrafficColor = 'green' | 'yellow' | 'red';

const getTrafficColor = (problemCount: number, total: number): TrafficColor => {
  if (total === 0) return 'green';
  const pct = problemCount / total;
  if (pct <= 0.1) return 'green';
  if (pct <= 0.3) return 'yellow';
  return 'red';
};

const trafficDot: Record<TrafficColor, string> = {
  green: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
  yellow: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  red: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
};

interface AgentHealth {
  agentId: string;
  agentName: string;
  staleCount: number;
  noLeadCount: number;
  untouchedCount: number;
  totalProperties: number;
  totalContacts: number;
  healthScore: number;
  propColor: TrafficColor;
  contactColor: TrafficColor;
}


const AdminEcosystemHealth = () => {
  const [agentHealths, setAgentHealths] = useState<AgentHealth[]>([]);
  const [globalScore, setGlobalScore] = useState(100);
  const [globalStats, setGlobalStats] = useState({ stale: 0, noLead: 0, untouched: 0, totalProps: 0, totalContacts: 0 });
  const [globalPropColor, setGlobalPropColor] = useState<TrafficColor>('green');
  const [globalContactColor, setGlobalContactColor] = useState<TrafficColor>('green');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllHealth();
  }, []);

  const fetchAllHealth = async () => {
    const now = new Date();

    const [propsRes, matchesRes, visitsRes, contactsRes, interactionsRes, profilesRes] = await Promise.all([
      supabase.from('properties').select('id, title, agent_id, created_at, updated_at').eq('status', 'disponible'),
      supabase.from('matches').select('property_id, created_at').order('created_at', { ascending: false }),
      supabase.from('visits').select('property_id, created_at').order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, full_name, agent_id, created_at').in('status', ['nuevo', 'en_seguimiento', 'activo']),
      supabase.from('interactions').select('contact_id, interaction_date').order('interaction_date', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name'),
    ]);

    const props = propsRes.data || [];
    const matches = matchesRes.data || [];
    const visits = visitsRes.data || [];
    const contacts = contactsRes.data || [];
    const interactions = interactionsRes.data || [];
    const profiles = profilesRes.data || [];

    const profileMap: Record<string, string> = {};
    profiles.forEach(p => { profileMap[p.user_id] = p.full_name; });

    const latestMatchByProp: Record<string, string> = {};
    matches.forEach(m => { if (!latestMatchByProp[m.property_id]) latestMatchByProp[m.property_id] = m.created_at; });
    const latestVisitByProp: Record<string, string> = {};
    visits.forEach(v => { if (!latestVisitByProp[v.property_id]) latestVisitByProp[v.property_id] = v.created_at; });
    const latestInterByContact: Record<string, string> = {};
    interactions.forEach(i => { if (!latestInterByContact[i.contact_id]) latestInterByContact[i.contact_id] = i.interaction_date; });

    const agentIds = new Set<string>();
    props.forEach(p => { if (p.agent_id) agentIds.add(p.agent_id); });
    contacts.forEach(c => { if (c.agent_id) agentIds.add(c.agent_id); });

    let totalStale = 0, totalNoLead = 0, totalUntouched = 0;

    const healths: AgentHealth[] = Array.from(agentIds).map(agentId => {
      const agentProps = props.filter(p => p.agent_id === agentId);
      const agentContacts = contacts.filter(c => c.agent_id === agentId);

      const stale = agentProps.filter(p => {
        const lm = latestMatchByProp[p.id] ? new Date(latestMatchByProp[p.id]) : null;
        const lv = latestVisitByProp[p.id] ? new Date(latestVisitByProp[p.id]) : null;
        const last = lm && lv ? (lm > lv ? lm : lv) : lm || lv || new Date(p.created_at);
        return differenceInDays(now, last) >= STALE_DAYS;
      });

      const noLead = agentProps.filter(p =>
        !latestMatchByProp[p.id] && differenceInDays(now, new Date(p.created_at)) >= NO_LEAD_DAYS
      );

      const untouched = agentContacts.filter(c => {
        const last = latestInterByContact[c.id] ? new Date(latestInterByContact[c.id]) : new Date(c.created_at);
        return differenceInDays(now, last) >= UNTOUCH_DAYS;
      });

      totalStale += stale.length;
      totalNoLead += noLead.length;
      totalUntouched += untouched.length;

      const tp = agentProps.length || 1;
      const tc = agentContacts.length || 1;
      const score = Math.max(0, Math.round(100 - (stale.length / tp) * 30 - (noLead.length / tp) * 30 - (untouched.length / tc) * 40));

      const problemProps = new Set([...stale.map(p => p.id), ...noLead.map(p => p.id)]);
      const propColor = getTrafficColor(problemProps.size, agentProps.length);
      const contactColor = getTrafficColor(untouched.length, agentContacts.length);

      return {
        agentId, agentName: profileMap[agentId] || 'Sin asignar',
        staleCount: stale.length, noLeadCount: noLead.length, untouchedCount: untouched.length,
        totalProperties: agentProps.length, totalContacts: agentContacts.length,
        healthScore: score, propColor, contactColor,
      };
    }).sort((a, b) => a.healthScore - b.healthScore);

    const totalP = props.length || 1;
    const totalC = contacts.length || 1;
    const global = Math.max(0, Math.round(100 - (totalStale / totalP) * 30 - (totalNoLead / totalP) * 30 - (totalUntouched / totalC) * 40));

    const globalProblemProps = new Set<string>();
    props.forEach(p => {
      const lm = latestMatchByProp[p.id] ? new Date(latestMatchByProp[p.id]) : null;
      const lv = latestVisitByProp[p.id] ? new Date(latestVisitByProp[p.id]) : null;
      const last = lm && lv ? (lm > lv ? lm : lv) : lm || lv || new Date(p.created_at);
      if (differenceInDays(now, last) >= STALE_DAYS || (!latestMatchByProp[p.id] && differenceInDays(now, new Date(p.created_at)) >= NO_LEAD_DAYS)) {
        globalProblemProps.add(p.id);
      }
    });

    setAgentHealths(healths);
    setGlobalScore(global);
    setGlobalStats({ stale: totalStale, noLead: totalNoLead, untouched: totalUntouched, totalProps: props.length, totalContacts: contacts.length });
    setGlobalPropColor(getTrafficColor(globalProblemProps.size, props.length));
    setGlobalContactColor(getTrafficColor(totalUntouched, contacts.length));
    setLoading(false);
  };


  if (loading) return <div className="py-12 text-center text-muted-foreground">Analizando salud del ecosistema...</div>;

  const scoreColor = (s: number) => s >= 75 ? 'text-emerald-600' : s >= 50 ? 'text-amber-500' : 'text-destructive';
  const barColor = (s: number) => s >= 75 ? 'hsl(142 71% 45%)' : s >= 50 ? 'hsl(38 92% 50%)' : 'hsl(0 84% 60%)';

  const pieData = [
    { name: 'Sin actividad', value: globalStats.stale, fill: 'hsl(38 92% 50%)' },
    { name: 'Sin leads', value: globalStats.noLead, fill: 'hsl(0 84% 60%)' },
    { name: 'Contactos fríos', value: globalStats.untouched, fill: 'hsl(25 95% 53%)' },
    { name: 'Sano', value: Math.max(0, (globalStats.totalProps + globalStats.totalContacts) - globalStats.stale - globalStats.noLead - globalStats.untouched), fill: 'hsl(142 71% 45%)' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Global semáforo + KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Global traffic lights */}
        <Card className="border-0 shadow-[var(--shadow-card)] sm:col-span-2 lg:col-span-1">
          <CardContent className="p-5 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`h-10 w-10 rounded-full ${trafficDot[globalPropColor]}`} />
              <span className="text-[11px] font-medium text-muted-foreground">Inmuebles</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`h-10 w-10 rounded-full ${trafficDot[globalContactColor]}`} />
              <span className="text-[11px] font-medium text-muted-foreground">Contactos</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <HeartPulse className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${scoreColor(globalScore)}`}>{globalScore}%</p>
              <p className="text-xs text-muted-foreground">Salud global</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{globalStats.stale + globalStats.noLead}</p>
              <p className="text-xs text-muted-foreground">Inmuebles con problemas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{globalStats.untouched}</p>
              <p className="text-xs text-muted-foreground">Contactos fríos (+{UNTOUCH_DAYS}d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-primary" />Salud por agente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agentHealths.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay datos suficientes</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, agentHealths.length * 48)}>
                <BarChart data={agentHealths} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={11} />
                  <YAxis type="category" dataKey="agentName" width={120} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Salud']} contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="healthScore" radius={[0, 6, 6, 0]} barSize={24}>
                    {agentHealths.map((entry, idx) => (
                      <Cell key={idx} fill={barColor(entry.healthScore)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />Distribución de problemas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">Sin problemas detectados ✨</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: 'hsl(var(--muted-foreground))' }} fontSize={11}>
                    {pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-agent detail table with semáforos */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />Detalle por agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agentHealths.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay agentes con datos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2 font-medium">Agente</th>
                    <th className="text-center py-3 px-2 font-medium">Salud</th>
                    <th className="text-center py-3 px-2 font-medium">🏠 Inmuebles</th>
                    <th className="text-center py-3 px-2 font-medium">👤 Contactos</th>
                    <th className="text-center py-3 px-2 font-medium">Dormidos</th>
                    <th className="text-center py-3 px-2 font-medium">Sin leads</th>
                    <th className="text-center py-3 px-2 font-medium">Fríos</th>
                  </tr>
                </thead>
                <tbody>
                  {agentHealths.map(a => (
                    <tr key={a.agentId} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2 font-medium">{a.agentName}</td>
                      <td className="text-center py-3 px-2">
                        <span className={`font-bold ${scoreColor(a.healthScore)}`}>{a.healthScore}%</span>
                      </td>
                      <td className="text-center py-3 px-2">
                        <div className="flex items-center justify-center gap-2">
                          <div className={`h-4 w-4 rounded-full ${trafficDot[a.propColor]}`} />
                          <span className="text-xs text-muted-foreground">{a.totalProperties}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        <div className="flex items-center justify-center gap-2">
                          <div className={`h-4 w-4 rounded-full ${trafficDot[a.contactColor]}`} />
                          <span className="text-xs text-muted-foreground">{a.totalContacts}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        {a.staleCount > 0 ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">{a.staleCount}</Badge>
                        ) : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-3 px-2">
                        {a.noLeadCount > 0 ? (
                          <Badge variant="outline" className="text-red-600 border-red-300">{a.noLeadCount}</Badge>
                        ) : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-3 px-2">
                        {a.untouchedCount > 0 ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">{a.untouchedCount}</Badge>
                        ) : <span className="text-muted-foreground">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default AdminEcosystemHealth;
