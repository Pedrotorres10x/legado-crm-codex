import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ChevronRight, CircleCheckBig, FileWarning, Landmark, Signature, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildClosingOperationalBlockers } from '@/lib/closing-ops';

type Agent = {
  user_id: string;
  full_name: string;
};

type PropertyRow = {
  id: string;
  title: string;
  city: string | null;
  status: string;
  agent_id: string | null;
  legal_risk_level: string | null;
  reservation_date: string | null;
  reservation_amount: number | null;
  arras_status: string | null;
  arras_date: string | null;
  arras_amount: number | null;
  arras_buyer_id: string | null;
  deed_date: string | null;
  deed_notary: string | null;
  updated_at: string;
};

type ClosingRadarItem = PropertyRow & {
  blockers: string[];
  missingDocCount: number;
  pendingSignatureCount: number;
  stage: string;
  ownerCount: number;
};

const AdminClosingRadar = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [agents, setAgents] = useState<Agent[]>([]);
  const selectedAgentId = searchParams.get('agent') || 'all';
  const [items, setItems] = useState<ClosingRadarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name')
      .then(({ data }) => {
        if (data) setAgents(data.filter((agent) => agent.full_name));
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchClosingRadar = async () => {
      setLoading(true);

      let query = supabase
        .from('properties')
        .select('id, title, city, status, agent_id, legal_risk_level, reservation_date, reservation_amount, arras_status, arras_date, arras_amount, arras_buyer_id, deed_date, deed_notary, updated_at')
        .or('reservation_date.not.is.null,arras_status.neq.sin_arras,deed_date.not.is.null,status.eq.arras,status.eq.reservado')
        .order('updated_at', { ascending: false })
        .limit(18);

      if (selectedAgentId !== 'all') {
        query = query.eq('agent_id', selectedAgentId);
      }

      const { data: properties } = await query;
      const baseRows = (properties || []) as PropertyRow[];

      const enriched = await Promise.all(baseRows.map(async (property) => {
        const [docsRes, signaturesRes, ownersRes] = await Promise.all([
          supabase.from('property_documents').select('doc_type').eq('property_id', property.id),
          supabase
            .from('documents')
            .select('generated_contracts(signature_status), document_properties!inner(property_id)')
            .eq('document_properties.property_id', property.id),
          supabase.from('property_owners').select('id', { count: 'exact', head: true }).eq('property_id', property.id),
        ]);

        const uploadedDocTypes = Array.from(new Set((docsRes.data || []).map((doc: any) => doc.doc_type).filter(Boolean)));
        const pendingSignatureCount = (signaturesRes.data || [])
          .filter((doc: any) => doc.generated_contracts?.signature_status === 'pendiente')
          .length;
        const ownerCount = ownersRes.count || 0;

        const analysis = buildClosingOperationalBlockers({
          property,
          propertyOwnerCount: ownerCount,
          uploadedDocTypes,
          pendingSignatureCount,
        });

        return {
          ...property,
          blockers: analysis.blockers,
          missingDocCount: analysis.missingRequiredDocs.length,
          pendingSignatureCount,
          ownerCount,
          stage: analysis.activeStep,
        };
      }));

      if (cancelled) return;

      setItems(enriched.filter((item) => item.blockers.length > 0).slice(0, 8));
      setLoading(false);
    };

    fetchClosingRadar();

    return () => {
      cancelled = true;
    };
  }, [selectedAgentId]);

  const agentNameMap = useMemo(
    () => new Map(agents.map((agent) => [agent.user_id, agent.full_name] as const)),
    [agents],
  );

  const summary = useMemo(() => ({
    blocked: items.length,
    overdue: items.filter((item) => item.deed_date && isPast(new Date(item.deed_date)) && item.status !== 'vendido' && item.status !== 'alquilado').length,
    pendingSignatures: items.filter((item) => item.pendingSignatureCount > 0).length,
  }), [items]);

  const operationsUrl = useMemo(() => (
    selectedAgentId === 'all'
      ? '/operations?preset=closing'
      : `/operations?preset=closing&agent=${selectedAgentId}`
  ), [selectedAgentId]);

  return (
    <Card id="admin-closing-radar" className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Radar de cierre
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Solo muestra operaciones con bloqueos reales en reserva, arras o escritura.
            </p>
          </div>
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
          <Button size="sm" variant="outline" onClick={() => navigate(operationsUrl)}>
            Centro de operaciones
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-destructive">Bloqueadas</p>
            <p className="text-2xl font-semibold mt-1">{summary.blocked}</p>
          </div>
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Escritura vencida</p>
            <p className="text-2xl font-semibold mt-1">{summary.overdue}</p>
          </div>
          <div className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-sky-700">Firma pendiente</p>
            <p className="text-2xl font-semibold mt-1">{summary.pendingSignatures}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando operaciones bloqueadas...</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="text-sm font-medium text-emerald-700 flex items-center gap-2">
              <CircleCheckBig className="h-4 w-4" />
              No hay operaciones bloqueadas en cierre ahora mismo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full rounded-xl border px-4 py-3 text-left hover:bg-accent/40 transition-colors"
                onClick={() => navigate(`/properties/${item.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <Badge variant="destructive">{item.stage}</Badge>
                      {item.missingDocCount > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <FileWarning className="h-3 w-3" />
                          {item.missingDocCount} doc.
                        </Badge>
                      )}
                      {item.pendingSignatureCount > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Signature className="h-3 w-3" />
                          {item.pendingSignatureCount} firma(s)
                        </Badge>
                      )}
                      {item.ownerCount === 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <UserCheck className="h-3 w-3" />
                          Sin propietario
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {[item.city, item.status].filter(Boolean).join(' · ') || 'Sin contexto adicional'}
                    </p>
                    {item.agent_id && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Agente: {agentNameMap.get(item.agent_id) || 'Asignado'}
                      </p>
                    )}
                    <p className="text-xs mt-2 text-destructive line-clamp-2">
                      {item.blockers[0]}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/properties/${item.id}#cierre`);
                        }}
                      >
                        Ir a cierre
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/properties/${item.id}#expediente`);
                        }}
                      >
                        Abrir expediente
                      </Button>
                      {item.arras_buyer_id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/contacts/${item.arras_buyer_id}`);
                          }}
                        >
                          Abrir comprador
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <AlertTriangle className="h-4 w-4 text-destructive ml-auto" />
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Actualizado {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true, locale: es })}
                    </p>
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

export default AdminClosingRadar;
