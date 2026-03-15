import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ChevronRight, RefreshCw, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { reanalyzePropertyLegalDocuments } from '@/lib/property-document-ai';
import { useToast } from '@/hooks/use-toast';

type RiskProperty = {
  id: string;
  title: string;
  city: string | null;
  status: string;
  agent_id: string | null;
  legal_risk_level: string | null;
  legal_risk_summary: string | null;
  legal_risk_updated_at: string | null;
  legal_risk_docs_count: number;
};

type Agent = {
  user_id: string;
  full_name: string;
};

const AdminLegalRadar = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [properties, setProperties] = useState<RiskProperty[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const selectedAgentId = searchParams.get('agent') || 'all';
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingPropertyId, setRefreshingPropertyId] = useState<string | null>(null);

  const fetchLegalRisk = async () => {
    let query = supabase
      .from('properties')
      .select('id, title, city, status, agent_id, legal_risk_level, legal_risk_summary, legal_risk_updated_at, legal_risk_docs_count')
      .in('legal_risk_level', ['alto', 'medio', 'sin_datos'])
      .order('legal_risk_updated_at', { ascending: true, nullsFirst: true })
      .limit(12);

    if (selectedAgentId !== 'all') {
      query = query.eq('agent_id', selectedAgentId);
    }

    const { data } = await query;

    setProperties((data || []) as RiskProperty[]);
    setLoading(false);
  };

  useEffect(() => {
    supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name')
      .then(({ data }) => {
        if (data) {
          setAgents(data.filter((agent) => agent.full_name));
        }
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLegalRisk();
  }, [selectedAgentId]);

  const summary = useMemo(() => ({
    alto: properties.filter((property) => property.legal_risk_level === 'alto').length,
    medio: properties.filter((property) => property.legal_risk_level === 'medio').length,
    sin_datos: properties.filter((property) => property.legal_risk_level === 'sin_datos' || !property.legal_risk_level).length,
  }), [properties]);

  const operationsUrl = useMemo(() => (
    selectedAgentId === 'all'
      ? '/operations?preset=legal'
      : `/operations?preset=legal&agent=${selectedAgentId}`
  ), [selectedAgentId]);

  const agentNameMap = useMemo(() => {
    const entries = agents.map((agent) => [agent.user_id, agent.full_name] as const);
    return new Map(entries);
  }, [agents]);

  const handleRefreshProperty = async (propertyId: string) => {
    setRefreshingPropertyId(propertyId);
    try {
      const result = await reanalyzePropertyLegalDocuments(propertyId);
      await fetchLegalRisk();
      toast({
        title: 'Radar legal actualizado',
        description: result.analyzableCount > 0
          ? `He reanalizado ${result.analyzableCount} documento(s) del inmueble.`
          : 'Ese inmueble no tiene nota simple, escritura o catastro analizables.',
      });
    } catch (error: any) {
      toast({
        title: 'No se pudo actualizar el inmueble',
        description: error.message || 'Ha fallado la reanalisis legal.',
        variant: 'destructive',
      });
    } finally {
      setRefreshingPropertyId(null);
    }
  };

  const handleRefreshVisible = async () => {
    setRefreshingAll(true);
    try {
      for (const property of properties.slice(0, 6)) {
        await reanalyzePropertyLegalDocuments(property.id);
      }
      await fetchLegalRisk();
      toast({
        title: 'Radar legal refrescado',
        description: `He reanalizado ${Math.min(properties.length, 6)} inmueble(s) visibles del radar.`,
      });
    } catch (error: any) {
      toast({
        title: 'Actualización incompleta',
        description: error.message || 'No se pudieron reanalizar todos los inmuebles visibles.',
        variant: 'destructive',
      });
    } finally {
      setRefreshingAll(false);
      setRefreshingPropertyId(null);
    }
  };

  return (
    <Card id="admin-legal-radar" className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Radar legal
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Solo muestra inmuebles con riesgo alto, medio o sin revisar para no saturar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedAgentId}
              onValueChange={(value) => {
                const next = new URLSearchParams(searchParams);
                if (value === 'all') next.delete('agent');
                else next.set('agent', value);
                setSearchParams(next, { replace: true });
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos los agentes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los agentes</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.user_id} value={agent.user_id}>
                    {agent.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleRefreshVisible} disabled={refreshingAll || properties.length === 0}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshingAll ? 'animate-spin' : ''}`} />
              Actualizar radar
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(operationsUrl)}>
              Centro de operaciones
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/properties')}>
              Ver inmuebles
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-destructive">Riesgo alto</p>
            <p className="text-2xl font-semibold mt-1">{summary.alto}</p>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Riesgo medio</p>
            <p className="text-2xl font-semibold mt-1">{summary.medio}</p>
          </div>
          <div className="rounded-xl border border-muted bg-muted/40 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sin análisis</p>
            <p className="text-2xl font-semibold mt-1">{summary.sin_datos}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando radar legal...</p>
        ) : properties.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-sm font-medium text-emerald-700 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              No hay inmuebles con alertas legales persistidas ahora mismo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {properties.slice(0, 6).map((property) => (
              <button
                key={property.id}
                type="button"
                className="w-full rounded-xl border px-4 py-3 text-left hover:bg-accent/40 transition-colors"
                onClick={() => navigate(`/properties/${property.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{property.title}</p>
                      <Badge variant={property.legal_risk_level === 'alto' ? 'destructive' : property.legal_risk_level === 'medio' ? 'secondary' : 'outline'}>
                        {property.legal_risk_level === 'alto' ? 'Alto' : property.legal_risk_level === 'medio' ? 'Medio' : 'Sin análisis'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {property.legal_risk_docs_count || 0} doc.
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {[property.city, property.status].filter(Boolean).join(' · ') || 'Sin contexto adicional'}
                    </p>
                    {property.agent_id && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Agente: {agentNameMap.get(property.agent_id) || 'Asignado'}
                      </p>
                    )}
                    <p className="text-xs mt-2 text-muted-foreground line-clamp-2">
                      {property.legal_risk_summary || 'Pendiente de análisis legal con IA.'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {property.legal_risk_level === 'alto' ? (
                      <AlertTriangle className="h-4 w-4 text-destructive ml-auto" />
                    ) : property.legal_risk_level === 'medio' ? (
                      <ShieldAlert className="h-4 w-4 text-amber-600 ml-auto" />
                    ) : (
                      <ShieldQuestion className="h-4 w-4 text-muted-foreground ml-auto" />
                    )}
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {property.legal_risk_updated_at
                        ? `Actualizado ${formatDistanceToNow(new Date(property.legal_risk_updated_at), { addSuffix: true, locale: es })}`
                        : 'Pendiente'}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 mt-1 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRefreshProperty(property.id);
                      }}
                      disabled={refreshingAll || refreshingPropertyId === property.id}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${refreshingPropertyId === property.id ? 'animate-spin' : ''}`} />
                      Reanalizar
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto mt-2" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminLegalRadar;
