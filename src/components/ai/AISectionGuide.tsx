import { useState } from 'react';
import { Bot, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type GuideAction = {
  label: string;
  description: string;
};

type Props = {
  title: string;
  context: string;
  doNow: string;
  dontForget: string;
  risk: string;
  actions?: GuideAction[];
  defaultOpen?: boolean;
};

const AISectionGuide = ({
  title,
  context,
  doNow,
  dontForget,
  risk,
  actions = [],
  defaultOpen = false,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Guia IA</p>
              <h3 className="mt-1 text-base font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Te explica esta seccion con lenguaje de negocio para que no tengas que pensar demasiado.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen((current) => !current)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <GuideTile label="Que es esto" value={context} />
          <GuideTile label="Que hacer ahora" value={doNow} tone="primary" />
          <GuideTile label="Que no olvidar" value={dontForget} />
          <GuideTile label="Que pasa si no lo haces" value={risk} tone="warning" />
        </div>

        {open && actions.length > 0 && (
          <div className="mt-4 rounded-xl border border-border/60 bg-background/80 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Prompts utiles para esta pantalla</p>
            </div>
            <div className="mt-3 grid gap-2 xl:grid-cols-3">
              {actions.map((action) => (
                <div key={action.label} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const GuideTile = ({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'primary' | 'warning';
}) => {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/20 bg-primary/5'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : 'border-border/60 bg-muted/20';

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm">{value}</p>
    </div>
  );
};

export default AISectionGuide;
