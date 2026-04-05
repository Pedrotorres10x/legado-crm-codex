import { Card, CardContent } from '@/components/ui/card';
import { Copy, Eye, LucideIcon, Upload, Zap, Key } from 'lucide-react';

type Metric = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  helper: string;
};

type Props = {
  visitsCount: number;
  offersCount: number;
  matchesCount: number;
  hasMandate: boolean;
  documentsReady: boolean;
  propertyIssueCount: number;
};

export default function PropertyDetailMetrics({
  visitsCount,
  offersCount,
  matchesCount,
  hasMandate,
  documentsReady,
  propertyIssueCount,
}: Props) {
  const metrics: Metric[] = [
    { icon: Eye, label: 'Visitas', value: visitsCount, helper: visitsCount === 0 ? 'Aun no hay visitas cargadas' : 'Visitas ya registradas' },
    { icon: Copy, label: 'Ofertas', value: offersCount, helper: offersCount === 0 ? 'Todavia no hay propuestas' : 'Negociacion en marcha' },
    { icon: Zap, label: 'Cruces activos', value: matchesCount, helper: matchesCount === 0 ? 'No hay cruces vivos ahora mismo' : 'Compradores compatibles' },
    {
      icon: hasMandate ? Key : Upload,
      label: 'Documentacion',
      value: documentsReady ? 'OK' : `${propertyIssueCount}`,
      helper: documentsReady ? 'Ficha lista para trabajar' : `${propertyIssueCount} puntos por revisar`,
    },
  ];

  return (
    <Card className="animate-fade-in-up border-border/60 bg-gradient-to-r from-card via-card to-muted/15 shadow-sm">
      <CardContent className="p-4 md:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/85 px-3 py-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
                <metric.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xl font-bold tracking-tight text-foreground">{metric.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                <p className="text-[11px] text-muted-foreground">{metric.helper}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
