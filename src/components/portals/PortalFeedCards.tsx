import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, ExternalLink, Send, Timer } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PortalFeed } from './portal-feed-shared';

type PortalFeedCardsProps = {
  feeds: PortalFeed[];
  onToggleActive: (feed: PortalFeed) => void;
  onCopyFeedUrl: (feed: PortalFeed) => void;
  onTestFeed: (feed: PortalFeed) => void;
  onForceFeed: (feed: PortalFeed) => void;
  feedBaseUrl: string;
};

export function PortalFeedCards({ feeds, onToggleActive, onCopyFeedUrl, onTestFeed, onForceFeed, feedBaseUrl }: PortalFeedCardsProps) {
  return (
    <>
      {feeds.map((feed) => (
        <Card key={feed.id} className={`border-0 shadow-[var(--shadow-card)] transition-opacity ${!feed.is_active ? 'opacity-60' : ''}`}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">{feed.display_name}</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {feed.format}
                  </Badge>
                  {feed.properties_count > 0 && <Badge variant="secondary" className="text-xs">{feed.properties_count} inmuebles</Badge>}
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Timer className="h-2.5 w-2.5" />
                    Cada 12h
                  </span>
                </div>
              </div>
              <Switch checked={feed.is_active} onCheckedChange={() => onToggleActive(feed)} />
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <div>
                Última regeneración CRM: {formatDistanceToNow(new Date(feed.updated_at), { addSuffix: true, locale: es })}
              </div>
              <div>
                {feed.last_accessed_at
                  ? <>Última petición detectada a la URL: {formatDistanceToNow(new Date(feed.last_accessed_at), { addSuffix: true, locale: es })}</>
                  : 'No hay peticiones registradas todavía sobre esta URL'}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">URL del feed</label>
              <div className="flex gap-1">
                <Input readOnly value={`${feedBaseUrl}?token=${feed.feed_token}`} className="text-xs font-mono h-8" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => onCopyFeedUrl(feed)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copiar URL</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => onTestFeed(feed)}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previsualizar feed</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {feed.api_credentials && Object.keys(feed.api_credentials).length > 0 && <div className="text-xs text-muted-foreground">🔑 Credenciales API configuradas</div>}

            <p className="text-xs text-muted-foreground">
              La primera línea refleja cuándo el CRM dejó el feed regenerado. La segunda refleja la última petición detectada a la URL, ya sea del portal o de una regeneración lanzada desde el CRM.
            </p>

            {feed.is_active && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full" onClick={() => onForceFeed(feed)}>
                <Send className="h-3.5 w-3.5" />
                Regenerar feed
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
