import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GitMerge, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';

const PIPELINE_STAGES = [
  { key: 'prospecto', label: 'Lead', warnDays: 3, criticalDays: 7 },
  { key: 'nuevo', label: 'Nuevo', warnDays: 3, criticalDays: 7 },
  { key: 'contactado', label: 'Contactado', warnDays: 5, criticalDays: 10 },
  { key: 'en_seguimiento', label: 'Seguimiento', warnDays: 7, criticalDays: 14 },
  { key: 'cualificado', label: 'Cualificado', warnDays: 7, criticalDays: 14 },
  { key: 'visita_programada', label: 'Visita', warnDays: 5, criticalDays: 10 },
  { key: 'visita_tasacion', label: 'Visita tasacion', warnDays: 7, criticalDays: 12 },
  { key: 'visitando', label: 'Visitando', warnDays: 7, criticalDays: 12 },
  { key: 'negociando', label: 'Negociando', warnDays: 5, criticalDays: 10 },
  { key: 'oferta', label: 'Oferta', warnDays: 3, criticalDays: 7 },
  { key: 'captado', label: 'Captado', warnDays: 7, criticalDays: 14 },
  { key: 'en_venta', label: 'En venta', warnDays: 10, criticalDays: 21 },
  { key: 'reserva', label: 'Reserva', warnDays: 5, criticalDays: 10 },
  { key: 'arras', label: 'Arras', warnDays: 7, criticalDays: 14 },
  { key: 'escritura', label: 'Escritura', warnDays: 10, criticalDays: 21 },
];

const ACTIVE_PIPELINE_STAGES = PIPELINE_STAGES.map((stage) => stage.key);

type StagnantContact = {
  id: string;
  full_name: string;
  pipeline_stage: string;
  daysSinceMove: number;
  severity: 'warn' | 'critical';
};

const PipelineVelocity = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stagnant, setStagnant] = useState<StagnantContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchVelocity();
  }, [user?.id]);

  const fetchVelocity = async () => {
    const uid = user!.id;
    const now = new Date();

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, full_name, pipeline_stage, updated_at')
      .eq('agent_id', uid)
      .in('status', ['nuevo', 'en_seguimiento', 'activo'])
      .not('pipeline_stage', 'is', null)
      .in('pipeline_stage', ACTIVE_PIPELINE_STAGES as any);

    const contactList = contacts || [];
    const contactIds = contactList.map(c => c.id);

    // Get latest pipeline_stage change from audit_log
    let latestStageChangeByContact: Record<string, string> = {};
    if (contactIds.length > 0) {
      const { data: auditEntries } = await supabase
        .from('audit_log')
        .select('record_id, created_at')
        .eq('table_name', 'contacts')
        .eq('field_name', 'pipeline_stage')
        .in('record_id', contactIds)
        .order('created_at', { ascending: false });

      (auditEntries || []).forEach((entry: any) => {
        if (!latestStageChangeByContact[entry.record_id]) {
          latestStageChangeByContact[entry.record_id] = entry.created_at;
        }
      });
    }

    const result: StagnantContact[] = [];

    for (const contact of contactList) {
      const stage = PIPELINE_STAGES.find(s => s.key === contact.pipeline_stage);
      if (!stage) continue;

      const lastMoveDate = latestStageChangeByContact[contact.id]
        ? new Date(latestStageChangeByContact[contact.id])
        : new Date(contact.updated_at);

      const daysSinceMove = differenceInDays(now, lastMoveDate);

      let severity: 'warn' | 'critical' | null = null;
      if (daysSinceMove >= stage.criticalDays) severity = 'critical';
      else if (daysSinceMove >= stage.warnDays) severity = 'warn';

      if (severity) {
        result.push({
          id: contact.id,
          full_name: contact.full_name,
          pipeline_stage: contact.pipeline_stage,
          daysSinceMove,
          severity,
        });
      }
    }

    result.sort((a, b) => b.daysSinceMove - a.daysSinceMove);
    setStagnant(result);
    setLoading(false);
  };

  if (loading || stagnant.length === 0) return null;

  const critical = stagnant.filter(c => c.severity === 'critical');
  const warn = stagnant.filter(c => c.severity === 'warn');

  return (
    <Card className="animate-fade-in-up border-0 shadow-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            Velocidad del Pipeline
            {critical.length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5">
                {critical.length} estancado{critical.length > 1 ? 's' : ''}
              </Badge>
            )}
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
            {expanded ? 'Ocultar' : `Ver ${stagnant.length}`}
          </Button>
        </CardTitle>
      </CardHeader>

      {/* Summary bar */}
      <CardContent className="pb-2">
        <div className="flex gap-3 text-xs">
          {critical.length > 0 && (
            <span className="flex items-center gap-1 text-destructive font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {critical.length} crítico{critical.length > 1 ? 's' : ''}
            </span>
          )}
          {warn.length > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              {warn.length} en advertencia
            </span>
          )}
        </div>

        {expanded && (
          <div className="mt-3 space-y-1.5 border-t pt-3">
            {stagnant.slice(0, 8).map(contact => {
              const stageLabel = PIPELINE_STAGES.find(s => s.key === contact.pipeline_stage)?.label ?? contact.pipeline_stage;
              const isCritical = contact.severity === 'critical';
              return (
                <button
                  key={contact.id}
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                  className={`flex items-center justify-between w-full text-xs px-2 py-1.5 rounded-lg transition-colors text-left ${
                    isCritical
                      ? 'hover:bg-red-100 dark:hover:bg-red-900/30'
                      : 'hover:bg-amber-100 dark:hover:bg-amber-900/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCritical ? 'bg-destructive' : 'bg-amber-500'}`} />
                    <span className="truncate max-w-[160px] font-medium">{contact.full_name}</span>
                    <span className="text-muted-foreground shrink-0">{stageLabel}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ml-2 ${
                      isCritical
                        ? 'text-destructive border-red-300 dark:border-red-700'
                        : 'text-amber-600 border-amber-300 dark:border-amber-700'
                    }`}
                  >
                    {contact.daysSinceMove}d
                  </Badge>
                </button>
              );
            })}
            {stagnant.length > 8 && (
              <p className="text-xs text-muted-foreground pl-2">+{stagnant.length - 8} más</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PipelineVelocity;
