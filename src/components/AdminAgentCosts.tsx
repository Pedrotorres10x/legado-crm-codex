import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getSemesterRange, fmt } from '@/lib/commissions';
import { Users, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AgentCost {
  user_id: string;
  full_name: string;
  commissionsPaid: number;
  monthsInSemester: number;
  fixedCost: number;
  totalCost: number;
  agencyGenerated: number;
  profit: number;
}

const AdminAgentCosts = ({ agentMonthlyCost }: { agentMonthlyCost: number }) => {
  const [agentCosts, setAgentCosts] = useState<AgentCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const semester = getSemesterRange();
      const now = new Date();

      // Months elapsed in current semester (at least 1)
      const semesterStartMonth = semester.start.getMonth();
      const currentMonth = now.getMonth();
      const monthsElapsed = Math.max(1, currentMonth - semesterStartMonth + 1);

      const [profilesRes, commissionsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name'),
        supabase.from('commissions').select('agent_id, agent_total, agency_commission, status, listing_origin_agent_id, listing_field_agent_id, buying_origin_agent_id, buying_field_agent_id, listing_origin_amount, listing_field_amount, buying_origin_amount, buying_field_amount')
          .in('status', ['pagado'])
          .gte('created_at', semester.start.toISOString()),
      ]);

      const profiles = profilesRes.data || [];
      const comms = (commissionsRes.data || []) as any[];

      // Also get all agent user_ids from user_roles
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').eq('role', 'agent');
      const agentUserIds = new Set((roles || []).map(r => r.user_id));

      const costs: AgentCost[] = profiles
        .filter(p => agentUserIds.has(p.user_id))
        .map(p => {
          // Sum paid commissions for this agent across all roles
          let commissionsPaid = 0;
          let agencyGenerated = 0;
          for (const c of comms) {
            if (c.listing_origin_agent_id === p.user_id) commissionsPaid += c.listing_origin_amount || 0;
            if (c.listing_field_agent_id === p.user_id) commissionsPaid += c.listing_field_amount || 0;
            if (c.buying_origin_agent_id === p.user_id) commissionsPaid += c.buying_origin_amount || 0;
            if (c.buying_field_agent_id === p.user_id) commissionsPaid += c.buying_field_amount || 0;
            // Agency generated: count full agency_commission if agent was primary
            if (c.agent_id === p.user_id) agencyGenerated += c.agency_commission || 0;
          }

          const fixedCost = monthsElapsed * agentMonthlyCost;
          const totalCost = fixedCost + commissionsPaid;
          const profit = agencyGenerated - totalCost;

          return {
            user_id: p.user_id,
            full_name: p.full_name,
            commissionsPaid,
            monthsInSemester: monthsElapsed,
            fixedCost,
            totalCost,
            agencyGenerated,
            profit,
          };
        })
        .sort((a, b) => b.profit - a.profit);

      setAgentCosts(costs);
      setLoading(false);
    };
    fetchData();
  }, []);

  const semester = getSemesterRange();
  const totals = agentCosts.reduce((acc, a) => ({
    fixed: acc.fixed + a.fixedCost,
    comms: acc.comms + a.commissionsPaid,
    total: acc.total + a.totalCost,
    generated: acc.generated + a.agencyGenerated,
    profit: acc.profit + a.profit,
  }), { fixed: 0, comms: 0, total: 0, generated: 0, profit: 0 });

  if (loading) return null;

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-display">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Users className="h-4 w-4" />
          </div>
          Coste por Asesor — {semester.label}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Coste fijo: {fmt(agentMonthlyCost)}/mes por asesor + comisiones pagadas
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Asesor</th>
                <th className="text-center py-2 px-2 font-medium">Estado</th>
                <th className="text-right py-2 px-2 font-medium">Fijo ({agentCosts[0]?.monthsInSemester || 0}m)</th>
                <th className="text-right py-2 px-2 font-medium">Comisiones</th>
                <th className="text-right py-2 px-2 font-medium">Coste Total</th>
                <th className="text-right py-2 px-2 font-medium">Generado</th>
                <th className="text-right py-2 px-2 font-medium">Ratio</th>
                <th className="text-right py-2 px-2 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {agentCosts.map(a => {
                const ratio = a.totalCost > 0 ? a.agencyGenerated / a.totalCost : 0;
                const { color, label, emoji } = ratio > 3
                  ? { color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400', label: 'Premium', emoji: '👑' }
                  : ratio > 2
                  ? { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Verde', emoji: '🟢' }
                  : ratio > 1
                  ? { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Ámbar', emoji: '🟡' }
                  : { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Rojo', emoji: '🔴' };

                return (
                <tr key={a.user_id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 px-2 font-medium flex items-center gap-1.5">
                    {ratio > 3 && <Crown className="h-4 w-4 text-violet-500" />}
                    {a.full_name}
                  </td>
                  <td className="text-center py-2 px-2">
                    <Badge className={`${color} text-xs`}>{emoji} {label}</Badge>
                  </td>
                  <td className="text-right py-2 px-2">{fmt(a.fixedCost)}</td>
                  <td className="text-right py-2 px-2">{fmt(a.commissionsPaid)}</td>
                  <td className="text-right py-2 px-2 font-semibold">{fmt(a.totalCost)}</td>
                  <td className="text-right py-2 px-2">{fmt(a.agencyGenerated)}</td>
                  <td className="text-right py-2 px-2 font-medium">{ratio.toFixed(1)}x</td>
                  <td className={`text-right py-2 px-2 font-bold ${a.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                    {fmt(a.profit)}
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td className="py-2 px-2">TOTAL</td>
                <td></td>
                <td className="text-right py-2 px-2">{fmt(totals.fixed)}</td>
                <td className="text-right py-2 px-2">{fmt(totals.comms)}</td>
                <td className="text-right py-2 px-2">{fmt(totals.total)}</td>
                <td className="text-right py-2 px-2">{fmt(totals.generated)}</td>
                <td className="text-right py-2 px-2">{totals.total > 0 ? (totals.generated / totals.total).toFixed(1) : 0}x</td>
                <td className={`text-right py-2 px-2 ${totals.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {fmt(totals.profit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminAgentCosts;
