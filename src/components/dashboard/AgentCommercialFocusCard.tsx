import { ArrowRight, Scale, Building2, Handshake } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentAutonomyStatus, AgentCommercialFocus } from '@/lib/property-stock-health';

const toneMap = {
  captacion: {
    icon: Building2,
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  venta: {
    icon: Handshake,
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  equilibrio: {
    icon: Scale,
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
};

type Props = {
  focus: AgentCommercialFocus;
  autonomy: AgentAutonomyStatus;
};

const autonomyTone = {
  rojo: 'border-rose-200 bg-rose-50 text-rose-700',
  amarillo: 'border-amber-200 bg-amber-50 text-amber-700',
  verde: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const AgentCommercialFocusCard = ({ focus, autonomy }: Props) => {
  const tone = toneMap[focus.focus];
  const Icon = tone.icon;

  return (
    <Card className="animate-fade-in-up border-0 shadow-card card-shine overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-display">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-primary/20" style={{ background: 'var(--gradient-primary)' }}>
            <Icon className="h-4 w-4 text-primary-foreground" />
          </div>
          Foco comercial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={tone.badge}>
            {focus.label}
          </Badge>
          <Badge variant="outline">{focus.band}</Badge>
          <Badge variant="outline" className={autonomyTone[autonomy.level]}>
            {autonomy.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{focus.detail}</p>
        <div className="flex items-start gap-2 rounded-xl bg-muted/30 p-4 text-sm">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{focus.action}</span>
        </div>
        <div className="rounded-xl border border-border/60 bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Autonomía</p>
          <p className="mt-2 text-sm text-muted-foreground">{autonomy.detail}</p>
          <p className="mt-2 text-sm">{autonomy.reward}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentCommercialFocusCard;
