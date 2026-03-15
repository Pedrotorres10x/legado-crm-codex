import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import type { PerformanceData } from '@/hooks/useAgentPerformance';

interface Props {
  data: PerformanceData;
}

const STAGES = [
  { key: 'nuevo', label: 'Entrada', color: 'bg-emerald-500' },
  { key: 'en_seguimiento', label: 'Seguimiento', color: 'bg-emerald-400' },
  { key: 'activo', label: 'Trabajo activo', color: 'bg-sky-500' },
  { key: 'en_cierre', label: 'Cierre', color: 'bg-blue-600' },
  { key: 'cerrado', label: 'Cerrado', color: 'bg-indigo-600' },
];

const AgentPipelineEagle = ({ data }: Props) => {
  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Eye className="h-5 w-5 text-primary" />
          Vista aguila - pipeline CRM
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-3">
          {STAGES.map(stage => {
            const count = data.pipeline[stage.key] || 0;
            return (
              <div key={stage.key} className="relative rounded-xl bg-muted/50 border border-border/40 p-4 text-center overflow-hidden">
                <p className="text-3xl font-bold">{count}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{stage.label}</p>
                <div className={`absolute bottom-0 left-0 right-0 h-1 ${stage.color}`} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentPipelineEagle;
