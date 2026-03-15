import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, MapPin } from 'lucide-react';
import {
  COMMERCIAL_PROCESS_AGENT_NOTE,
  COMMERCIAL_PROCESS_ANCHORS,
  COMMERCIAL_PROCESS_ADMIN_NOTE,
  COMMERCIAL_PROCESS_END_TO_END_NOTE,
  COMMERCIAL_PROCESS_STAGES,
} from '@/lib/commercial-process';

type Props = {
  mode?: 'agent' | 'admin';
};

const CommercialProcessCard = ({ mode = 'agent' }: Props) => {
  const intro =
    mode === 'admin'
      ? COMMERCIAL_PROCESS_ADMIN_NOTE
      : COMMERCIAL_PROCESS_AGENT_NOTE;

  const closingNote =
    mode === 'admin'
      ? 'La operación no termina en notaría: comprador cerrado y vendedor cerrado son la semilla del siguiente negocio.'
      : 'La operación no termina en notaría: si cuidas comprador y vendedor cerrados, se convierten en prescriptores.';

  return (
    <Card className="border-0 shadow-card card-shine overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-display">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-primary/20" style={{ background: 'var(--gradient-primary)' }}>
            <MapPin className="h-4 w-4 text-primary-foreground" />
          </div>
          Flujo comercial canónico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{intro}</p>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium">Idea fuerza</p>
          <p className="mt-1 text-sm text-muted-foreground">
            El core del negocio no son las casas. Son las personas, la confianza y las relaciones que luego se convierten en captacion, venta y prescripcion.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Cuando este metodo vive dentro del CRM, la oficina se vuelve mas escalable y replicable: un agente nuevo puede aprenderlo antes, y un director nuevo puede dirigir con mucha menos intuicion.
          </p>
        </div>
        <div className="grid gap-3 xl:grid-cols-4 2xl:grid-cols-7">
          {COMMERCIAL_PROCESS_STAGES.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">{step.label}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{step.detail}</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-background px-4 py-3 text-sm">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{closingNote}</span>
        </div>
        <div className="rounded-xl border border-border/60 bg-background p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Qué cuelga de este flujo</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMMERCIAL_PROCESS_ANCHORS.map((item) => (
              <Badge key={item} variant="outline">{item}</Badge>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{COMMERCIAL_PROCESS_END_TO_END_NOTE}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Círculo de influencia</Badge>
          <Badge variant="outline">Trabajo de zona</Badge>
          <Badge variant="outline">Comprador cerrado</Badge>
          <Badge variant="outline">Vendedor cerrado</Badge>
          <Badge variant="outline">Prescriptor</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default CommercialProcessCard;
