import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type PropertyLike = {
  id: string;
  title?: string | null;
  address?: string | null;
  status?: string | null;
  price?: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  contactName?: string | null;
  properties: PropertyLike[];
  invoices: Array<{ id: string; concept?: string | null; created_at: string }>;
  selectedPropertyId: string;
  onSelectedPropertyChange: (value: string) => void;
  onSubmit: () => Promise<void>;
};

export default function ContactFakturaDialog({
  open,
  onOpenChange,
  loading,
  contactName,
  properties,
  invoices,
  selectedPropertyId,
  onSelectedPropertyChange,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Generar Faktura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se generara una factura para <strong>{contactName || 'este contacto'}</strong> y, si eliges inmueble, se guardara tambien el registro en el CRM.
          </p>

          {properties.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 italic">
              ⚠️ Este contacto no tiene inmuebles ni comisiones vinculadas. Puedes abrir Faktura igualmente.
            </p>
          )}

          {properties.length > 0 && (
            <div className="space-y-2">
              <Label>Seleccionar inmueble</Label>
              <Select value={selectedPropertyId} onValueChange={onSelectedPropertyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un inmueble..." />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {(property.title || property.address || 'Sin titulo') + (property.price ? ` - ${property.price.toLocaleString('es-ES')} EUR` : '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {invoices.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Facturas anteriores ({invoices.length})</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5">
                    <span className="truncate flex-1">{invoice.concept}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">
                      {format(new Date(invoice.created_at), 'd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void onSubmit()} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            Generar y abrir Faktura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
