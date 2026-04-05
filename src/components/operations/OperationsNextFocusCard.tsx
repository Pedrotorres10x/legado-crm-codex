import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { OperationsItem } from '@/hooks/useOperationsFeed';

type OperationsNextFocusCardProps = {
  nextFocus: OperationsItem | null;
  canViewAll: boolean;
  activePreset: 'all' | 'my_urgent' | 'legal' | 'closing' | 'delegated_today';
  setActivePreset: (value: 'all' | 'my_urgent' | 'legal' | 'closing' | 'delegated_today') => void;
  navigate: (path: string) => void;
  issueLabels: Record<OperationsItem['kind'], string>;
  getIssueBadgeVariant: (item: OperationsItem) => 'destructive' | 'secondary' | 'outline';
  agentNameMap: Map<string, string>;
};

export default function OperationsNextFocusCard({
  nextFocus,
  canViewAll,
  setActivePreset,
  navigate,
  issueLabels,
  getIssueBadgeVariant,
  agentNameMap,
}: OperationsNextFocusCardProps) {
  return (
    <Card className="border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_45%),linear-gradient(135deg,rgba(99,102,241,0.05),rgba(255,255,255,0.98))] shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
              Empieza por aqui
            </div>
            <div>
              <h2 className="max-w-[30rem] text-[1.35rem] font-display font-semibold tracking-tight text-foreground">
                {nextFocus ? nextFocus.title : 'Cola limpia por ahora'}
              </h2>
              <p className="mt-1.5 max-w-[36rem] text-sm leading-6 text-muted-foreground">
                {nextFocus
                  ? nextFocus.summary
                  : 'No hay asuntos abiertos con el filtro actual. Cambia de vista o revisa planificacion.'}
              </p>
            </div>
            {nextFocus ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={getIssueBadgeVariant(nextFocus)}>{issueLabels[nextFocus.kind]}</Badge>
                <Badge variant="outline">{nextFocus.severity === 'alta' ? 'Urgente' : 'Hoy'}</Badge>
                {canViewAll && nextFocus.agentId ? <span>Agente: {agentNameMap.get(nextFocus.agentId) || 'Asignado'}</span> : null}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            {nextFocus ? (
              <>
                <Button className="min-w-[210px]" onClick={() => navigate(nextFocus.route)}>
                  Abrir asunto
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => setActivePreset('my_urgent')}>
                  Ver solo urgentes
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => navigate('/tasks')}>
                Ir a planificación
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
