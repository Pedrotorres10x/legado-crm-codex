import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ExternalLink, Hash, LogOut, MousePointerClick } from 'lucide-react';

type WebLeadsPagesPanelProps = {
  topPages: [string, number][];
  totalPV: number;
  topEntryPages: [string, number][];
  topExitPages: [string, number][];
  blogPages: [string, number][];
  pageName: (page: string) => string;
};

export function WebLeadsPagesPanel({
  topPages,
  totalPV,
  topEntryPages,
  topExitPages,
  blogPages,
  pageName,
}: WebLeadsPagesPanelProps) {
  const getPageHref = (page: string) => {
    const normalizedPage = page.toLowerCase();
    return `https://www.legadocoleccion.es${normalizedPage.startsWith('/') ? normalizedPage : `/${normalizedPage}`}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-primary" /> Páginas más visitadas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {topPages.map(([page, count]) => {
              const pct = totalPV > 0 ? Math.round((count / totalPV) * 100) : 0;
              const href = getPageHref(page);
              return (
                <div key={page} className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 min-w-0 group" title={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 text-xs text-foreground truncate hover:text-primary hover:underline transition-colors"
                  >
                    {pageName(page)}
                  </a>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="w-14 h-1.5 bg-muted rounded-full shrink-0">
                    <div className="h-1.5 bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-7 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" /> Páginas de entrada (landing)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {topEntryPages.map(([page, count]) => (
                <div key={page} className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 min-w-0" title={page}>
                  <span className="flex-1 min-w-0 text-xs text-foreground truncate">{pageName(page)}</span>
                  <a
                    href={getPageHref(page)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Páginas de salida
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {topExitPages.map(([page, count]) => (
                <div key={page} className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 min-w-0" title={page}>
                  <span className="flex-1 min-w-0 text-xs text-foreground truncate">{pageName(page)}</span>
                  <a
                    href={getPageHref(page)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Badge variant="outline" className="text-[10px] shrink-0">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {blogPages.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" /> Artículos del blog
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {blogPages.map(([page, count]) => (
                  <div key={page} className="flex items-center justify-between gap-2 px-4 py-2" title={page}>
                    <span className="text-xs text-foreground truncate">{pageName(page)}</span>
                    <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 shrink-0">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
