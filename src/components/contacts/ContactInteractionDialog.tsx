import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interactionTypes: { value: string; label: string }[];
  form: { interaction_type: string; subject: string; description: string };
  setForm: (form: { interaction_type: string; subject: string; description: string }) => void;
  saving: boolean;
  onSubmit: () => Promise<void>;
};

export default function ContactInteractionDialog({
  open,
  onOpenChange,
  interactionTypes,
  form,
  setForm,
  saving,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva interacción</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm font-semibold">No registres actividad vacia</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Toda interaccion debe dejar claro que paso y cual es el siguiente paso. Si no, no ayuda ni al agente ni a direccion.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.interaction_type} onValueChange={(value) => setForm({ ...form, interaction_type: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {interactionTypes.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Resultado breve *</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ej: acepta visita, pide propuesta, no contesta..." />
          </div>
          <div className="space-y-2">
            <Label>Contexto y siguiente paso *</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalla lo hablado, acuerdos y proximos pasos..." rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void onSubmit()} disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
