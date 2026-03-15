import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Film, Image, ShieldCheck, TriangleAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getAgentRecordRichness } from '@/lib/agent-record-richness';

type AgentProfile = {
  user_id: string;
  full_name: string | null;
};

type PropertyRow = {
  id: string;
  agent_id: string | null;
  status?: string | null;
  title?: string | null;
  price?: number | null;
  address?: string | null;
  city?: string | null;
  description?: string | null;
  images?: string[] | null;
  videos?: string[] | null;
  virtual_tour_url?: string | null;
  reference?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  surface_area?: number | null;
  mandate_type?: string | null;
};

type RichnessAgentRow = ReturnType<typeof getAgentRecordRichness> & {
  agentId: string;
  name: string;
};

const toneMap = {
  rich: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: ShieldCheck,
  },
  fragile: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Image,
  },
  poor: {
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: TriangleAlert,
  },
};

const AdminAgentRecordRichness = () => {
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<RichnessAgentRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [{ data: profiles }, { data: properties }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').order('full_name'),
        supabase
          .from('properties')
          .select(
            'id, agent_id, status, title, price, address, city, description, images, videos, virtual_tour_url, reference, bedrooms, bathrooms, surface_area, mandate_type',
          ),
      ]);

      if (cancelled) return;

      const agentProfiles = ((profiles || []) as AgentProfile[]).filter((profile) => profile.user_id);
      const propertyRows = (properties || []) as PropertyRow[];

      const rows = agentProfiles
        .map((profile) => {
          const summary = getAgentRecordRichness(propertyRows.filter((property) => property.agent_id === profile.user_id));
          return {
            agentId: profile.user_id,
            name: profile.full_name || 'Sin nombre',
            ...summary,
          };
        })
        .filter((row) => row.total > 0)
        .sort((a, b) => {
          if (b.poorCount !== a.poorCount) return b.poorCount - a.poorCount;
          return a.averageScore - b.averageScore;
        });

      setAgents(rows);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const office = useMemo(() => {
    if (agents.length === 0) {
      return {
        totalListings: 0,
        averageScore: 0,
        poorAgents: 0,
        richAgents: 0,
      };
    }

    return {
      totalListings: agents.reduce((sum, agent) => sum + agent.total, 0),
      averageScore: Math.round(agents.reduce((sum, agent) => sum + agent.averageScore, 0) / agents.length),
      poorAgents: agents.filter((agent) => agent.health === 'poor').length,
      richAgents: agents.filter((agent) => agent.health === 'rich').length,
    };
  }, [agents]);

  const officeMessage =
    office.averageScore >= 80
      ? 'La oficina está trabajando producto rico. Eso ayuda a captar mejor, enseñar mejor y vender mejor.'
      : office.averageScore >= 50
        ? 'Hay producto aprovechable, pero todavía hay demasiadas fichas que frenan confianza del propietario y conversión comprador.'
        : 'La calidad media de ficha es baja. Aquí hay una palanca clara de captación y venta para dirección.';

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5 text-primary" />
          Calidad comercial de fichas
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ficha rica no es burocracia: es mejor captación, mejor presentación y más probabilidad de venta.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="grid gap-3 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Oficina</p>
                  <p className="mt-2 text-2xl font-bold">{office.averageScore}/100</p>
                  <p className="mt-1 text-sm text-muted-foreground">Calidad media de ficha</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Producto activo</p>
                  <p className="mt-2 text-2xl font-bold">{office.totalListings}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Inmuebles disponibles</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Agentes en rojo</p>
                  <p className="mt-2 text-2xl font-bold">{office.poorAgents}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Trabajando con ficha pobre</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Agentes sólidos</p>
                  <p className="mt-2 text-2xl font-bold">{office.richAgents}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Con producto rico</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{officeMessage}</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Dónde actuar primero</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {agents.slice(0, 6).map((agent) => {
                  const tone = toneMap[agent.health];
                  const Icon = tone.icon;

                  return (
                    <div key={agent.agentId} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{agent.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{agent.total} inmuebles disponibles</p>
                        </div>
                        <Badge variant="outline" className={tone.badge}>
                          <Icon className="mr-1 h-3 w-3" />
                          {agent.label}
                        </Badge>
                      </div>

                      <p className="mt-3 text-2xl font-bold">{agent.averageScore}/100</p>
                      <p className="mt-1 text-sm text-muted-foreground">{agent.detail}</p>

                      {agent.topGaps.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {agent.topGaps.map((gap) => (
                            <Badge key={`${agent.agentId}-${gap.issue}`} variant="secondary">
                              {gap.label}: {gap.count}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Pobres: {agent.poorCount} · Ricas: {agent.richCount}
                        </span>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/properties">
                            Abrir inmuebles <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAgentRecordRichness;
