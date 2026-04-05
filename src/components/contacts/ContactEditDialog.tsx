import type { Dispatch, SetStateAction } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SUGGESTED_CONTACT_TAGS } from '@/lib/contact-tags';

type ContactEditValue = string | string[] | boolean | null | undefined;
type ContactEditForm = Record<string, ContactEditValue>;

const PIPELINE_STAGE_OPTIONS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'en_seguimiento', label: 'En seguimiento' },
  { value: 'cualificado', label: 'Cualificado' },
  { value: 'visitando', label: 'Visitando' },
  { value: 'visita_tasacion', label: 'Visita tasación' },
  { value: 'visita_programada', label: 'Visita programada' },
  { value: 'mandato', label: 'Mandato' },
  { value: 'mandato_firmado', label: 'Mandato firmado' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'prospecto', label: 'Prospecto' },
  { value: 'activo', label: 'Activo' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'negociacion', label: 'Negociación' },
  { value: 'reserva', label: 'Reserva' },
  { value: 'escritura', label: 'Escritura' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'en_venta', label: 'En venta' },
  { value: 'en_cierre', label: 'En cierre' },
  { value: 'cerrado', label: 'Cerrado' },
  { value: 'sin_interes', label: 'Sin interés' },
  { value: 'clasificado', label: 'Clasificado' },
  { value: 'inactivo', label: 'Inactivo' },
];

export default function ContactEditDialog({
  open,
  onOpenChange,
  form,
  setForm,
  tagInput,
  setTagInput,
  onAddTag,
  onRemoveTag,
  onSubmit,
  saving,
  typeLabels,
  statusLabels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ContactEditForm;
  setForm: Dispatch<SetStateAction<ContactEditForm>>;
  tagInput: string;
  setTagInput: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onSubmit: () => void;
  saving: boolean;
  typeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Contacto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={(form.full_name || '').split(' ').slice(0, 1).join(' ')}
                onChange={(event) => {
                  const lastName = (form.full_name || '').split(' ').slice(1).join(' ');
                  setForm({ ...form, full_name: `${event.target.value} ${lastName}`.trim() });
                }}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-2">
              <Label>Apellidos *</Label>
              <Input
                value={(form.full_name || '').split(' ').slice(1).join(' ')}
                onChange={(event) => {
                  const firstName = (form.full_name || '').split(' ')[0] || '';
                  setForm({ ...form, full_name: `${firstName} ${event.target.value}`.trim() });
                }}
                placeholder="Apellidos"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.contact_type || 'comprador'} onValueChange={(value) => setForm({ ...form, contact_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono principal</Label>
              <Input value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+34 600 000 000" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono secundario</Label>
              <Input value={form.phone2 || ''} onChange={(event) => setForm({ ...form, phone2: event.target.value })} placeholder="+34 600 000 000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={form.address || ''} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Calle, número, piso" />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={form.city || ''} onChange={(event) => setForm({ ...form, city: event.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>DNI/NIE/Pasaporte</Label>
              <Input value={form.id_number || ''} onChange={(event) => setForm({ ...form, id_number: event.target.value })} placeholder="12345678A" />
            </div>
            <div className="space-y-2">
              <Label>Nacionalidad</Label>
              <Input value={form.nationality || ''} onChange={(event) => setForm({ ...form, nationality: event.target.value })} placeholder="Española" />
            </div>
            <div className="space-y-2">
              <Label>Fecha nacimiento</Label>
              <Input type="date" value={form.birth_date || ''} onChange={(event) => setForm({ ...form, birth_date: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de compra</Label>
              <Input type="date" value={form.purchase_date || ''} onChange={(event) => setForm({ ...form, purchase_date: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de venta</Label>
              <Input type="date" value={form.sale_date || ''} onChange={(event) => setForm({ ...form, sale_date: event.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status || 'nuevo'} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa pipeline</Label>
              <Select value={form.pipeline_stage || 'nuevo'} onValueChange={(value) => setForm({ ...form, pipeline_stage: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGE_OPTIONS.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Etiquetas</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onAddTag();
                  }
                }}
                placeholder="Añadir etiqueta y pulsar Enter"
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={onAddTag} type="button">Añadir</Button>
            </div>
            {form.tags?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.tags.map((tag: string) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    onClick={() => onRemoveTag(tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SUGGESTED_CONTACT_TAGS.filter((tag) => !(form.tags || []).includes(tag)).slice(0, 10).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  onClick={() => setForm({ ...form, tags: [...(form.tags || []), tag] })}
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (toda la información relevante)</Label>
            <Textarea
              value={form.notes || ''}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Situación personal, motivación de compra/venta, presupuesto, plazos, propiedades de interés, cómo llegó, relación con otros contactos..."
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              💡 Cuanta más información registres, mejor podrá ayudarte la IA. Incluye datos de Horus, zona, preferencias, situación familiar, etc.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={saving || !form.full_name}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
