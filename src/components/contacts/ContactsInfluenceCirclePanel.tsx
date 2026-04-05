import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ContactsInfluenceCirclePanelProps = {
  isMobile: boolean;
  isCircleView: boolean;
  pipelineContactsLength: number;
  circleTierCounts: { oro: number; plata: number; bronce: number };
  circleValidationCounts: { validado: number; potencial: number; sin_validar: number };
  circleTierFilter: 'all' | 'oro' | 'plata' | 'bronce';
  setCircleTierFilter: (value: 'all' | 'oro' | 'plata' | 'bronce') => void;
  circleValidationFilter: 'all' | 'validado' | 'potencial' | 'sin_validar';
  setCircleValidationFilter: (value: 'all' | 'validado' | 'potencial' | 'sin_validar') => void;
};

export default function ContactsInfluenceCirclePanel({
  isMobile,
  isCircleView,
  pipelineContactsLength,
  circleTierCounts,
  circleValidationCounts,
  circleTierFilter,
  setCircleTierFilter,
  circleValidationFilter,
  setCircleValidationFilter,
}: ContactsInfluenceCirclePanelProps) {
  if (isMobile || !isCircleView) return null;

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground border-0">Círculo de influencia</Badge>
            <Badge variant="outline">Personas clave</Badge>
          </div>
          <p className="text-sm font-semibold">Base relacional con potencial real de referral</p>
          <p className="text-xs text-muted-foreground">
            Trabaja aqui los contactos con mas potencial de referral y segmentalos por valor relacional y validacion real.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Base util visible</p>
            <p className="mt-2 text-2xl font-bold">{pipelineContactsLength}</p>
            <p className="mt-1 text-xs text-muted-foreground">Contactos del circulo en esta bandeja despues de filtros.</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Distribucion relacional</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge className="bg-amber-500 text-white border-0">Oro {circleTierCounts.oro}</Badge>
              <Badge className="bg-slate-400 text-white border-0">Plata {circleTierCounts.plata}</Badge>
              <Badge className="bg-orange-700 text-white border-0">Bronce {circleTierCounts.bronce}</Badge>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Validacion CRM</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge className="bg-emerald-500 text-white border-0">Validados {circleValidationCounts.validado}</Badge>
              <Badge className="bg-blue-500 text-white border-0">Potenciales {circleValidationCounts.potencial}</Badge>
              <Badge variant="outline">Sin validar {circleValidationCounts.sin_validar}</Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Filtro relacional</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'oro', label: `Oro (${circleTierCounts.oro})` },
                { key: 'plata', label: `Plata (${circleTierCounts.plata})` },
                { key: 'bronce', label: `Bronce (${circleTierCounts.bronce})` },
              ].map((option) => (
                <Button
                  key={option.key}
                  variant={circleTierFilter === option.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCircleTierFilter(option.key as typeof circleTierFilter)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Filtro de validacion</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'validado', label: `Validados (${circleValidationCounts.validado})` },
                { key: 'potencial', label: `Potenciales (${circleValidationCounts.potencial})` },
                { key: 'sin_validar', label: `Sin validar (${circleValidationCounts.sin_validar})` },
              ].map((option) => (
                <Button
                  key={option.key}
                  variant={circleValidationFilter === option.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCircleValidationFilter(option.key as typeof circleValidationFilter)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
