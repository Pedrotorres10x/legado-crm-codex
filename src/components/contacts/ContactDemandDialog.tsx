import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type DemandForm = {
  property_type: string;
  operation: string;
  min_price: string;
  max_price: string;
  min_surface: string;
  min_bedrooms: string;
  notes: string;
  cities: string;
  zones: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandEditId: string | null;
  demandForm: DemandForm;
  setDemandForm: (form: DemandForm) => void;
  propertyTypes: readonly string[];
  demandSaving: boolean;
  onSubmit: () => void;
};

export default function ContactDemandDialog({
  open,
  onOpenChange,
  demandEditId,
  demandForm,
  setDemandForm,
  propertyTypes,
  demandSaving,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{demandEditId ? 'Editar Demanda' : 'Nueva Demanda'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo inmueble</Label>
              <Select value={demandForm.property_type} onValueChange={(value) => setDemandForm({ ...demandForm, property_type: value })}>
                <SelectTrigger><SelectValue placeholder="Cualquiera" /></SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((propertyType) => (
                    <SelectItem key={propertyType} value={propertyType}>
                      {propertyType.charAt(0).toUpperCase() + propertyType.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operación</Label>
              <Select value={demandForm.operation} onValueChange={(value) => setDemandForm({ ...demandForm, operation: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venta">Venta</SelectItem>
                  <SelectItem value="alquiler">Alquiler</SelectItem>
                  <SelectItem value="ambas">Ambas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ciudades <span className="text-muted-foreground font-normal">(separadas por coma)</span></Label>
            <Input value={demandForm.cities} onChange={(event) => setDemandForm({ ...demandForm, cities: event.target.value })} placeholder="Ej: Benidorm, Calpe, Altea" />
          </div>
          <div className="space-y-2">
            <Label>Zonas <span className="text-muted-foreground font-normal">(separadas por coma)</span></Label>
            <Input value={demandForm.zones} onChange={(event) => setDemandForm({ ...demandForm, zones: event.target.value })} placeholder="Ej: Costa Blanca, Marina Alta" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Precio mín (€)</Label>
              <Input type="number" value={demandForm.min_price} onChange={(event) => setDemandForm({ ...demandForm, min_price: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Precio máx (€)</Label>
              <Input type="number" value={demandForm.max_price} onChange={(event) => setDemandForm({ ...demandForm, max_price: event.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Superficie mín (m²)</Label>
              <Input type="number" value={demandForm.min_surface} onChange={(event) => setDemandForm({ ...demandForm, min_surface: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Habitaciones mín</Label>
              <Input type="number" value={demandForm.min_bedrooms} onChange={(event) => setDemandForm({ ...demandForm, min_bedrooms: event.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Input value={demandForm.notes} onChange={(event) => setDemandForm({ ...demandForm, notes: event.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={demandSaving}>{demandSaving ? 'Guardando...' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
