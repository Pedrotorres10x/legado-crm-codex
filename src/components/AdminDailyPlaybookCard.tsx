import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Shield, Users, FileWarning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Rule42210Card from '@/components/performance/Rule42210Card';

type Props = {
  pendingApproval: number;
  totalAgents: number;
  storageKey?: string;
};

const AdminDailyPlaybookCard = ({
  pendingApproval,
  totalAgents,
  storageKey = 'admin-playbook',
}: Props) => {
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

  const checklist = [
    {
      key: 'office-diagnosis',
      icon: Shield,
      label: 'Empieza por la foto global',
      detail: 'Primero mira dónde está roto el equilibrio de la oficina: actividad, base vendedora o base compradora.',
      route: '/admin',
      cta: 'Ver motor comercial',
    },
    {
      key: 'agent-review',
      icon: Users,
      label: 'Luego baja a los agentes',
      detail: `Revisa quién va bien, quién todavía no basta y quién necesita intervención. Hoy mismo deberías poder leer a ${totalAgents} agente${totalAgents === 1 ? '' : 's'} sin intuición.`,
      route: '/admin#admin-agent-evaluation-overview',
      cta: 'Ver evaluación',
    },
    {
      key: 'blockers',
      icon: FileWarning,
      label: 'Cierra bloqueos antes de dispersarte',
      detail: pendingApproval > 0
        ? `Tienes ${pendingApproval} pendiente${pendingApproval === 1 ? '' : 's'} de aprobación. Después mira legal, cierre, stock e inbound.`
        : 'Después mira legal, cierre, stock e inbound. El trabajo de dirección es quitar bloqueos, no solo leer paneles.',
      route: '/admin#admin-legal-radar',
      cta: 'Ir a bloqueos',
    },
  ];

  const completedCount = checklist.filter((item) => completed.includes(item.key)).length;
  const completionPct = Math.round((completedCount / checklist.length) * 100);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display">Playbook de dirección</CardTitle>
        <p className="text-sm text-muted-foreground">
          Si mañana entra un director nuevo, este es el orden correcto para dirigir la oficina sin perderse en paneles.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Rule42210Card compact />

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Qué hacer primero hoy</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Foto global, agentes concretos y bloqueos reales. Ese orden permite dirigir desde el primer día.
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground">{completedCount}/{checklist.length} pasos hechos</span>
          </div>
          <div className="mt-3">
            <Progress value={completionPct} className="h-2.5" />
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {checklist.map((item, index) => {
            const Icon = item.icon;
            const isDone = completed.includes(item.key);
            return (
              <div key={item.key} className="rounded-xl border border-border/60 bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Paso {index + 1}
                </p>
                <div className="mt-2 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(item.route)}>
                    <ArrowRight className="mr-1 h-4 w-4" />
                    {item.cta}
                  </Button>
                  <Button
                    size="sm"
                    variant={isDone ? 'default' : 'ghost'}
                    onClick={() => toggleDone(item.key)}
                  >
                    {isDone ? (
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                    ) : (
                      <Circle className="mr-1 h-4 w-4" />
                    )}
                    {isDone ? 'Paso hecho' : 'Marcar hecho'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">Regla de dirección</p>
          <p className="mt-1 text-sm">
            No dirijas por intuición. Primero mira dónde se rompe la oficina, luego quién la está rompiendo y por último qué bloqueo toca quitar hoy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminDailyPlaybookCard;
