import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Settings, ExternalLink, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type CalendarProfileRow = {
  gcal_embed_url?: string | null;
};

const GoogleCalendarEmbed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [embedUrl, setEmbedUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    supabase
      .from('profiles')
      .select('gcal_embed_url')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const url = (data as CalendarProfileRow | null)?.gcal_embed_url ?? '';
        if (url) {
          setEmbedUrl(url);
          setInputUrl(url);
        }
        setLoading(false);
      });
  }, [user?.id]);

  const saveUrl = async () => {
    if (!user?.id) return;
    setSaving(true);

    let url = inputUrl.trim();
    // Extract src if user pasted a full <iframe ...> embed code
    const srcMatch = url.match(/src="([^"]+)"/);
    if (srcMatch) url = srcMatch[1];

    const { error } = await supabase
      .from('profiles')
      .update({ gcal_embed_url: url })
      .eq('user_id', user.id);

    setSaving(false);

    if (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
      return;
    }

    setEmbedUrl(url);
    setOpen(false);
    toast({ title: 'Calendario vinculado ✓', description: 'Tu Google Calendar se mostrará aquí.' });
  };

  const removeUrl = async () => {
    if (!user?.id) return;
    await supabase.from('profiles').update({ gcal_embed_url: null }).eq('user_id', user.id);
    setEmbedUrl('');
    setInputUrl('');
    setOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const configDialog = (title: string, showRemove = false) => (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-3">
          <p className="font-medium">📌 Sigue estos pasos exactos:</p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-2 text-xs">
            <li>Abre <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener" className="text-primary underline font-medium">Configuración de Google Calendar</a></li>
            <li>En el menú izquierdo, bajo <strong>"Configuración de mis calendarios"</strong>, haz clic en el nombre de tu calendario</li>
            <li>Baja hasta <strong>"Integrar calendario"</strong></li>
            <li>Copia el <strong>"Código de inserción de iframe"</strong> (empieza con <code className="bg-muted px-1 rounded">&lt;iframe src=...</code>)</li>
            <li>Pégalo aquí abajo</li>
          </ol>
          <div className="p-2 rounded bg-primary/10 text-xs">
            💡 Asegúrate de que tu calendario esté configurado como <strong>público</strong>.
          </div>
        </div>
        <div className="space-y-2">
          <Label>URL del calendario o código iframe</Label>
          <Input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/embed?src=..."
          />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={saveUrl} disabled={!inputUrl.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
          {showRemove && (
            <Button variant="destructive" onClick={removeUrl}>Desvincular</Button>
          )}
        </div>
      </div>
    </DialogContent>
  );

  if (!embedUrl) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Calendar className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <h3 className="font-semibold mb-1">Google Calendar</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Vincula tu Google Calendar para ver tus eventos directamente aquí.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Configurar Google Calendar
              </Button>
            </DialogTrigger>
            {configDialog('Vincular Google Calendar')}
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Google Calendar
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href="https://calendar.google.com" target="_blank" rel="noopener">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              {configDialog('Cambiar calendario', true)}
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          src={embedUrl}
          className="w-full border-0"
          style={{ height: '500px' }}
          title="Google Calendar"
        />
      </CardContent>
    </Card>
  );
};

export default GoogleCalendarEmbed;
