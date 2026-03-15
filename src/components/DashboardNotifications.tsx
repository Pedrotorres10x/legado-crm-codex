import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { X, CheckCircle, Flame, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DashboardNotificationsProps {
  alwaysShow?: boolean;
}

// How many notifications to show without scrolling
const ABOVE_FOLD = 4;

const NotifCard = ({
  n,
  dismiss,
}: {
  n: ReturnType<typeof useNotifications>['visibleNotifications'][number];
  dismiss: (id: string) => void;
}) => {
  const Icon = n.icon;
  const isUrgent = (n.priority ?? 99) <= 2;
  const isHighInterest = n.type === 'high_interest';

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-2xl border transition-all',
        isHighInterest || isUrgent
          ? 'bg-destructive/5 border-destructive/20'
          : 'bg-card border-border/50'
      )}
    >
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl mt-0.5',
        isHighInterest || isUrgent ? 'bg-destructive/10' : 'bg-muted'
      )}>
        {isHighInterest ? (
          <Flame className="h-4 w-4 text-destructive animate-pulse" />
        ) : (
          <Icon className={cn('h-4 w-4', n.color)} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-semibold leading-snug',
          isHighInterest || isUrgent ? 'text-destructive' : 'text-foreground'
        )}>
          {n.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
          {n.description}
        </p>
        {n.action && (
          <button
            onClick={n.action}
            className={cn(
              'mt-1.5 text-xs font-semibold underline-offset-2 hover:underline transition-colors',
              isHighInterest || isUrgent ? 'text-destructive' : 'text-primary'
            )}
          >
            {isHighInterest ? '¡Llamar ahora!' : 'Ver →'}
          </button>
        )}
      </div>

      <button
        onClick={() => dismiss(n.id)}
        className="shrink-0 h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const DashboardNotifications = ({ alwaysShow = false }: DashboardNotificationsProps) => {
  const { visibleNotifications, dismiss, dismissAll, loading } = useNotifications();
  const [expanded, setExpanded] = useState(false);

  if (!alwaysShow && visibleNotifications.length === 0 && !loading) return null;

  const aboveFold = visibleNotifications.slice(0, ABOVE_FOLD);
  const belowFold = visibleNotifications.slice(ABOVE_FOLD);
  const hasMore = belowFold.length > 0;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Notificaciones
        </h2>
        {visibleNotifications.length > 0 && (
          <button
            onClick={dismissAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Empty state */}
      {visibleNotifications.length === 0 && !loading && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/50">
          <CheckCircle className="h-5 w-5 text-success shrink-0" />
          <p className="text-sm text-muted-foreground">Todo al día 🎉</p>
        </div>
      )}

      {/* Above-fold: always visible */}
      {aboveFold.length > 0 && (
        <div className="space-y-2">
          {aboveFold.map(n => (
            <NotifCard key={n.id} n={n} dismiss={dismiss} />
          ))}
        </div>
      )}

      {/* Below-fold: scrollable, revealed when expanded */}
      {hasMore && (
        <>
          {expanded ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Última semana
              </p>
              <ScrollArea className="max-h-[280px] pr-1">
                <div className="space-y-2 pb-1">
                  {belowFold.map(n => (
                    <NotifCard key={n.id} n={n} dismiss={dismiss} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : null}

          {/* Toggle button */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted/50"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
            {expanded
              ? 'Ocultar anteriores'
              : `Ver ${belowFold.length} más de esta semana`}
          </button>
        </>
      )}
    </div>
  );
};

export default DashboardNotifications;
