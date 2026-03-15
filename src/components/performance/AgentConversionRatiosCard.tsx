import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import type { PerformanceData } from '@/hooks/useAgentPerformance';

type Props = {
  data: PerformanceData;
};

const getConversionHeadline = (data: PerformanceData) => {
  const { conversion } = data;

  if (data.facturacionCount >= 2 && data.availableStockCount < 5) {
    return {
      label: 'Ojo con la nevera',
      detail: 'Has llegado a arras, pero con poco stock disponible puedes quedarte sin producto para el siguiente ciclo.',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  if (conversion.captacionVisitsToExclusiveRate < 20) {
    return {
      label: 'Cuello en captacion',
      detail: 'Estás llegando a visita, pero conviertes poco a exclusiva. Ahí está una de las fugas principales.',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  if (conversion.exclusivesToArrasRate < 20 && data.captacionesCount >= 3) {
    return {
      label: 'Cuello en venta',
      detail: 'Ya construyes cartera, pero falta convertir exclusivas en arras firmadas.',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'Lectura de conversion sana',
    detail: 'El embudo ya deja ver dónde conviertes y dónde tienes que apretar el siguiente paso comercial.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
};

const AgentConversionRatiosCard = ({ data }: Props) => {
  const headline = getConversionHeadline(data);

  const rows = [
    {
      label: 'Llamadas -> visitas captacion',
      value: `${data.conversion.llamadasToCaptacionVisitsRate}%`,
      detail: `${data.llamadasCount} llamadas para ${data.entrevistasCount} visitas de captacion`,
    },
    {
      label: 'Visitas captacion -> exclusivas',
      value: `${data.conversion.captacionVisitsToExclusiveRate}%`,
      detail: `${data.entrevistasCount} visitas de captacion para ${data.captacionesCount} exclusivas`,
    },
    {
      label: 'Exclusivas -> arras',
      value: `${data.conversion.exclusivesToArrasRate}%`,
      detail: `${data.captacionesCount} exclusivas para ${data.facturacionCount} arras firmadas`,
    },
    {
      label: 'Visitas comprador por arras',
      value: data.conversion.buyerVisitsPerArras === null ? '-' : String(data.conversion.buyerVisitsPerArras),
      detail: `${data.buyerVisitsCount} visitas comprador en el periodo`,
    },
  ];

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <TrendingUp className="h-5 w-5 text-primary" />
          Conversion comercial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div>
            <p className="text-sm font-semibold">{headline.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{headline.detail}</p>
          </div>
          <Badge variant="outline" className={headline.tone}>
            {data.periodLabel}
          </Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="rounded-xl border border-border/60 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{row.label}</p>
              <p className="mt-2 text-2xl font-bold">{row.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentConversionRatiosCard;
