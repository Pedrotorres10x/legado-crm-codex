import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, RefreshCw, Trash2, CheckCircle, AlertCircle, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { syncContacts, type SyncResult } from '@/lib/contact-sync';

const CRM_PREFIX = '[CRM] ';
const CRM_ORG = 'Legado CRM';
const LAST_SYNC_KEY = 'crm_contacts_last_sync';
const AUTO_SYNC_KEY = 'crm_contacts_auto_sync';

const ContactSyncButton = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isNative, setIsNative] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState<SyncResult | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
    setLastSync(localStorage.getItem(LAST_SYNC_KEY));
    setAutoSync(localStorage.getItem(AUTO_SYNC_KEY) === 'true');
  }, []);

  const handleAutoSyncToggle = (checked: boolean) => {
    setAutoSync(checked);
    localStorage.setItem(AUTO_SYNC_KEY, String(checked));
  };

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    setStats(null);

    const result = await syncContacts(user.id);

    if (!result) {
      toast({
        title: 'Permiso denegado',
        description: 'Necesitas conceder acceso a los contactos para sincronizar.',
        variant: 'destructive',
      });
    } else if (result.total === 0) {
      toast({
        title: 'Sin cambios',
        description: 'No hay contactos nuevos o modificados para sincronizar.',
      });
    } else {
      setStats(result);
      setLastSync(localStorage.getItem(LAST_SYNC_KEY));
      toast({
        title: 'Sincronización completada',
        description: `${result.synced} contactos sincronizados${result.errors > 0 ? `, ${result.errors} errores` : ''}.`,
      });
    }

    setSyncing(false);
  };

  const handleDeleteCrmContacts = async () => {
    setDeleting(true);
    try {
      const permResult = await Contacts.requestPermissions();
      if (permResult.contacts !== 'granted') {
        toast({ title: 'Permiso denegado', description: 'Necesitas conceder acceso a los contactos.', variant: 'destructive' });
        setDeleting(false);
        return;
      }

      const result = await Contacts.getContacts({ projection: { name: true, organization: true } });
      const crmContacts = result.contacts.filter(
        (c) => c.name?.display?.startsWith(CRM_PREFIX) || c.organization?.company === CRM_ORG
      );

      let deleted = 0;
      for (const contact of crmContacts) {
        try {
          if (contact.contactId) {
            await Contacts.deleteContact({ contactId: contact.contactId });
            deleted++;
          }
        } catch { /* skip */ }
      }

      localStorage.removeItem(LAST_SYNC_KEY);
      setLastSync(null);
      setStats(null);
      toast({ title: 'Contactos eliminados', description: `${deleted} contactos [CRM] eliminados del teléfono.` });
    } catch {
      toast({ title: 'Error', description: 'No se pudieron eliminar los contactos.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // Web fallback message
  if (!isNative) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Sincronizar contactos al teléfono
          </CardTitle>
          <CardDescription>
            Identifica automáticamente las llamadas entrantes de tus clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Esta función requiere la app instalada en Android
              </p>
              <p>
                Para identificar llamadas entrantes, necesitas instalar la app nativa en tu teléfono Android. 
                Los contactos del CRM se sincronizarán con tu agenda y cuando un cliente llame, 
                verás su nombre automáticamente en la pantalla.
              </p>
              <p>
                Contacta con tu administrador para obtener la APK de la app.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Sincronizar contactos al teléfono
        </CardTitle>
        <CardDescription>
          Sincroniza tus contactos del CRM con la agenda del teléfono para identificar llamadas entrantes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-sync toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Sincronización automática</p>
            <p className="text-xs text-muted-foreground">Sincronizar al iniciar sesión</p>
          </div>
          <Switch checked={autoSync} onCheckedChange={handleAutoSyncToggle} />
        </div>

        {/* Last sync info */}
        {lastSync && (
          <p className="text-xs text-muted-foreground">
            Última sincronización: {new Date(lastSync).toLocaleString('es-ES')}
          </p>
        )}

        {/* Sync result */}
        {stats && !syncing && stats.total > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <CheckCircle className="h-4 w-4 text-primary shrink-0" />
            <span>
              {stats.synced}/{stats.total} contactos sincronizados
              {stats.errors > 0 && ` · ${stats.errors} errores`}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button onClick={handleSync} disabled={syncing || deleting} className="flex-1">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar contactos'}
          </Button>
          <Button
            variant="outline"
            onClick={handleDeleteCrmContacts}
            disabled={syncing || deleting}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Eliminando...' : 'Limpiar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactSyncButton;
