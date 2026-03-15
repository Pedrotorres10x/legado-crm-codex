import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TaskEditorForm } from '@/hooks/useTaskEditor';

export default function TaskEditorDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  formErrors,
  saving,
  onSubmit,
  taskTypes,
  priorities,
  recurrenceOptions,
  contacts,
  properties,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: TaskEditorForm;
  setForm: React.Dispatch<React.SetStateAction<TaskEditorForm>>;
  formErrors: { title?: string; due_date?: string; description?: string };
  saving: boolean;
  onSubmit: () => void;
  taskTypes: Array<{ value: string; label: string }>;
  priorities: Array<{ value: string; label: string }>;
  recurrenceOptions: Array<{ value: string; label: string }>;
  contacts: Array<{ id: string; full_name: string }>;
  properties: Array<{ id: string; title: string }>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold">Tarea simple y accionable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea tareas reales de actividad: llamadas, seguimientos, visitas o reuniones. Si reflejan trabajo de verdad, luego alimentan bien tu lectura Horus.
            </p>
          </div>
          <div>
            <Label>Título *</Label>
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ej: Llamar a Juan para seguimiento"
              className={formErrors.title ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Usa un verbo claro: llamar, visitar, enviar, confirmar, preparar.
            </p>
            {formErrors.title ? (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {formErrors.title}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.task_type} onValueChange={(value) => setForm((current) => ({ ...current, task_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {taskTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha y hora *</Label>
              <Input
                type="datetime-local"
                value={form.due_date}
                onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                className={formErrors.due_date ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {formErrors.due_date ? (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {formErrors.due_date}
                </p>
              ) : null}
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Repetición
              </Label>
              <Select value={form.recurrence} onValueChange={(value) => setForm((current) => ({ ...current, recurrence: value }))}>
                <SelectTrigger><SelectValue placeholder="Sin repetición" /></SelectTrigger>
                <SelectContent>
                  {recurrenceOptions.map((recurrence) => (
                    <SelectItem key={recurrence.value} value={recurrence.value}>
                      {recurrence.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.recurrence && form.recurrence !== 'none' ? (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              Al completar esta tarea, se creará automáticamente la siguiente.
            </div>
          ) : null}
          <div>
            <Label>Contacto (opcional)</Label>
            <Select value={form.contact_id || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, contact_id: value === 'none' ? '' : value }))}>
              <SelectTrigger><SelectValue placeholder="Sin contacto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin contacto</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Si la tarea va asociada a una persona concreta, vincúlala aquí para no perder contexto.
            </p>
          </div>
          <div>
            <Label>Inmueble (opcional)</Label>
            <Select value={form.property_id || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, property_id: value === 'none' ? '' : value }))}>
              <SelectTrigger><SelectValue placeholder="Sin inmueble" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin inmueble</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Úsalo cuando la acción sea sobre una captación, visita, cierre o seguimiento de vivienda.
            </p>
          </div>
          <div>
            <Label>Contexto y siguiente paso *</Label>
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Ej: Ya hablé con el propietario, hoy enviarle propuesta y volver a llamar mañana para cerrar visita."
              rows={3}
              className={formErrors.description ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Si no dejas contexto y siguiente paso, la actividad queda vacía y Horus pierde verdad.
            </p>
            {formErrors.description ? (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {formErrors.description}
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear tarea y seguir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
