import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Rss, Send, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import IdealistaApiPanel from './IdealistaApiPanel';
import { FotocasaApiCard } from '@/components/portals/FotocasaApiCard';
import { PortalFeedCards } from '@/components/portals/PortalFeedCards';
import { FEED_BASE_URL } from '@/components/portals/portal-feed-shared';
import { usePortalFeedsManager } from '@/hooks/usePortalFeedsManager';

const PortalFeedsManager = () => {
  const {
    feeds,
    loading,
    forcingAll,
    lastCronRuns,
    toggleActive,
    copyFeedUrl,
    testFeed,
    forceFeed,
    forceAllFeeds,
  } = usePortalFeedsManager();

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando portales...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Rss className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Portales de Difusión</h2>
        <Badge variant="secondary" className="ml-auto">
          {feeds.filter((feed) => feed.is_active).length + 1} activos
        </Badge>
        <Button size="sm" className="h-8 text-xs gap-1.5" disabled={forcingAll} onClick={forceAllFeeds}>
          <Send className={`h-3.5 w-3.5 ${forcingAll ? 'animate-pulse' : ''}`} />
          {forcingAll ? 'Enviando...' : 'Forzar reenvío a todos'}
        </Button>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)] bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Programación de sincronización automática</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between text-xs p-2 rounded-md bg-background">
              <div>
                <span className="font-medium">Fotocasa (API)</span>
                <span className="text-muted-foreground ml-2">Cada 12h + en cada cambio</span>
              </div>
              <span className="text-muted-foreground">
                {lastCronRuns.fotocasa
                  ? `Último: ${formatDistanceToNow(new Date(lastCronRuns.fotocasa), { addSuffix: true, locale: es })}`
                  : 'Sin ejecución'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs p-2 rounded-md bg-background">
              <div>
                <span className="font-medium">Feeds XML</span>
                <span className="text-muted-foreground ml-2">Cada 12h (00:00, 12:00 UTC)</span>
              </div>
              <span className="text-muted-foreground">
                {lastCronRuns.xml
                  ? `Último: ${formatDistanceToNow(new Date(lastCronRuns.xml), { addSuffix: true, locale: es })}`
                  : 'Sin ejecución'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FotocasaApiCard />
        <IdealistaApiPanel />
        <PortalFeedCards
          feeds={feeds}
          onToggleActive={toggleActive}
          onCopyFeedUrl={copyFeedUrl}
          onTestFeed={testFeed}
          onForceFeed={forceFeed}
          feedBaseUrl={FEED_BASE_URL}
        />
      </div>

      {feeds.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay portales XML/JSON configurados. Fotocasa funciona vía API REST.
        </p>
      )}
    </div>
  );
};

export default PortalFeedsManager;
