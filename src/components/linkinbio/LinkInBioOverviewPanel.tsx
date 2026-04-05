import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Eye, MousePointerClick, Users, TrendingUp, Globe, Copy, Share2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type LinkInBioOverviewPanelProps = {
  agentProfile: {
    full_name: string | null;
    public_slug: string | null;
    avatar_url: string | null;
  } | null | undefined;
  pageviews: number;
  uniqueSessions: number;
  clicks: number;
  ctr: string;
};

type ShareError = {
  name?: string;
};

export function LinkInBioOverviewPanel({
  agentProfile,
  pageviews,
  uniqueSessions,
  clicks,
  ctr,
}: LinkInBioOverviewPanelProps) {
  const { toast } = useToast();
  const socialUrl = agentProfile?.public_slug ? `https://legadocoleccion.es/s/agente/${agentProfile.public_slug}` : '';

  return (
    <>
      {agentProfile?.public_slug && (
        <Card className="border-0 shadow-[var(--shadow-card)] overflow-hidden bg-gradient-to-r from-primary/5 via-background to-primary/5">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Avatar className="h-14 w-14 ring-2 ring-primary/20 shrink-0">
                {agentProfile.avatar_url && <AvatarImage src={agentProfile.avatar_url} />}
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                  {agentProfile.full_name?.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />Tu tarjeta virtual
                </p>
                <a
                  href={socialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-0.5 truncate font-mono block"
                >
                  legadocoleccion.es/s/agente/{agentProfile.public_slug}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={() => {
                  navigator.clipboard.writeText(socialUrl);
                  toast({ title: 'Enlace copiado ✅' });
                }}
              >
                <Copy className="h-3.5 w-3.5" />Copiar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={async () => {
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: `${agentProfile.full_name} - Asesor Inmobiliario`, url: socialUrl });
                    } else {
                      await navigator.clipboard.writeText(socialUrl);
                      toast({ title: 'Enlace copiado ✅' });
                    }
                  } catch (error: unknown) {
                    const shareError = error as ShareError;
                    if (shareError.name !== 'AbortError') {
                      try {
                        await navigator.clipboard.writeText(socialUrl);
                        toast({ title: 'Enlace copiado ✅' });
                      } catch {
                        toast({ title: 'Tu enlace', description: socialUrl });
                      }
                    }
                  }
                }}
              >
                <Share2 className="h-3.5 w-3.5" />Compartir
              </Button>
              <Button size="sm" className="rounded-xl gap-1.5" onClick={() => window.open(`https://legadocoleccion.es/agente/${agentProfile.public_slug}`, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5" />Ver
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pageviews.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Visitas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueSessions.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Visitantes únicos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <MousePointerClick className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clicks.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Clics en enlaces</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ctr}%</p>
                <p className="text-xs text-muted-foreground">CTR</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
