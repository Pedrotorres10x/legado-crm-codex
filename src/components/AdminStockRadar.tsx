import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Globe, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getAgentStockRows, getPropertyStockSummary } from '@/lib/property-stock-health';

type Profile = {
  user_id: string;
  full_name: string | null;
};
type PropertyStockRow = Parameters<typeof getPropertyStockSummary>[0][number];

const AdminStockRadar = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyStockRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: propertyRows }, { data: profileRows }] = await Promise.all([
        supabase
          .from('properties')
          .select('id, title, status, agent_id, mandate_type, mandate_end, xml_id, source, price, images, description'),
        supabase.from('profiles').select('user_id, full_name').order('full_name'),
      ]);

      setProperties(propertyRows || []);
      setProfiles((profileRows || []) as Profile[]);
      setLoading(false);
    };

    load();
  }, []);

  const teamSummary = useMemo(() => getPropertyStockSummary(properties), [properties]);
  const agentRows = useMemo(() => {
    const names = new Map(profiles.map((profile) => [profile.user_id, profile.full_name || 'Sin nombre']));
    return getAgentStockRows(properties)
      .map((row) => ({
        ...row,
        name: names.get(row.agentId) || 'Sin nombre',
      }))
      .filter((row) => row.expiredMandateCount > 0 || row.noMandateCount > 0 || row.missingPublishBasicsCount > 0 || row.distributionGapCount > 0)
      .sort((a, b) => (b.expiredMandateCount + b.missingPublishBasicsCount + b.noMandateCount + b.distributionGapCount) - (a.expiredMandateCount + a.missingPublishBasicsCount + a.noMandateCount + a.distributionGapCount))
      .slice(0, 5);
  }, [profiles, properties]);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Radar de stock
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/properties')}>
            Ver stock
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Exclusivas</p>
            <p className="text-2xl font-semibold mt-1">{loading ? '...' : teamSummary.exclusiveCount}</p>
          </div>
          <div className="rounded-xl border border-border/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sin mandato</p>
            <p className="text-2xl font-semibold mt-1">{loading ? '...' : teamSummary.noMandateCount}</p>
          </div>
          <div className="rounded-xl border border-border/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Mandato vencido</p>
            <p className="text-2xl font-semibold mt-1">{loading ? '...' : teamSummary.expiredMandateCount}</p>
          </div>
          <div className="rounded-xl border border-border/50 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ficha floja</p>
            <p className="text-2xl font-semibold mt-1">{loading ? '...' : teamSummary.missingPublishBasicsCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 p-4">
          <p className="text-sm font-medium">Difusión pendiente</p>
          <p className="text-xs text-muted-foreground mt-1">
            {loading ? 'Calculando...' : `${teamSummary.distributionGapCount} inmueble${teamSummary.distributionGapCount === 1 ? '' : 's'} con ficha válida pero sin feed activo.`}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-medium">Agentes a vigilar</p>
              <p className="text-xs text-muted-foreground">Mandato, publicación y ficha base del stock activo.</p>
            </div>
            <Badge variant="outline" className="gap-1">
              <Globe className="h-3 w-3" />
              Feed {loading ? '...' : teamSummary.feedReadyCount}
            </Badge>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Calculando salud de stock...</p>
          ) : agentRows.length === 0 ? (
            <p className="text-sm text-emerald-700">No hay alertas fuertes de stock ahora mismo.</p>
          ) : (
            <div className="space-y-2">
              {agentRows.map((row) => (
                <button
                  key={row.agentId}
                  type="button"
                  className="w-full rounded-lg border px-3 py-3 text-left hover:bg-accent/40 transition-colors"
                  onClick={() => navigate(`/properties?agent=${row.agentId}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {row.expiredMandateCount} mandato{row.expiredMandateCount === 1 ? '' : 's'} vencido{row.expiredMandateCount === 1 ? '' : 's'}
                        {' · '}
                        {row.noMandateCount} sin mandato
                        {' · '}
                        {row.missingPublishBasicsCount} ficha{row.missingPublishBasicsCount === 1 ? '' : 's'} floja{row.missingPublishBasicsCount === 1 ? '' : 's'}
                        {' · '}
                        {row.distributionGapCount} sin difusión
                      </p>
                    </div>
                    <Badge variant={row.expiredMandateCount > 0 ? 'destructive' : 'secondary'}>
                      <ShieldAlert className="h-3 w-3 mr-1" />
                      Vigilar
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminStockRadar;
