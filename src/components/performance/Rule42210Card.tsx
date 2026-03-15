import { Building2, CalendarCheck, Home, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type Props = {
  compact?: boolean;
};

const steps = [
  { label: '4 toques al día', icon: MessageCircle },
  { label: '2 visitas a la semana', icon: CalendarCheck },
  { label: '2 captaciones al mes', icon: Building2 },
  { label: '10 ventas al año', icon: Home },
];

const Rule42210Card = ({ compact = false }: Props) => {
  return (
    <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)] bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--accent)/0.08),hsl(var(--background)))]">
      <CardContent className={compact ? 'p-4' : 'p-5'}>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Regla 4-2-2-10</p>
            <p className="text-base font-semibold text-foreground">
              4 toques al día → 2 visitas a la semana → 2 captaciones al mes → 10 ventas al año.
            </p>
            <p className="text-sm text-muted-foreground">
              Si mantienes la actividad, el negocio aparece.
            </p>
          </div>

          <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'md:grid-cols-4'}`}>
            {steps.map(({ label, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-border/50 bg-background/80 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Rule42210Card;
