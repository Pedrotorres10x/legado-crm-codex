import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Download, Loader2, CheckCircle, AlertTriangle, Clock, Trash2, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BackupFile {
  name: string;
  created_at: string;
}

export default function ContactBackup() {
  const [downloadingTarget, setDownloadingTarget] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBackups = async () => {
    setLoading(true);
    const { data } = await supabase.storage.from('contact-backups').list('', {
      sortBy: { column: 'created_at', order: 'desc' },
      limit: 30,
    });
    setBackups(data?.filter(f => f.name.endsWith('.csv')) || []);
    setLoading(false);
  };

  useEffect(() => { loadBackups(); }, []);

  const handleDownload = async (target: 'contacts' | 'properties' | 'all') => {
    setDownloadingTarget(target);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-contacts`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mode: 'download', target }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error generando backup');
      }

      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('text/csv')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const label = target === 'properties' ? 'inmuebles-no-habihub' : 'contactos';
        a.download = `backup-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast.success('Backup generado y enviado por email');
      loadBackups();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error generando backup';
      toast.error(message);
    } finally {
      setDownloadingTarget(null);
    }
  };

  const handleDeleteBackup = async (name: string) => {
    const { error } = await supabase.storage.from('contact-backups').remove([name]);
    if (error) {
      toast.error('Error eliminando backup');
    } else {
      toast.success('Backup eliminado');
      loadBackups();
    }
  };

  const handleDownloadExisting = async (name: string) => {
    const { data } = await supabase.storage.from('contact-backups').download(name);
    if (!data) { toast.error('Error descargando'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            Backup manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Genera un backup CSV, lo guarda en el almacenamiento interno y lo envía por email a los administradores.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleDownload('contacts')}
              disabled={!!downloadingTarget}
              variant="outline"
              className="gap-2"
            >
              {downloadingTarget === 'contacts' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Contactos
            </Button>
            <Button
              onClick={() => handleDownload('properties')}
              disabled={!!downloadingTarget}
              variant="outline"
              className="gap-2"
            >
              {downloadingTarget === 'properties' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
              Inmuebles no HabiHub
            </Button>
            <Button
              onClick={() => handleDownload('all')}
              disabled={!!downloadingTarget}
              className="gap-2"
            >
              {downloadingTarget === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Todo (contactos + inmuebles)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Backups guardados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Se genera un backup automático cada lunes y se envía por email. También se guarda cada descarga manual.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />Cargando…
            </div>
          ) : backups.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <AlertTriangle className="h-4 w-4" />No hay backups guardados aún
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b.name} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {b.name.includes('inmueble') ? (
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.created_at ? format(new Date(b.created_at), "d MMM yyyy, HH:mm", { locale: es }) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadExisting(b.name)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteBackup(b.name)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
