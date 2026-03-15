import { ArrowRight, Film, Image, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AgentRecordRichnessSummary } from '@/lib/agent-record-richness';

type Props = {
  summary: AgentRecordRichnessSummary;
};

const toneMap = {
  rich: {
    icon: ShieldCheck,
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    note: 'Producto bien trabajado',
  },
  fragile: {
    icon: Image,
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    note: 'Producto aprovechable, pero flojo',
  },
  poor: {
    icon: TriangleAlert,
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    note: 'Producto pobre para captar y vender',
  },
};

const AgentRecordRichnessCard = ({ summary }: Props) => {
  const navigate = useNavigate();
  const tone = toneMap[summary.health];
  const Icon = tone.icon;

  return (
    <Card className="animate-fade-in-up border-0 shadow-card card-shine overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-display">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-primary/20" style={{ background: 'var(--gradient-primary)' }}>
            <Icon className="h-4 w-4 text-primary-foreground" />
          </div>
          Calidad de fichas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={tone.badge}>
            {summary.label}
          </Badge>
          <Badge variant="outline">
            {summary.averageScore}/100
          </Badge>
          <Badge variant="outline">
            {summary.total} inmuebles disponibles
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">{summary.detail}</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Ricas</p>
            <p className="mt-2 text-2xl font-semibold">{summary.richCount}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Incompletas</p>
            <p className="mt-2 text-2xl font-semibold">{summary.fragileCount}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Pobres</p>
            <p className="mt-2 text-2xl font-semibold">{summary.poorCount}</p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border/60 bg-background p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{tone.note}</span>
            <span className="text-muted-foreground">{summary.averageScore}/100</span>
          </div>
          <Progress value={summary.averageScore} className="h-2.5" />
          <p className="text-xs text-muted-foreground">
            Guardar rápido te deja arrancar, pero ficha pobre significa menos confianza del propietario y menos conversión con comprador.
          </p>
        </div>

        {summary.topGaps.length > 0 && (
          <div className="rounded-xl bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Dónde estás flojo</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.topGaps.map((gap) => (
                <Badge key={gap.issue} variant="secondary">
                  {gap.label}: {gap.count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {summary.topPoor.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Fichas a completar primero</p>
            <div className="mt-3 space-y-3">
              {summary.topPoor.map((property) => (
                <div key={property.id} className="flex items-start justify-between gap-3 rounded-lg bg-background px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{property.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {property.issueLabels.join(' · ')}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="shrink-0" onClick={() => navigate(`/properties/${property.id}#ficha`)}>
                    Abrir
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl bg-muted/30 p-4 text-sm">
          <Film className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{summary.action}</span>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate('/properties')}>
            Completar mis fichas <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentRecordRichnessCard;
