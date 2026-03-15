import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitMerge } from 'lucide-react';
import type { PerformanceData } from '@/hooks/useAgentPerformance';

interface Props {
  data: PerformanceData;
}

const AgentConversionFunnel = ({ data }: Props) => {
  const { funnel } = data;
  const maxCount = Math.max(...funnel.map(f => f.count), 1);

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <GitMerge className="h-5 w-5 text-primary" />
          Embudo de conversión
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {funnel.map((stage, i) => {
          const widthPct = Math.max((stage.count / maxCount) * 100, 12);
          const ratio = i > 0 && funnel[i - 1].count > 0
            ? Math.round((stage.count / funnel[i - 1].count) * 100)
            : null;
          return (
            <div key={stage.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{stage.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-bold">{stage.count}</span>
                  {ratio !== null && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {ratio}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    background: `hsl(var(--primary) / ${1 - i * 0.15})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AgentConversionFunnel;
