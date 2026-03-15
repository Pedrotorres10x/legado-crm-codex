import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { AgentDailyPlaybook } from '@/lib/agent-daily-playbook';

type Props = {
  playbook: AgentDailyPlaybook;
  storageKey?: string;
};

const paceTone = {
  verde: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amarillo: 'border-amber-200 bg-amber-50 text-amber-800',
  rojo: 'border-rose-200 bg-rose-50 text-rose-800',
} as const;

const AgentDailyPlaybookCard = ({ playbook, storageKey = 'agent-playbook' }: Props) => {
  const navigate = useNavigate();
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const completedStorageKey = `${storageKey}:${todayKey}`;
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    const raw = window.localStorage.getItem(completedStorageKey);
    if (!raw) {
      setCompleted([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setCompleted(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCompleted([]);
    }
  }, [completedStorageKey]);

  const toggleDone = (key: string) => {
    setCompleted((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      window.localStorage.setItem(completedStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const checklistKeys = [playbook.primaryAction.key, ...playbook.steps.map((step) => step.key)];
  const completedCount = checklistKeys.filter((key) => completed.includes(key)).length;
  const completionPct = Math.round((completedCount / Math.max(checklistKeys.length, 1)) * 100);

  return (
    <Card className="animate-fade-in-up border-0 shadow-card card-shine overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg font-display">{playbook.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{playbook.intro}</p>
        <div className={`rounded-xl border p-4 ${paceTone[playbook.pace.level]}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{playbook.pace.label}</p>
              <p className="mt-1 text-sm">{playbook.pace.detail}</p>
            </div>
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
          </div>
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span>Progreso del día</span>
              <span>{completedCount}/{checklistKeys.length} pasos hechos</span>
            </div>
            <Progress value={completionPct} className="h-2.5 bg-white/50" />
          </div>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Empieza por aquí</p>
          <p className="mt-2 text-base font-semibold">{playbook.primaryAction.title}</p>
          <p className="mt-2 text-sm text-muted-foreground">{playbook.primaryAction.detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => navigate(playbook.primaryAction.route)}>
              <ArrowRight className="mr-1 h-4 w-4" />
              {playbook.primaryAction.cta}
            </Button>
            <Button
              variant={completed.includes(playbook.primaryAction.key) ? 'default' : 'outline'}
              onClick={() => toggleDone(playbook.primaryAction.key)}
            >
              {completed.includes(playbook.primaryAction.key) ? (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              ) : (
                <Circle className="mr-1 h-4 w-4" />
              )}
              {completed.includes(playbook.primaryAction.key) ? 'Hecho' : 'Marcar hecho'}
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <p className="text-sm font-medium">Si haces esto, vas en ritmo</p>
          <p className="mt-1 text-sm">{playbook.outcomePromise}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium">Regla de trabajo</p>
          <p className="mt-1 text-sm text-muted-foreground">{playbook.disciplineNote}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Recuerda: el negocio no empieza en la vivienda, empieza en la persona. Si trabajas bien relaciones y siguiente paso, luego llega la captacion y la venta.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">Si no lo haces hoy</p>
          <p className="mt-1 text-sm">{playbook.riskIfSkipped}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <p className="text-sm font-medium">Checklist del día</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No necesitas pensar demasiado: haz primero la misión principal y luego completa estos tres pasos en orden.
          </p>
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          {playbook.steps.map((step, index) => (
            <div key={step.title} className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Paso {index + 1}
              </p>
              <p className="mt-2 text-sm font-semibold">{step.title}</p>
              <p className="mt-2 text-xs text-muted-foreground">{step.detail}</p>
              <div className="mt-4 flex flex-col gap-2">
                <Button className="w-full" variant="outline" size="sm" onClick={() => navigate(step.route)}>
                  <ArrowRight className="mr-1 h-4 w-4" />
                  {step.cta}
                </Button>
                <Button
                  className="w-full"
                  variant={completed.includes(step.key) ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => toggleDone(step.key)}
                >
                  {completed.includes(step.key) ? (
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                  ) : (
                    <Circle className="mr-1 h-4 w-4" />
                  )}
                  {completed.includes(step.key) ? 'Paso hecho' : 'Marcar hecho'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentDailyPlaybookCard;
