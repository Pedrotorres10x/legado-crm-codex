import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardPaste, Loader2, ScanSearch, Upload } from 'lucide-react';
import type { DemandForm } from '@/hooks/useContactDemands';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandEditId: string | null;
  demandForm: DemandForm;
  setDemandForm: (form: DemandForm) => void;
  propertyTypes: readonly string[];
  demandSaving: boolean;
  demandExtracting: boolean;
  onSubmit: () => void;
  onExtractFromScreenshot: (file: File) => void | Promise<void>;
};

export default function ContactDemandDialog({
  open,
  onOpenChange,
  demandEditId,
  demandForm,
  setDemandForm,
  propertyTypes,
  demandSaving,
  demandExtracting,
  onSubmit,
  onExtractFromScreenshot,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pasteAreaRef = useRef<HTMLDivElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{demandEditId ? 'Editar Demanda' : 'Nueva Demanda'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div
            ref={pasteAreaRef}
            className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4"
            tabIndex={0}
            onPaste={(event) => {
              const items = Array.from(event.clipboardData?.items ?? []);
              const imageItem = items.find((item) => item.type.startsWith('image/'));
              if (!imageItem) return;
              event.preventDefault();
              const file = imageItem.getAsFile();
              if (file) void onExtractFromScreenshot(file);
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Crear desde pantallazo del email</p>
                <p className="text-xs text-muted-foreground">
                  Pega una captura con Ctrl+V o sube archivo. Te rellenamos ciudad, presupuesto, tipo y notas para revisarlo antes de guardar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => pasteAreaRef.current?.focus()}
                  disabled={demandExtracting}
                  className="shrink-0"
                >
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Pegar captura
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={demandExtracting}
                  className="shrink-0"
                >
                  {demandExtracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanSearch className="h-4 w-4 mr-2" />}
                  {demandExtracting ? 'Leyendo...' : 'Subir pantallazo'}
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onExtractFromScreenshot(file);
                event.currentTarget.value = '';
              }}
            />
          </div>
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
            <Textarea
              value={demandForm.notes}
              onChange={(event) => setDemandForm({ ...demandForm, notes: event.target.value })}
              placeholder="Resumen de lo que pide el cliente, contexto del email, matices..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={demandSaving || demandExtracting}>
            {demandSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {demandSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
