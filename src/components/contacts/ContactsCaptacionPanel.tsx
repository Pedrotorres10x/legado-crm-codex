import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

type ContactsCaptacionPanelProps = {
  pipelineTab: 'captacion' | 'compradores' | 'cerrados' | 'red';
};

export default function ContactsCaptacionPanel({
  pipelineTab,
}: ContactsCaptacionPanelProps) {
  if (pipelineTab !== 'captacion') return null;

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">La exclusiva se gana en la relacion</p>
            <p className="text-sm text-muted-foreground">
              Si el dueño confia en ti, te da la exclusiva sin pelear honorarios. Si te centras solo en el piso, compites como uno mas y solo te elegira si eres mas barato.
            </p>
          </div>
          <Badge className="bg-amber-500 text-white border-0">Captacion</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Que construir</p>
            <p className="mt-2 text-sm font-medium">Confianza, credibilidad y seguimiento</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Que evitar</p>
            <p className="mt-2 text-sm font-medium">Pelear honorarios antes de haber ganado la relacion</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Siguiente paso sano</p>
            <p className="mt-2 text-sm font-medium">Llevar prospecto a visita de captacion y de ahi a exclusiva</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
