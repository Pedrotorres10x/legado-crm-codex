import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Satellite, Globe, Wifi, WifiOff, Settings, ExternalLink, Save } from 'lucide-react';
import { differenceInHours, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface SatelliteConfig {
  id: string;
  satellite_key: string;
  display_name: string;
  base_url: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_heartbeat: string | null;
  updated_at: string;
  created_at: string;
}

type HeartbeatStatus = 'green' | 'yellow' | 'red' | 'unknown';

const getHeartbeatStatus = (lastHeartbeat: string | null): HeartbeatStatus => {
  if (!lastHeartbeat) return 'unknown';
  const hours = differenceInHours(new Date(), new Date(lastHeartbeat));
  if (hours < 1) return 'green';
  if (hours < 24) return 'yellow';
  return 'red';
};

const statusDot: Record<HeartbeatStatus, string> = {
  green: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
  yellow: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]',
  red: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
  unknown: 'bg-muted-foreground/40',
};

const statusLabel: Record<HeartbeatStatus, string> = {
  green: 'Online',
  yellow: 'Hace +1h',
  red: 'Inactivo +24h',
  unknown: 'Sin heartbeat',
};

const AdminSatellites = () => {
  const [satellites, setSatellites] = useState<SatelliteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSatellite, setEditingSatellite] = useState<SatelliteConfig | null>(null);
  const [configJson, setConfigJson] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editName, setEditName] = useState('');

  const fetchSatellites = async () => {
    const { data } = await supabase
      .from('satellite_config')
      .select('*')
      .order('display_name');
    setSatellites((data as unknown as SatelliteConfig[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSatellites(); }, []);

  const toggleActive = async (sat: SatelliteConfig) => {
    const { error } = await supabase
      .from('satellite_config')
      .update({ is_active: !sat.is_active })
      .eq('id', sat.id);
    if (error) { toast.error('Error al actualizar'); return; }
    toast.success(`${sat.display_name} ${!sat.is_active ? 'activado' : 'desactivado'}`);
    fetchSatellites();
  };

  const openEditor = (sat: SatelliteConfig) => {
    setEditingSatellite(sat);
    setConfigJson(JSON.stringify(sat.config, null, 2));
    setEditUrl(sat.base_url);
    setEditName(sat.display_name);
  };

  const saveConfig = async () => {
    if (!editingSatellite) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configJson);
    } catch {
      toast.error('JSON inválido');
      return;
    }
    const { error } = await supabase
      .from('satellite_config')
      .update({ config: parsed, base_url: editUrl, display_name: editName })
      .eq('id', editingSatellite.id);
    if (error) { toast.error('Error al guardar'); return; }
    toast.success('Configuración guardada');
    setEditingSatellite(null);
    fetchSatellites();
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Cargando satélites...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Satellite className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Satélites del Ecosistema</h2>
        <Badge variant="secondary" className="ml-auto">{satellites.length} registrados</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {satellites.map(sat => {
          const status = getHeartbeatStatus(sat.last_heartbeat);
          return (
            <Card key={sat.id} className={`border-0 shadow-[var(--shadow-card)] transition-opacity ${!sat.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{sat.display_name}</h3>
                    {sat.base_url && (
                      <a
                        href={sat.base_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        <Globe className="h-3 w-3" />
                        {sat.base_url.replace(/^https?:\/\//, '').slice(0, 30)}
                        {sat.base_url.length > 38 ? '…' : ''}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <Switch checked={sat.is_active} onCheckedChange={() => toggleActive(sat)} />
                </div>

                <div className="flex items-center gap-2">
                  <div className={`h-3.5 w-3.5 rounded-full ${statusDot[status]}`} />
                  <span className="text-xs text-muted-foreground">{statusLabel[status]}</span>
                  {sat.is_active ? (
                    <Wifi className="h-3.5 w-3.5 text-emerald-500 ml-auto" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  )}
                </div>

                {sat.last_heartbeat && (
                  <p className="text-xs text-muted-foreground">
                    Último heartbeat: {format(new Date(sat.last_heartbeat), "dd/MM/yyyy HH:mm", { locale: es })}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{sat.satellite_key}</Badge>
                  <Badge variant="outline" className="text-xs">
                    {Object.keys(sat.config).length} config keys
                  </Badge>
                </div>

                <Button variant="outline" size="sm" className="w-full" onClick={() => openEditor(sat)}>
                  <Settings className="h-3.5 w-3.5 mr-1.5" />Editar configuración
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Config Editor Dialog */}
      <Dialog open={!!editingSatellite} onOpenChange={open => !open && setEditingSatellite(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Editar: {editingSatellite?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre visible</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">URL base</label>
              <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Configuración (JSON)</label>
              <Textarea
                value={configJson}
                onChange={e => setConfigJson(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder="{}"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingSatellite(null)}>Cancelar</Button>
            <Button onClick={saveConfig}><Save className="h-4 w-4 mr-1.5" />Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSatellites;
