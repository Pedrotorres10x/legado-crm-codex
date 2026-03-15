import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, BarChart2, Globe, TrendingUp } from 'lucide-react';

type WebLeadsCampaignsPanelProps = {
  totalUtmPV: number;
  topUtmSources: [string, number][];
  topUtmMediums: [string, number][];
  topUtmCampaigns: [string, number][];
  utmMediumCounts: Record<string, number>;
  utmCampaignCounts: Record<string, number>;
};

export function WebLeadsCampaignsPanel({
  totalUtmPV,
  topUtmSources,
  topUtmMediums,
  topUtmCampaigns,
  utmMediumCounts,
  utmCampaignCounts,
}: WebLeadsCampaignsPanelProps) {
  if (totalUtmPV === 0) {
    return (
      <div className="space-y-4">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
            <BarChart2 className="h-12 w-12 opacity-20" />
            <p className="font-medium text-sm">Sin datos UTM aún</p>
            <p className="text-xs opacity-60 text-center max-w-sm">
              Los parámetros UTM se capturan automáticamente cuando el tráfico llega con
              <code className="bg-muted px-1 rounded mx-1">utm_source</code>,
              <code className="bg-muted px-1 rounded mx-1">utm_medium</code> o
              <code className="bg-muted px-1 rounded">utm_campaign</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" /> Fuente (utm_source)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {topUtmSources.map(([source, count]) => {
                const pct = totalUtmPV > 0 ? Math.round((count / totalUtmPV) * 100) : 0;
                return (
                  <div key={source} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-foreground truncate">{source}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full">
                        <div className="h-1.5 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Medio (utm_medium)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {topUtmMediums.map(([medium, count]) => {
                const total = Object.values(utmMediumCounts).reduce((acc, value) => acc + value, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={medium} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-foreground truncate">{medium}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full">
                        <div className="h-1.5 bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Campaña (utm_campaign)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topUtmCampaigns.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">Sin datos de campaña</div>
            ) : (
              <div className="divide-y divide-border">
                {topUtmCampaigns.map(([campaign, count]) => {
                  const total = Object.values(utmCampaignCounts).reduce((acc, value) => acc + value, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={campaign} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-foreground truncate" title={campaign}>{campaign}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">{count} · {pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full">
                          <div className="h-1.5 bg-primary/50 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
