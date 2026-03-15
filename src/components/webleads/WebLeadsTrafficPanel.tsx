import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ExternalLink } from 'lucide-react';

type WebLeadsTrafficPanelProps = {
  topSources: [string, number][];
  uniqueSessions: number;
  topReferrers: [string, number][];
};

export function WebLeadsTrafficPanel({
  topSources,
  uniqueSessions,
  topReferrers,
}: WebLeadsTrafficPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" /> Canales de tráfico
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {topSources.map(([source, count]) => {
              const pct = uniqueSessions > 0 ? Math.round((count / uniqueSessions) * 100) : 0;
              const isFbCampaign = source === 'Facebook (campaña)';
              const isFbGeneric = source === 'Facebook';

              return (
                <div key={source} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center text-xs mb-1 gap-2">
                      <span className="flex items-center gap-1.5 font-medium text-foreground min-w-0">
                        {source}
                        {isFbCampaign && (
                          <Badge className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/30 shrink-0">
                            UTM ✓
                          </Badge>
                        )}
                        {isFbGeneric && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-4 text-muted-foreground shrink-0"
                            title="Sin UTMs — atribuido por referrer"
                          >
                            ref
                          </Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground shrink-0 ml-2">{count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full">
                      <div
                        className="h-1.5 bg-primary rounded-full"
                        style={{ width: `${pct}%`, opacity: isFbCampaign ? 1 : 0.65 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {topSources.some(([source]) => source === 'Facebook' || source === 'Facebook (campaña)') && (
            <div className="px-4 py-3 border-t border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong>Facebook:</strong> sesiones sin UTMs atribuidas por referrer.{' '}
                <strong>Facebook (campaña):</strong> UTMs capturados correctamente.{' '}
                El in-app browser de Meta elimina UTMs — configura los parámetros en Meta Ads Manager.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-primary" /> Referrers detallados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topReferrers.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Sin referrers — todo el tráfico es directo o aún no hay datos suficientes
            </div>
          ) : (
            <div className="divide-y divide-border">
              {topReferrers.map(([referrer, count]) => (
                <div key={referrer} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-muted/30">
                  <span className="text-xs text-foreground truncate">{referrer}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
