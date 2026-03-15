import { Network, Users, UserRoundCheck, MapPinned, Handshake } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AgentInfluenceCircleSummary } from '@/lib/agent-influence-circle';

type Props = {
  summary: AgentInfluenceCircleSummary;
};

const tierToneMap = {
  bronce: 'border-amber-300 bg-amber-50 text-amber-800',
  plata: 'border-slate-300 bg-slate-50 text-slate-800',
  oro: 'border-yellow-300 bg-yellow-50 text-yellow-800',
  saturado: 'border-rose-200 bg-rose-50 text-rose-700',
};

const balanceToneMap = {
  balanced: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  attention: 'border-amber-200 bg-amber-50 text-amber-700',
  warning: 'border-rose-200 bg-rose-50 text-rose-700',
};

const iconMap = {
  prescriptores: UserRoundCheck,
  zona: MapPinned,
  colaboradores: Handshake,
  red_personal: Users,
};

const AgentInfluenceCircleCard = ({ summary }: Props) => {
  const navigate = useNavigate();
  const progressBase = summary.total <= 500 ? (summary.total / 400) * 100 : 100;

  return (
    <Card className="animate-fade-in-up border-0 shadow-card card-shine overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-display">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-primary/20" style={{ background: 'var(--gradient-primary)' }}>
            <Network className="h-4 w-4 text-primary-foreground" />
          </div>
          Circulo de influencia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={tierToneMap[summary.tier]}>
            {summary.label}
          </Badge>
          <Badge variant="outline">{summary.total} contactos utiles</Badge>
          <Badge variant="outline">Objetivo 300-500</Badge>
        </div>

        <p className="text-sm text-muted-foreground">{summary.detail}</p>

        <div className="rounded-xl border border-border/60 bg-background p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Base util de referrals y captacion</span>
            <span className="text-muted-foreground">{summary.total}</span>
          </div>
          <Progress value={Math.max(0, Math.min(progressBase, 100))} className="mt-3 h-2.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            Bronce: menos de 300. Plata: de 300 a 400. Oro: de 401 a 500. Por encima de 500 ya cuesta atenderlo bien.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Ritmo recomendado de toques</p>
              <p className="text-xs text-muted-foreground">
                Mínimo fijo de 4 al día para construir base. Con tu círculo actual, la recomendación sube según volumen.
              </p>
            </div>
            <Badge variant="outline">{summary.recommendedDailyTouches} toques/dia</Badge>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">Toques / semana</p>
              <p className="mt-1 text-lg font-semibold">{summary.recommendedWeeklyTouches}</p>
            </div>
            <div className="rounded-lg bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">Toques / mes</p>
              <p className="mt-1 text-lg font-semibold">{summary.recommendedMonthlyTouches}</p>
            </div>
            <div className="rounded-lg bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">Toques / ano</p>
              <p className="mt-1 text-lg font-semibold">{summary.annualTouchDemand}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {summary.segments.map((segment) => {
            const Icon = iconMap[segment.key as keyof typeof iconMap];
            return (
              <div key={segment.key} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-primary" />
                  {segment.label}
                </div>
                <p className="mt-2 text-2xl font-semibold">{segment.count}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border/60 bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Calidad declarada del circulo</p>
              <p className="text-xs text-muted-foreground">
                Oro/plata/bronce lo marca el agente. El CRM solo valida si ya hay señales reales de recomendacion.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-yellow-50 px-3 py-2">
              <p className="text-xs text-yellow-700">Oro</p>
              <p className="mt-1 text-lg font-semibold text-yellow-900">{summary.relationshipTiers.oro}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-700">Plata</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{summary.relationshipTiers.plata}</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">Bronce</p>
              <p className="mt-1 text-lg font-semibold text-amber-900">{summary.relationshipTiers.bronce}</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Validados</p>
              <p className="mt-1 font-semibold">{summary.relationshipTiers.validation.validado}</p>
            </div>
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Potenciales</p>
              <p className="mt-1 font-semibold">{summary.relationshipTiers.validation.potencial}</p>
            </div>
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Sin validar</p>
              <p className="mt-1 font-semibold">{summary.relationshipTiers.validation.sin_validar}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Equilibrio de la piramide</p>
              <p className="text-xs text-muted-foreground">
                Referencia sana: oro 5-10%, plata 25-35%, bronce 55-70%.
              </p>
            </div>
            <Badge variant="outline" className={balanceToneMap[summary.balanceHealth]}>
              {summary.balanceLabel}
            </Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{summary.balanceDetail}</p>
          {summary.balanceIssues.length > 0 && (
            <div className="mt-3 space-y-2">
              {summary.balanceIssues.map((issue) => (
                <div key={issue} className="rounded-lg bg-muted/20 px-3 py-2 text-sm">
                  {issue}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Plan anual de cobertura</p>
              <p className="text-xs text-muted-foreground">
                Objetivo: 4 toques al ano por contacto util, con intensidad distinta segun productividad.
              </p>
            </div>
            <Badge variant="outline">{summary.averageTouchesPerContact.toFixed(1)} toques/contacto</Badge>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Comidas / ano</p>
              <p className="mt-1 text-lg font-semibold">{summary.annualTouchPlan.meals}</p>
            </div>
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Cafes / ano</p>
              <p className="mt-1 text-lg font-semibold">{summary.annualTouchPlan.coffees}</p>
            </div>
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Llamadas / ano</p>
              <p className="mt-1 text-lg font-semibold">{summary.annualTouchPlan.calls}</p>
            </div>
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">Emails / ano</p>
              <p className="mt-1 text-lg font-semibold">{summary.annualTouchPlan.emails}</p>
            </div>
            <div className="rounded-lg bg-muted/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">WhatsApps / ano</p>
              <p className="mt-1 text-lg font-semibold">{summary.annualTouchPlan.whatsapps}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {summary.touchPlanBySegment
              .filter((segment) => segment.count > 0)
              .map((segment) => (
                <div key={segment.key} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{segment.label}</span>
                    <span className="text-muted-foreground">{segment.count} contactos</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {segment.recipe.meals > 0 ? `${segment.recipe.meals} comida, ` : ''}
                    {segment.recipe.coffees > 0 ? `${segment.recipe.coffees} cafe, ` : ''}
                    {segment.recipe.calls > 0 ? `${segment.recipe.calls} llamada, ` : ''}
                    {segment.recipe.emails > 0 ? `${segment.recipe.emails} email, ` : ''}
                    {segment.recipe.whatsapps > 0 ? `${segment.recipe.whatsapps} WhatsApp` : ''}
                    {' '}por contacto y ano
                  </p>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-xl bg-muted/30 p-4 text-sm">
          {summary.action}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate('/contacts')}>
            Trabajar mi circulo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentInfluenceCircleCard;
