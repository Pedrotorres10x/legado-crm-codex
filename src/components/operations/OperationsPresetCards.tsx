import { AlertTriangle, CheckSquare, Clock3 } from 'lucide-react';

type PresetKey = 'all' | 'my_urgent' | 'legal' | 'closing' | 'delegated_today';

type OperationsPresetCardsProps = {
  activePreset: PresetKey;
  setActivePreset: (value: PresetKey) => void;
  urgent: number;
  commercialFollowup: number;
  delegatedTodayCount: number;
};

export default function OperationsPresetCards({
  activePreset,
  setActivePreset,
  urgent,
  commercialFollowup,
  delegatedTodayCount,
}: OperationsPresetCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
      <button
        type="button"
        onClick={() => setActivePreset('my_urgent')}
        className={`rounded-2xl border p-4 text-left shadow-sm transition-colors ${activePreset === 'my_urgent' ? 'border-destructive/40 bg-destructive/5' : 'border-border/60 bg-card hover:bg-muted/40'}`}
      >
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-xs font-medium uppercase tracking-wide">Urgente</p>
        </div>
        <p className="mt-2 text-3xl font-semibold">{urgent}</p>
        <p className="mt-1 text-xs text-muted-foreground">Lo que hoy bloquea firma, cierre o lead caliente.</p>
      </button>

      <button
        type="button"
        onClick={() => setActivePreset('all')}
        className={`rounded-2xl border p-4 text-left shadow-sm transition-colors ${activePreset === 'all' ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-card hover:bg-muted/40'}`}
      >
        <div className="flex items-center gap-2 text-primary">
          <Clock3 className="h-4 w-4" />
          <p className="text-xs font-medium uppercase tracking-wide">Hoy</p>
        </div>
        <p className="mt-2 text-3xl font-semibold">{commercialFollowup}</p>
        <p className="mt-1 text-xs text-muted-foreground">Seguimiento comercial y trabajo vivo del dia.</p>
      </button>

      <button
        type="button"
        onClick={() => setActivePreset('delegated_today')}
        className={`rounded-2xl border p-4 text-left shadow-sm transition-colors ${activePreset === 'delegated_today' ? 'border-sky-300 bg-sky-50' : 'border-border/60 bg-card hover:bg-muted/40'}`}
      >
        <div className="flex items-center gap-2 text-sky-700">
          <CheckSquare className="h-4 w-4" />
          <p className="text-xs font-medium uppercase tracking-wide">Delegado</p>
        </div>
        <p className="mt-2 text-3xl font-semibold">{delegatedTodayCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">Tareas manuales creadas hoy para repartir carga.</p>
      </button>
    </div>
  );
}
