import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Exclusion = {
  id: string;
  type: 'email' | 'ip';
  value: string;
  label?: string | null;
  created_at: string;
};

type WebLeadsExclusionsPanelProps = {
  exclusions: Exclusion[];
  newExcType: 'email' | 'ip';
  setNewExcType: (value: 'email' | 'ip') => void;
  newExcValue: string;
  setNewExcValue: (value: string) => void;
  newExcLabel: string;
  setNewExcLabel: (value: string) => void;
  addExclusion: () => void;
  removeExclusion: (id: string) => void;
  savingExc: boolean;
};

export function WebLeadsExclusionsPanel({
  exclusions,
  newExcType,
  setNewExcType,
  newExcValue,
  setNewExcValue,
  newExcLabel,
  setNewExcLabel,
  addExclusion,
  removeExclusion,
  savingExc,
}: WebLeadsExclusionsPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          🚫 Exclusiones de analítica
          <Badge variant="outline" className="text-xs font-normal">
            Emails e IPs del equipo — no se contabilizan en métricas ni leads
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Añadir exclusión</p>
          <div className="flex flex-wrap gap-2">
            <select
              value={newExcType}
              onChange={(e) => setNewExcType(e.target.value as 'email' | 'ip')}
              className="border border-input rounded-md text-sm px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="email">📧 Email</option>
              <option value="ip">🌐 IP</option>
            </select>
            <input
              type="text"
              placeholder={newExcType === 'email' ? 'pedro@ejemplo.es' : '192.168.1.1'}
              value={newExcValue}
              onChange={(e) => setNewExcValue(e.target.value)}
              className="border border-input rounded-md text-sm px-3 py-1.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-[180px]"
            />
            <input
              type="text"
              placeholder="Etiqueta (ej: Pedro Torres - equipo)"
              value={newExcLabel}
              onChange={(e) => setNewExcLabel(e.target.value)}
              className="border border-input rounded-md text-sm px-3 py-1.5 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1 min-w-[200px]"
            />
            <button
              onClick={addExclusion}
              disabled={savingExc || !newExcValue.trim()}
              className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
            >
              {savingExc ? 'Guardando…' : '+ Añadir'}
            </button>
          </div>
        </div>

        {exclusions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No hay exclusiones configuradas.
            <br />
            <span className="text-xs">Añade emails o IPs del equipo para que no contaminen las métricas.</span>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {exclusions.map((exc) => (
              <div key={exc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                <span className="text-base shrink-0">{exc.type === 'email' ? '📧' : '🌐'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono text-foreground truncate">{exc.value}</p>
                  {exc.label && exc.label !== exc.value && (
                    <p className="text-xs text-muted-foreground">{exc.label}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {exc.type === 'email' ? 'Email' : 'IP'}
                </Badge>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {format(parseISO(exc.created_at), 'd MMM yyyy', { locale: es })}
                </span>
                <button
                  onClick={() => removeExclusion(exc.id)}
                  className="text-destructive hover:text-destructive/80 transition-colors text-xs px-2 py-1 rounded hover:bg-destructive/10"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
          <p className="font-semibold">ℹ️ Cómo funciona</p>
          <p>• <strong>Email excluido</strong>: si alguien rellena el formulario con ese email, no se crea contacto ni lead en el CRM.</p>
          <p>• <strong>IP excluida</strong>: las visitas desde esa IP no se registran en las métricas de analítica.</p>
          <p>• Los cambios son inmediatos — se aplican en la siguiente visita o envío de formulario.</p>
        </div>
      </CardContent>
    </Card>
  );
}
