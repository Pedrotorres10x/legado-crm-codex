import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, ImageOff, Rss, ShieldCheck, ShieldX } from 'lucide-react';
import { getPropertyStockSummary } from '@/lib/property-stock-health';

type StockProperty = {
  status?: string | null;
  [key: string]: unknown;
};

export const PropertiesStockSummary = ({ properties }: { properties: StockProperty[] }) => {
  const summary = getPropertyStockSummary(properties);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stock publicable</p>
          <p className="text-3xl font-semibold mt-2">{summary.availableCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Inmuebles en disponible dentro de cartera activa.</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Mandato</p>
          </div>
          <p className="text-3xl font-semibold mt-2">{summary.exclusiveCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.sharedCount} compartidas · {summary.noMandateCount} sin mandato.
          </p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <ShieldX className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Mandato vencido</p>
          </div>
          <p className="text-3xl font-semibold mt-2">{summary.expiredMandateCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Stock disponible que ya pide renovación.</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <Globe className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Difusión</p>
          </div>
          <p className="text-3xl font-semibold mt-2">{summary.feedReadyCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Feed XML/HabiHub · {summary.distributionGapCount} sin difusión activa.
          </p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-rose-700">
            <ImageOff className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Ficha floja</p>
          </div>
          <p className="text-3xl font-semibold mt-2">{summary.missingPublishBasicsCount}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]"><Globe className="h-3 w-3 mr-1" />Publicación</Badge>
            <Badge variant="outline" className="text-[10px]"><Rss className="h-3 w-3 mr-1" />Feed</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
