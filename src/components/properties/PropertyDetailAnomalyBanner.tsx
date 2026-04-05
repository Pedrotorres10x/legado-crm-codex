import { X } from 'lucide-react';

type Anomaly = {
  id: string;
  description: string;
};

type Props = {
  anomalies: Anomaly[];
  onDismiss: (id: string) => void;
};

export default function PropertyDetailAnomalyBanner({ anomalies, onDismiss }: Props) {
  if (anomalies.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 space-y-2 animate-fade-in-up">
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none mt-0.5">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">
            {anomalies.length === 1 ? 'Dato sospechoso detectado — revisa el formulario' : `${anomalies.length} datos sospechosos detectados — revisa el formulario`}
          </p>
          <ul className="mt-1 space-y-1">
            {anomalies.map((anomaly) => (
              <li key={anomaly.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="flex-1">{anomaly.description}</span>
                <button
                  onClick={() => onDismiss(anomaly.id)}
                  className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  title="Marcar como revisado"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
