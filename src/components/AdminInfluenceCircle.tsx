import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Network } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getAgentInfluenceCircle } from '@/lib/agent-influence-circle';

type AgentProfile = {
  user_id: string;
  full_name: string | null;
};

type CircleRow = ReturnType<typeof getAgentInfluenceCircle> & {
  agentId: string;
  name: string;
};
type InfluenceCircleContact = Parameters<typeof getAgentInfluenceCircle>[0][number] & {
  agent_id?: string | null;
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

const AdminInfluenceCircle = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CircleRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [{ data: profiles }, { data: contacts }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').order('full_name'),
        supabase.from('contacts').select('id, agent_id, full_name, contact_type, status, tags, source_ref'),
      ]);

      if (cancelled) return;

      const agents = ((profiles || []) as AgentProfile[]).filter((profile) => profile.full_name);
      const contactRows = (contacts as InfluenceCircleContact[]) || [];

      const nextRows = agents
        .map((agent) => ({
          agentId: agent.user_id,
          name: agent.full_name || 'Sin nombre',
          ...getAgentInfluenceCircle(contactRows.filter((contact) => contact.agent_id === agent.user_id)),
        }))
        .sort((a, b) => a.total - b.total);

      setRows(nextRows);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const office = useMemo(() => {
    if (rows.length === 0) {
      return {
        total: 0,
        red: 0,
        green: 0,
      };
    }

    return {
      total: Math.round(rows.reduce((sum, row) => sum + row.total, 0) / rows.length),
      red: rows.filter((row) => row.health === 'red').length,
      green: rows.filter((row) => row.health === 'green').length,
    };
  }, [rows]);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          Círculo de influencia útil
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Menos de 300 contactos útiles es rojo. Entre 300 y 400 es el objetivo. Hasta 500 aguanta; por encima empieza a costar trabajarlos bien.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Media equipo</p>
                  <p className="mt-2 text-2xl font-bold">{office.total}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Contactos útiles por agente</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Agentes en rojo</p>
                  <p className="mt-2 text-2xl font-bold">{office.red}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Con círculo insuficiente</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Agentes en zona buena</p>
                  <p className="mt-2 text-2xl font-bold">{office.green}</p>
                  <p className="mt-1 text-sm text-muted-foreground">En plata u oro</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.slice(0, 6).map((row) => (
                <div key={row.agentId} className="rounded-xl border border-border/60 bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{row.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.total} contactos útiles</p>
                    </div>
                    <Badge variant="outline" className={tierToneMap[row.tier]}>
                      {row.label}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {row.segments.map((segment) => (
                      <div key={segment.key} className="rounded-lg bg-muted/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">{segment.label}</p>
                        <p className="mt-1 font-semibold">{segment.count}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground">{row.detail}</p>

                  <div className="mt-3 rounded-lg bg-primary/5 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Ritmo recomendado</p>
                      <Badge variant="outline">{row.recommendedDailyTouches} toques/dia</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Minimo fijo 4/dia. Con {row.total} contactos utiles, este agente necesita unas {row.recommendedWeeklyTouches} acciones por semana para cubrir bien su circulo.
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-lg bg-yellow-50 px-3 py-2">
                      <p className="text-xs text-yellow-700">Oro</p>
                      <p className="mt-1 font-semibold text-yellow-900">{row.relationshipTiers.oro}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-700">Plata</p>
                      <p className="mt-1 font-semibold text-slate-900">{row.relationshipTiers.plata}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-3 py-2">
                      <p className="text-xs text-amber-700">Bronce</p>
                      <p className="mt-1 font-semibold text-amber-900">{row.relationshipTiers.bronce}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Equilibrio del circulo</p>
                      <Badge variant="outline" className={balanceToneMap[row.balanceHealth]}>
                        {row.balanceLabel}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{row.balanceDetail}</p>
                  </div>

                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Cobertura anual</p>
                      <Badge variant="outline">{row.averageTouchesPerContact.toFixed(1)} toques/contacto</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-background/80 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Comidas</p>
                        <p className="mt-1 font-semibold">{row.annualTouchPlan.meals}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Cafes</p>
                        <p className="mt-1 font-semibold">{row.annualTouchPlan.coffees}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Llamadas</p>
                        <p className="mt-1 font-semibold">{row.annualTouchPlan.calls}</p>
                      </div>
                      <div className="rounded-lg bg-background/80 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Emails + WhatsApps</p>
                        <p className="mt-1 font-semibold">{row.annualTouchPlan.emails + row.annualTouchPlan.whatsapps}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Prescriptores trabajan con comida + cafe; zona y colaboradores con cafe; la base amplia se sostiene con llamada, email y WhatsApp.
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/contacts">Abrir contactos</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminInfluenceCircle;
