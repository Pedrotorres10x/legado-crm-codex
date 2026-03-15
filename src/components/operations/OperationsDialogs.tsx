import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Agent = {
  user_id: string;
  full_name: string;
};

type ItemLike = {
  title: string;
};

type ReassigningProperty = {
  propertyId: string;
  title: string;
  currentAgentId: string | null;
};

type TaskForm = {
  title: string;
  due_date: string;
  description: string;
  priority: string;
};

type VisitForm = {
  visit_date: string;
  notes: string;
};

type OfferForm = {
  amount: string;
  notes: string;
  status: string;
};

export function ReassignPropertyDialog({
  open,
  onOpenChange,
  property,
  agents,
  agentToAssign,
  onAgentChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: ReassigningProperty | null;
  agents: Agent[];
  agentToAssign: string;
  onAgentChange: (value: string) => void;
  saving: boolean;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reasignar inmueble</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta accion cambia el `agent_id` del inmueble y arrastra las tareas abiertas ligadas a esa propiedad.
          </p>
          <div className="rounded-xl border bg-muted/30 px-3 py-3 text-sm">
            {property?.title || 'Operacion'}
          </div>
          <Select value={agentToAssign} onValueChange={onAgentChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un agente" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.user_id} value={agent.user_id}>
                  {agent.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} disabled={!agentToAssign || saving}>
            {saving ? 'Guardando...' : 'Guardar reasignacion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  item,
  form,
  onFormChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemLike | null;
  form: TaskForm;
  onFormChange: (updater: (current: TaskForm) => TaskForm) => void;
  saving: boolean;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear tarea manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 px-3 py-3 text-sm">
            {item?.title || 'Asunto operativo'}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Titulo</label>
            <Input
              value={form.title}
              onChange={(event) => onFormChange((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ej: revisar documentos pendientes"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Vencimiento</label>
              <Input
                type="datetime-local"
                value={form.due_date}
                onChange={(event) => onFormChange((current) => ({ ...current, due_date: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridad</label>
              <Select value={form.priority} onValueChange={(value) => onFormChange((current) => ({ ...current, priority: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descripcion</label>
            <Textarea
              value={form.description}
              onChange={(event) => onFormChange((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              placeholder="Deja aqui el siguiente paso concreto a ejecutar."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving || !form.title.trim() || !form.due_date}>
            {saving ? 'Guardando...' : 'Crear tarea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateVisitDialog({
  open,
  onOpenChange,
  item,
  form,
  onFormChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemLike | null;
  form: VisitForm;
  onFormChange: (updater: (current: VisitForm) => VisitForm) => void;
  saving: boolean;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Programar visita</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 px-3 py-3 text-sm">
            {item?.title || 'Asunto comercial'}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha y hora</label>
            <Input
              type="datetime-local"
              value={form.visit_date}
              onChange={(event) => onFormChange((current) => ({ ...current, visit_date: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notas</label>
            <Textarea
              value={form.notes}
              onChange={(event) => onFormChange((current) => ({ ...current, notes: event.target.value }))}
              rows={4}
              placeholder="Contexto comercial y puntos a revisar en la visita."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving || !form.visit_date}>
            {saving ? 'Guardando...' : 'Programar visita'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateOfferDialog({
  open,
  onOpenChange,
  item,
  form,
  onFormChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemLike | null;
  form: OfferForm;
  onFormChange: (updater: (current: OfferForm) => OfferForm) => void;
  saving: boolean;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar oferta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 px-3 py-3 text-sm">
            {item?.title || 'Visita comercial'}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Importe</label>
              <Input
                type="number"
                min="0"
                value={form.amount}
                onChange={(event) => onFormChange((current) => ({ ...current, amount: event.target.value }))}
                placeholder="Ej: 285000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={form.status} onValueChange={(value) => onFormChange((current) => ({ ...current, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="contraoferta">Contraoferta</SelectItem>
                  <SelectItem value="aceptada">Aceptada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notas</label>
            <Textarea
              value={form.notes}
              onChange={(event) => onFormChange((current) => ({ ...current, notes: event.target.value }))}
              rows={4}
              placeholder="Condiciones, siguiente paso o contexto de la negociacion."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving || !form.amount.trim()}>
            {saving ? 'Guardando...' : 'Registrar oferta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveOfferDialog({
  open,
  onOpenChange,
  item,
  status,
  onStatusChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemLike | null;
  status: string;
  onStatusChange: (value: string) => void;
  saving: boolean;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolver oferta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 px-3 py-3 text-sm">
            {item?.title || 'Oferta en negociacion'}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nuevo estado</label>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="contraoferta">Contraoferta</SelectItem>
                <SelectItem value="aceptada">Aceptada</SelectItem>
                <SelectItem value="rechazada">Rechazada</SelectItem>
                <SelectItem value="retirada">Retirada</SelectItem>
                <SelectItem value="expirada">Expirada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar estado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
