import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Megaphone, Plus, Send, Loader2, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  emailed: boolean;
  created_at: string;
}

const categories = [
  { value: 'nueva_funcion', label: '🚀 Nueva función', color: 'bg-primary text-primary-foreground' },
  { value: 'mejora', label: '✨ Mejora', color: 'bg-accent text-accent-foreground' },
  { value: 'correccion', label: '🔧 Corrección', color: 'bg-secondary text-secondary-foreground' },
  { value: 'mantenimiento', label: '⚙️ Mantenimiento', color: 'bg-muted text-muted-foreground' },
  { value: 'importante', label: '🔴 Importante', color: 'bg-destructive text-destructive-foreground' },
];

const AdminAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'mejora' });

  const fetch = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements((data as any[]) || []);
  };

  useEffect(() => { fetch(); }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Añade un título'); return; }
    setSaving(true);
    const { error } = await supabase.from('announcements').insert([{
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
    }] as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Anuncio creado');
    setDialogOpen(false);
    setForm({ title: '', content: '', category: 'mejora' });
    fetch();
  };

  const handleSendEmail = async (id: string) => {
    setSending(id);
    const { data, error } = await supabase.functions.invoke('send-announcement', {
      body: { announcement_id: id },
    });
    setSending(null);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Error al enviar');
      return;
    }
    toast.success(`Email enviado a ${data.recipients} usuarios`);
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    toast.success('Anuncio eliminado');
    fetch();
  };

  const getCat = (val: string) => categories.find(c => c.value === val) || categories[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />Anuncios del CRM
          </h2>
          <p className="text-sm text-muted-foreground">Comunica cambios técnicos al equipo por email</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Nuevo anuncio
        </Button>
      </div>

      {announcements.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay anuncios todavía.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const cat = getCat(a.category);
            return (
              <Card key={a.id} className="border-0 shadow-card">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cat.color}>{cat.label}</Badge>
                        {a.emailed && <Badge variant="outline" className="text-xs gap-1"><Check className="h-3 w-3" />Enviado</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h3 className="font-semibold">{a.title}</h3>
                      {a.content && <p className="text-sm text-muted-foreground whitespace-pre-line">{a.content}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!a.emailed && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleSendEmail(a.id)}
                          disabled={sending === a.id}
                        >
                          {sending === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                          Enviar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo anuncio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Nuevo sistema de fotos con IA" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Describe el cambio y cómo afecta al uso diario..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Guardando...' : 'Crear anuncio'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAnnouncements;
