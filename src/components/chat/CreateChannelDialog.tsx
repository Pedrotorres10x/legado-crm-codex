import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelCreated: (channelId: string) => void;
}

const CreateChannelDialog = ({ open, onOpenChange, onChannelCreated }: Props) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);

    // Insert without .select() to avoid RLS SELECT conflict on newly created row
    const channelId = crypto.randomUUID();
    const { error } = await supabase
      .from('chat_channels')
      .insert({ id: channelId, name: name.trim(), description: description.trim() || null, is_direct: false, created_by: user.id });

    if (error) {
      console.error('[chat] create channel error:', error);
      toast.error('Error al crear canal');
      setLoading(false);
      return;
    }

    // Add all users as members
    const { data: profiles } = await supabase.from('profiles').select('user_id');
    if (profiles) {
      await supabase.from('chat_channel_members').insert(
        profiles.map(p => ({ channel_id: channelId, user_id: p.user_id }))
      );
    }

    toast.success(`Canal #${name} creado`);
    setName('');
    setDescription('');
    setLoading(false);
    onOpenChange(false);
    onChannelCreated(channelId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear canal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="channel-name">Nombre del canal</Label>
            <Input id="channel-name" placeholder="ej: ventas" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="channel-desc">Descripción (opcional)</Label>
            <Input id="channel-desc" placeholder="De qué trata este canal" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? 'Creando...' : 'Crear canal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChannelDialog;
