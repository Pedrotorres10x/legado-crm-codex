import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';

interface QuickCreateContactProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  onCreated?: (contactId: string) => void;
}

const typeOptions = [
  { value: 'comprador', label: 'Comprador' },
  { value: 'prospecto', label: 'Prospecto vendedor' },
  { value: 'propietario', label: 'Propietario (cliente)' },
  { value: 'contacto', label: 'Contacto' },
  { value: 'colaborador', label: 'Colaborador' },
];

const QuickCreateContact = ({ open, onOpenChange, phone, onCreated }: QuickCreateContactProps) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [contactType, setContactType] = useState('contacto');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Introduce un nombre');
      return;
    }
    setSaving(true);
    const defaultStage =
      contactType === 'comprador'
        ? 'nuevo'
        : contactType === 'colaborador'
          ? 'activo'
          : contactType === 'propietario'
            ? 'captado'
            : 'prospecto';
    const { data, error } = await supabase.from('contacts').insert([{
      full_name: name.trim(),
      phone: phone,
      contact_type: contactType as any,
      agent_id: user?.id,
      pipeline_stage: defaultStage,
    } as any]).select('id').single();

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Contacto "${name.trim()}" creado`);
    setName('');
    setContactType('contacto');
    onOpenChange(false);
    onCreated?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Dar de alta contacto
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input value={phone} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre completo"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={contactType} onValueChange={setContactType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear contacto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickCreateContact;
