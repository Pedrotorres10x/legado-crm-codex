import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ExternalLink, Globe, RefreshCw, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MlsPublishButtonProps {
  propertyId: string;
}

const MlsPublishButton = ({ propertyId }: MlsPublishButtonProps) => {
  const { toast } = useToast();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const fetchListing = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('mls_listings')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle();
    setListing(data);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { fetchListing(); }, [fetchListing]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('mls-publish', {
        body: { action: 'publish', property_id: propertyId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Error desconocido');
      toast({ title: '✅ Publicado en MLS Benidorm' });
      fetchListing();
    } catch (err: any) {
      toast({ title: 'Error publicando en MLS', description: err.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('mls-publish', {
        body: { action: 'unpublish', property_id: propertyId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Error desconocido');
      toast({ title: 'Retirado de MLS Benidorm' });
      fetchListing();
    } catch (err: any) {
      toast({ title: 'Error retirando de MLS', description: err.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return null;

  const isPublished = listing?.status === 'published';
  const hasError = listing?.status === 'error';

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">MLS Benidorm</p>
              {isPublished && (
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
                    Publicado
                  </Badge>
                  {listing.last_synced_at && (
                    <span className="text-xs text-muted-foreground">
                      Última sync: {new Date(listing.last_synced_at).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>
              )}
              {hasError && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className="bg-destructive/10 text-destructive border-0 text-xs">
                    <XCircle className="h-3 w-3 mr-1" />Error
                  </Badge>
                  <span className="text-xs text-destructive truncate max-w-[200px]">{listing.error_message}</span>
                </div>
              )}
              {!isPublished && !hasError && (
                <p className="text-xs text-muted-foreground mt-0.5">Publica este inmueble en la MLS de Benidorm</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPublished && (
              <>
                <a
                  href="https://www.mls-benidorm.es"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver MLS
                </a>
                <Button size="sm" variant="outline" onClick={handlePublish} disabled={publishing}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${publishing ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleUnpublish} disabled={publishing}>
                  Retirar
                </Button>
              </>
            )}
            {!isPublished && (
              <Button onClick={handlePublish} disabled={publishing} className="bg-blue-600 hover:bg-blue-700">
                {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
                Publicar en MLS
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MlsPublishButton;
