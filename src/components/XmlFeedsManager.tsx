import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Plus, Rss, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface XmlFeed {
  id: string;
  url: string;
  name: string;
  agent_id: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_count: number;
  created_at: string;
}

interface Agent {
  user_id: string;
  full_name: string;
}

const XmlFeedsManager = () => {
  const [feeds, setFeeds] = useState<XmlFeed[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', agent_id: '' });

  const fetchData = async () => {
    const [feedsRes, agentsRes] = await Promise.all([
      supabase.from('xml_feeds').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    if (feedsRes.data) setFeeds(feedsRes.data as XmlFeed[]);
    if (agentsRes.data) setAgents(agentsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.url) { toast.error('Nombre y URL son obligatorios'); return; }
    const { error } = await supabase.from('xml_feeds').insert({
      name: form.name,
      url: form.url,
      agent_id: form.agent_id || null,
    } as any);
    if (error) { toast.error('Error al crear feed'); return; }
    toast.success('Feed añadido');
    setForm({ name: '', url: '', agent_id: '' });
    setShowForm(false);
    fetchData();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('xml_feeds').update({ is_active: active } as any).eq('id', id);
    setFeeds(prev => prev.map(f => f.id === id ? { ...f, is_active: active } : f));
  };

  const handleDelete = async (id: string) => {
    await supabase.from('xml_feeds').delete().eq('id', id);
    setFeeds(prev => prev.filter(f => f.id !== id));
    toast.success('Feed eliminado');
  };

  const handleSync = async (feedId?: string) => {
    setSyncing(feedId || 'all');
    try {
      const res = await supabase.functions.invoke('import-xml-feed', {
        body: feedId ? { feed_id: feedId } : {},
      });
      if (res.error) throw res.error;
      const data = res.data;
      if (data?.results) {
        const summary = data.results.map((r: any) =>
          r.error ? `${r.feed}: Error - ${r.error}` : `${r.feed}: ${r.upserted} propiedades`
        ).join('\n');
        toast.success('Sincronización completada', { description: summary });
      }
      fetchData();
    } catch (err) {
      toast.error('Error al sincronizar');
    } finally {
      setSyncing(null);
    }
  };

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return 'Sin asignar';
    return agents.find(a => a.user_id === agentId)?.full_name || 'Desconocido';
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando feeds...</div>;

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rss className="h-5 w-5 text-primary" />
            Feeds Automáticos
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleSync()} disabled={!!syncing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing === 'all' ? 'animate-spin' : ''}`} />
              Sincronizar todos
            </Button>
            <Button size="sm" onClick={() => setShowForm(v => !v)}>
              <Plus className="h-4 w-4 mr-1.5" />Añadir feed
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="grid gap-3 sm:grid-cols-4 p-4 rounded-lg border bg-muted/30">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input placeholder="Ej: Blanca Calida" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>URL del feed</Label>
              <Input placeholder="https://..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Agente asignado</Label>
              <Select value={form.agent_id} onValueChange={v => setForm({ ...form, agent_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-4 flex gap-2">
              <Button onClick={handleAdd}>Guardar</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {feeds.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No hay feeds configurados. Añade uno para empezar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Última sync</TableHead>
                <TableHead>Propiedades</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeds.map(feed => (
                <TableRow key={feed.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{feed.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{feed.url}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getAgentName(feed.agent_id)}</TableCell>
                  <TableCell>
                    {feed.last_sync_at ? (
                      <span className="text-sm">{formatDistanceToNow(new Date(feed.last_sync_at), { addSuffix: true, locale: es })}</span>
                    ) : (
                      <Badge variant="outline">Nunca</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{feed.last_sync_count}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={feed.is_active} onCheckedChange={v => handleToggle(feed.id, v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSync(feed.id)}
                        disabled={!!syncing}
                      >
                        <RefreshCw className={`h-4 w-4 ${syncing === feed.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(feed.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default XmlFeedsManager;
