import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Euro, CheckCircle, Award, TrendingUp, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getSemesterRange, fmt } from '@/lib/commissions';
import { toast } from 'sonner';
import AgentLeaderboard from '@/components/AgentLeaderboard';
import { notifyERP } from '@/lib/erp-sync';

interface Commission {
  id: string;
  property_id: string | null;
  agent_id: string;
  listing_origin_agent_id: string | null;
  listing_field_agent_id: string | null;
  buying_origin_agent_id: string | null;
  buying_field_agent_id: string | null;
  sale_price: number;
  agency_commission: number;
  agent_base_pct: number;
  agent_total: number;
  listing_pct: number;
  buying_pct: number;
  listing_amount: number;
  buying_amount: number;
  listing_origin_amount: number;
  listing_field_amount: number;
  buying_origin_amount: number;
  buying_field_amount: number;
  horus_bonus: boolean;
  status: string;
  notes: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  borrador: 'bg-muted text-muted-foreground',
  aprobado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pagado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const AdminCommissions = () => {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [agents, setAgents] = useState<{ user_id: string; full_name: string }[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const semester = getSemesterRange();

  const fetchAll = async () => {
    const [commRes, agentsRes, propsRes] = await Promise.all([
      supabase.from('commissions').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name'),
      supabase.from('properties').select('id, title'),
    ]);
    setCommissions((commRes.data as Commission[]) || []);
    setAgents(agentsRes.data || []);
    setProperties(propsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('commissions').update({ status } as any).eq('id', id);
    fetchAll();
    toast.success(`Estado actualizado a ${status}`);

    // Notify Faktura when a commission is approved
    if (status === 'aprobado') {
      const c = commissions.find(x => x.id === id);
      if (c) {
        notifyERP('commission_approved', {
          commission_id: c.id,
          property_title: getPropertyTitle(c.property_id),
          sale_price: c.sale_price,
          agency_commission: c.agency_commission,
          agent_total: c.agent_total,
          agent_name: getAgentName(c.agent_id),
          horus_bonus: c.horus_bonus,
          created_at: c.created_at,
        });
      }
    }
  };

  const getAgentName = (id: string | null) => {
    if (!id) return '—';
    return agents.find(a => a.user_id === id)?.full_name || 'Asesor';
  };

  const getPropertyTitle = (id: string | null) => {
    if (!id) return 'Sin inmueble';
    return properties.find(p => p.id === id)?.title || 'Inmueble';
  };

  const filtered = filterStatus === 'all' ? commissions : commissions.filter(c => c.status === filterStatus);
  const totalAgency = commissions.filter(c => c.status !== 'borrador').reduce((s, c) => s + c.agency_commission, 0);
  const totalPaid = commissions.filter(c => c.status === 'pagado').reduce((s, c) => s + c.agent_total, 0);
  const pendingCount = commissions.filter(c => c.status === 'borrador').length;

  if (loading) return <div className="py-12 text-center text-muted-foreground">Cargando comisiones...</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Euro className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{fmt(totalAgency)}</p>
              <p className="text-xs text-muted-foreground">Total agencia (aprobadas)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{fmt(totalPaid)}</p>
              <p className="text-xs text-muted-foreground">Pagado a asesores</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pendientes de aprobación</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <AgentLeaderboard />

      {/* Filter & List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" />Todas las comisiones
            </CardTitle>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="aprobado">Aprobadas</SelectItem>
                <SelectItem value="pagado">Pagadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay comisiones con este filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2 font-medium">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium">Inmueble</th>
                    <th className="text-right py-3 px-2 font-medium">Precio</th>
                    <th className="text-left py-3 px-2 font-medium">Listing</th>
                    <th className="text-left py-3 px-2 font-medium">Buying</th>
                    <th className="text-right py-3 px-2 font-medium">Total asesor</th>
                    <th className="text-center py-3 px-2 font-medium">Horus</th>
                    <th className="text-center py-3 px-2 font-medium">Estado</th>
                    <th className="text-center py-3 px-2 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-2">{format(new Date(c.created_at), 'dd MMM yy', { locale: es })}</td>
                      <td className="py-3 px-2 max-w-[150px] truncate">{getPropertyTitle(c.property_id)}</td>
                      <td className="text-right py-3 px-2">{fmt(c.sale_price)}</td>
                      <td className="py-3 px-2">
                        <div className="text-xs space-y-0.5">
                          <div><span className="text-muted-foreground">Origen:</span> {getAgentName(c.listing_origin_agent_id)} <span className="font-medium">{fmt(c.listing_origin_amount)}</span></div>
                          <div><span className="text-muted-foreground">Campo:</span> {getAgentName(c.listing_field_agent_id)} <span className="font-medium">{fmt(c.listing_field_amount)}</span></div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs space-y-0.5">
                          <div><span className="text-muted-foreground">Origen:</span> {getAgentName(c.buying_origin_agent_id)} <span className="font-medium">{fmt(c.buying_origin_amount)}</span></div>
                          <div><span className="text-muted-foreground">Campo:</span> {getAgentName(c.buying_field_agent_id)} <span className="font-medium">{fmt(c.buying_field_amount)}</span></div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 font-semibold text-primary">{fmt(c.agent_total)}</td>
                      <td className="text-center py-3 px-2">
                        {c.horus_bonus ? <Award className="h-4 w-4 text-amber-500 mx-auto" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="text-center py-3 px-2">
                        <Badge className={statusColors[c.status] || ''}>{c.status}</Badge>
                      </td>
                      <td className="text-center py-3 px-2">
                        {c.status === 'borrador' && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, 'aprobado')}>Aprobar</Button>}
                        {c.status === 'aprobado' && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, 'pagado')}><CheckCircle className="h-3 w-3 mr-1" />Pagar</Button>}
                        {c.status === 'pagado' && <span className="text-xs text-emerald-600">✓ Pagado</span>}
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

export default AdminCommissions;
