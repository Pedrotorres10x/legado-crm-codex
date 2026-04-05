import type { ComponentType } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpRight, CalendarPlus, ShieldQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OperationsItem } from '@/hooks/useOperationsFeed';

type OperationsQueueProps = {
  loading: boolean;
  visibleItems: OperationsItem[];
  canViewAll: boolean;
  issueLabels: Record<OperationsItem['kind'], string>;
  getIssueBadgeVariant: (item: OperationsItem) => 'destructive' | 'secondary' | 'outline';
  getIssueIcon: (kind: OperationsItem['kind']) => ComponentType<{ className?: string }>;
  agentNameMap: Map<string, string>;
  openTaskDialog: (item: OperationsItem) => void;
  openVisitDialog: (item: OperationsItem) => void;
  openOfferDialogFromVisit: (item: OperationsItem) => void;
  openOfferResolutionDialog: (item: OperationsItem) => void;
  openReassignDialog: (item: OperationsItem) => void;
  completeManualTask: (item: OperationsItem) => void;
  resolvingTaskId: string | null;
  navigate: (path: string) => void;
};

export default function OperationsQueue({
  loading,
  visibleItems,
  canViewAll,
  issueLabels,
  getIssueBadgeVariant,
  getIssueIcon,
  agentNameMap,
  openTaskDialog,
  openVisitDialog,
  openOfferDialogFromVisit,
  openOfferResolutionDialog,
  openReassignDialog,
  completeManualTask,
  resolvingTaskId,
  navigate,
}: OperationsQueueProps) {
  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Cola operativa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Priorizada por gravedad, filtrable por vista de trabajo y con acceso directo al origen real del problema.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando centro de operaciones...</p>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <ShieldQuestion className="h-4 w-4" />
              No hay asuntos abiertos con este filtro ahora mismo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleItems.slice(0, 24).map((item) => {
              const Icon = getIssueIcon(item.kind);

              return (
                <div key={item.id} className="rounded-2xl border border-border/60 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getIssueBadgeVariant(item)}>{issueLabels[item.kind]}</Badge>
                        <Badge variant="outline">{item.severity === 'alta' ? 'Prioridad alta' : 'Seguimiento'}</Badge>
                      </div>
                      <div className="mt-3 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{item.meta}</span>
                            {canViewAll && item.agentId ? <span>Agente: {agentNameMap.get(item.agentId) || 'Asignado'}</span> : null}
                            {item.updatedAt ? (
                              <span>Actualizado {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true, locale: es })}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:max-w-[320px] lg:shrink-0 lg:justify-end">
                      {item.kind === 'lead' ? (
                        <Button variant="outline" onClick={() => openTaskDialog(item)}>
                          <CalendarPlus className="mr-1.5 h-4 w-4" />
                          Crear seguimiento
                        </Button>
                      ) : null}
                      {item.kind === 'stock' && item.id.startsWith('stock-mandate-') ? (
                        <Button variant="outline" onClick={() => navigate(item.route)}>
                          Renovar mandato
                        </Button>
                      ) : null}
                      {item.kind === 'stock' && item.id.startsWith('stock-publish-') ? (
                        <Button variant="outline" onClick={() => navigate(item.route)}>
                          Completar ficha
                        </Button>
                      ) : null}
                      {item.kind === 'stock' && item.id.startsWith('stock-distribution-') ? (
                        <Button variant="outline" onClick={() => navigate(item.route)}>
                          Activar difusión
                        </Button>
                      ) : null}
                      {['offer', 'visit'].includes(item.kind) && item.propertyId && item.contactId ? (
                        <Button variant="outline" onClick={() => openVisitDialog(item)}>
                          Programar visita
                        </Button>
                      ) : null}
                      {item.kind === 'visit' && item.propertyId && item.contactId ? (
                        <Button variant="outline" onClick={() => openOfferDialogFromVisit(item)}>
                          Registrar oferta
                        </Button>
                      ) : null}
                      {item.kind === 'offer' && item.offerId ? (
                        <Button variant="outline" onClick={() => openOfferResolutionDialog(item)}>
                          Resolver oferta
                        </Button>
                      ) : null}
                      {item.kind !== 'task' ? (
                        <Button variant="outline" onClick={() => openTaskDialog(item)}>
                          <CalendarPlus className="mr-1.5 h-4 w-4" />
                          Crear tarea
                        </Button>
                      ) : null}
                      {canViewAll && item.propertyId ? (
                        <Button variant="outline" onClick={() => openReassignDialog(item)}>
                          Reasignar agente
                        </Button>
                      ) : null}
                      {item.kind === 'task' && !item.taskAutomatic && item.taskId ? (
                        <Button
                          variant="outline"
                          onClick={() => completeManualTask(item)}
                          disabled={resolvingTaskId === item.taskId}
                        >
                          {resolvingTaskId === item.taskId ? 'Resolviendo...' : 'Completar'}
                        </Button>
                      ) : null}
                      {item.secondaryRoute && item.secondaryLabel ? (
                        <Button variant="outline" onClick={() => navigate(item.secondaryRoute || item.route)}>
                          {item.secondaryLabel}
                        </Button>
                      ) : null}
                      <Button variant="outline" onClick={() => navigate(item.route)}>
                        {item.routeLabel}
                      </Button>
                      <Button onClick={() => navigate(item.route)}>
                        Abrir
                        <ArrowUpRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
