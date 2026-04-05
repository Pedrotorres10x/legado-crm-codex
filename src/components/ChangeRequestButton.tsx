import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Send, Pencil, Loader2 } from 'lucide-react';

interface Props {
  entityType: 'contact' | 'property';
  entityId: string;
  entityLabel: string;
  /** Si se pasa, el botón ya viene con el campo pre-rellenado */
  fieldName?: string;
  currentValue?: string;
  /** Variant visual del botón */
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  label?: string;
}

type ChangeRequestInsert = {
  entity_type: 'contact' | 'property';
  entity_id: string;
  entity_label: string;
  requested_by: string;
  field_name: string | null;
  current_value: string | null;
  new_value: string | null;
  description: string;
  status: 'pendiente';
};

type UserRoleRow = {
  user_id: string;
};

const ChangeRequestButton = ({
  entityType,
  entityId,
  entityLabel,
  fieldName,
  currentValue,
  variant = 'outline',
  size = 'sm',
  className,
  label = 'Solicitar cambio',
}: Props) => {
  const { user, canViewAll } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Si es admin/coordinadora no necesita este botón
  if (canViewAll) return null;

  const submit = async () => {
    if (!description.trim()) {
      toast.error('Describe el cambio que necesitas.');
      return;
    }
    setSaving(true);
    try {
      // 1. Guardar solicitud
      const payload: ChangeRequestInsert = {
        entity_type: entityType,
        entity_id: entityId,
        entity_label: entityLabel,
        requested_by: user!.id,
        field_name: fieldName || null,
        current_value: currentValue || null,
        new_value: newValue.trim() || null,
        description: description.trim(),
        status: 'pendiente',
      };
      const { error: insertError } = await (supabase.from('change_requests' as never) as {
        insert: (values: ChangeRequestInsert) => Promise<{ error: Error | null }>;
      }).insert(payload);
      if (insertError) throw insertError;

      // 2. Notificación para admin/coordinadora
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'coordinadora']);

      if (admins?.length) {
        await supabase.from('notifications').insert(
          (admins as UserRoleRow[]).map((admin) => ({
            event_type: 'change_request',
            entity_type: entityType,
            entity_id: entityId,
            title: `✏️ Solicitud de cambio: ${entityLabel}`,
            description: description.trim().slice(0, 120),
            agent_id: admin.user_id,
          }))
        );
      }

      toast.success('Solicitud enviada a la coordinadora.');
      setOpen(false);
      setDescription('');
      setNewValue('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error('Error al enviar la solicitud: ' + message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5 mr-1.5" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Solicitar cambio
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">
                {entityType === 'contact' ? '👤 Contacto' : '🏠 Inmueble'}:
              </span>{' '}
              {entityLabel}
            </div>

            {fieldName && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Campo a modificar</Label>
                <Input value={fieldName} readOnly className="bg-muted/30 text-sm" />
              </div>
            )}

            {fieldName && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nuevo valor</Label>
                <Input
                  placeholder="Escribe el valor correcto..."
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                Descripción del cambio <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder={
                  fieldName
                    ? 'Explica por qué debe cambiarse o añade contexto...'
                    : 'Describe qué dato debe añadirse o corregirse y por qué...'
                }
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving || !description.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChangeRequestButton;
