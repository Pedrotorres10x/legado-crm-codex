import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toMadrid } from '@/hooks/useWebLeadsData';
import { SessionDetail } from '@/hooks/useWebLeadsMetrics';
import { differenceInSeconds, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowDownToLine, ArrowRight, ChevronDown, ChevronUp, Clock, FileText, LogIn, Monitor, Repeat, ShieldAlert, Smartphone, Tablet, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function SessionCard({
  session,
  pageName,
  countryFlag,
}: {
  session: SessionDetail;
  pageName: (page: string) => string;
  countryFlag: (country: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  const gaps: number[] = [];
  for (let i = 1; i < session.pvs.length; i++) {
    gaps.push(
      differenceInSeconds(parseISO(session.pvs[i].created_at), parseISO(session.pvs[i - 1].created_at))
    );
  }

  const isBounce = session.pageCount === 1;

  return (
    <Card className={`border transition-colors ${session.isReturning ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
      <CardContent className="px-4 pt-3 pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {session.device === 'mobile'
              ? <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              : session.device === 'tablet'
              ? <Tablet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              : <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {session.country && <span className="text-sm shrink-0">{countryFlag(session.country)}</span>}
            <span className="text-xs font-semibold text-foreground truncate">{session.source}</span>
            {session.isReturning && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary shrink-0">
                <Repeat className="h-2.5 w-2.5 mr-1" />Recurrente
              </Badge>
            )}
            {isBounce && (
              <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive shrink-0">
                Rebote
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{session.sid.slice(0, 8)}…</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <FileText className="h-3 w-3" />{session.pageCount} pág.
              </span>
              {session.durationSec != null && session.durationSec > 0 && (
                <span className="flex items-center gap-0.5">
                  <Timer className="h-3 w-3" />{fmtDuration(session.durationSec)}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {format(toMadrid(session.firstSeen), "d MMM · HH:mm", { locale: es })}
              </span>
            </div>
            <button
              onClick={() => setExpanded((value) => !value)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
              aria-label={expanded ? 'Colapsar sesión' : 'Expandir sesión'}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1 flex-wrap">
          {session.pvs.map((pageview, index) => (
            <span key={index} className="flex items-center gap-1">
              <span
                title={pageview.page}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  index === 0
                    ? 'bg-primary/10 text-primary font-semibold'
                    : index === session.pvs.length - 1 && session.pvs.length > 1
                    ? 'bg-destructive/10 text-destructive font-semibold'
                    : 'bg-muted text-foreground'
                }`}
              >
                {pageName(pageview.page)}
              </span>
              {index < session.pvs.length - 1 && (
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              )}
            </span>
          ))}
        </div>

        {expanded && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Recorrido detallado
            </p>
            <ol className="relative ml-3">
              {session.pvs.map((pageview, index) => {
                const isEntry = index === 0;
                const isExit = index === session.pvs.length - 1 && session.pvs.length > 1;
                const gapSec = index > 0 ? gaps[index - 1] : null;

                return (
                  <li key={index} className="relative pl-6 pb-4 last:pb-0">
                    {index < session.pvs.length - 1 && (
                      <div className="absolute left-[5px] top-3.5 bottom-0 w-px bg-border" />
                    )}
                    <div
                      className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 ${
                        isEntry
                          ? 'bg-primary border-primary'
                          : isExit
                          ? 'bg-destructive border-destructive'
                          : 'bg-background border-muted-foreground/40'
                      }`}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {gapSec !== null && (
                          <div className="text-[9px] text-muted-foreground mb-0.5 flex items-center gap-1">
                            <Timer className="h-2.5 w-2.5 shrink-0" />
                            {fmtDuration(gapSec)} en página anterior
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-foreground font-medium" title={pageview.page}>
                            {pageName(pageview.page)}
                          </span>
                          {isEntry && (
                            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary px-1 py-0 h-4">
                              <LogIn className="h-2.5 w-2.5 mr-0.5" />Entrada
                            </Badge>
                          )}
                          {isExit && (
                            <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive px-1 py-0 h-4">
                              <ArrowDownToLine className="h-2.5 w-2.5 mr-0.5" />Salida
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground shrink-0 font-mono pt-0.5">
                        {format(toMadrid(pageview.created_at), "HH:mm:ss")}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Origen', value: session.source },
                { label: 'Dispositivo', value: session.device ?? 'desktop' },
                { label: 'País', value: session.country ? `${countryFlag(session.country)} ${session.country}` : '—' },
                { label: 'Duración total', value: session.durationSec && session.durationSec > 0 ? fmtDuration(session.durationSec) : '— (1 pág.)' },
              ].map((metric) => (
                <div key={metric.label} className="bg-muted/40 rounded-lg px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground">{metric.label}</div>
                  <div className="text-xs font-semibold text-foreground mt-0.5 capitalize">{metric.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WebLeadsSessionsPanel({
  sessionDetails,
  pageName,
  countryFlag,
}: {
  sessionDetails: SessionDetail[];
  pageName: (page: string) => string;
  countryFlag: (country: string) => string;
}) {
  const [filter, setFilter] = useState<'all' | 'multi' | 'returning'>('all');

  const filtered = useMemo(() => {
    if (filter === 'multi') return sessionDetails.filter((session) => session.pageCount > 1);
    if (filter === 'returning') return sessionDetails.filter((session) => session.isReturning);
    return sessionDetails;
  }, [sessionDetails, filter]);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-lg px-3 py-2.5">
        <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/80">
          <strong>Filtro anti-bot activo:</strong> se excluyen automáticamente sesiones con UAs falsos
          (<code className="font-mono text-[10px] bg-muted px-1 rounded">Android 10; K</code>,{' '}
          <code className="font-mono text-[10px] bg-muted px-1 rounded">Chrome/X.0.0.0</code>,{' '}
          <code className="font-mono text-[10px] bg-muted px-1 rounded">Chrome &lt;100</code>,{' '}
          <code className="font-mono text-[10px] bg-muted px-1 rounded">iOS 26+</code>,{' '}
          <code className="font-mono text-[10px] bg-muted px-1 rounded">FB prefetcher</code>).
          Los datos mostrados son tráfico real humano.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Filtrar:</span>
        {[
          { id: 'all' as const, label: `Todas (${sessionDetails.length})` },
          { id: 'multi' as const, label: `Multi-página (${sessionDetails.filter((session) => session.pageCount > 1).length})` },
          { id: 'returning' as const, label: `Recurrentes (${sessionDetails.filter((session) => session.isReturning).length})` },
        ].map((option) => (
          <button
            key={option.id}
            onClick={() => setFilter(option.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              filter === option.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            {option.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-primary" /> Entrada
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-destructive" /> Salida
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Sin sesiones para este filtro
          </CardContent>
        </Card>
      ) : (
        filtered.map((session) => (
          <SessionCard
            key={session.sid}
            session={session}
            pageName={pageName}
            countryFlag={countryFlag}
          />
        ))
      )}
    </div>
  );
}
