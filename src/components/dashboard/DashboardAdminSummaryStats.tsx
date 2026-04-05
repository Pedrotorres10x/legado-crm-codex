import { Card, CardContent } from '@/components/ui/card';
import { Euro, Shield, TrendingUp, Users } from 'lucide-react';
import { fmt as fmtCurrency } from '@/lib/commissions';

type DashboardAdminSummaryStatsProps = {
  totalAgents: number;
  totalAgency: number;
  totalPaid: number;
  pendingApproval: number;
};

const SUMMARY_ITEMS = [
  {
    key: 'totalAgents',
    label: 'Asesores activos',
    icon: Users,
    iconClassName: 'bg-primary/10 text-primary',
  },
  {
    key: 'totalAgency',
    label: 'Generado agencia (semestre)',
    icon: Euro,
    iconClassName: 'bg-success/10 text-success',
  },
  {
    key: 'totalPaid',
    label: 'Pagado a asesores',
    icon: TrendingUp,
    iconClassName: 'bg-accent/10 text-accent',
  },
  {
    key: 'pendingApproval',
    label: 'Pendientes aprobación',
    icon: Shield,
    iconClassName: 'bg-warning/10 text-warning',
  },
] as const;

export default function DashboardAdminSummaryStats({
  totalAgents,
  totalAgency,
  totalPaid,
  pendingApproval,
}: DashboardAdminSummaryStatsProps) {
  const values = {
    totalAgents: totalAgents.toString(),
    totalAgency: fmtCurrency(totalAgency),
    totalPaid: fmtCurrency(totalPaid),
    pendingApproval: pendingApproval.toString(),
  };

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      {SUMMARY_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconClassName}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{values[item.key]}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
