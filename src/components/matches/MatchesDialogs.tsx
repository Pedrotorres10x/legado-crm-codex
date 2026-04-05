import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Copy, MessageCircle, Sparkles } from 'lucide-react';

type SimpleOption = {
  id: string;
  title?: string | null;
  full_name?: string | null;
};

type VisitConfirmation = {
  confirmation_token: string;
};

type MatchAiResult = {
  score: number;
  reasons?: string[];
  recommendation?: string | null;
} | null;

type VisitForm = {
  property_id: string;
  contact_id: string;
  visit_date: string;
  notes: string;
};

type OfferForm = {
  property_id: string;
  contact_id: string;
  amount: string;
  notes: string;
};

type VisitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: SimpleOption[];
  contacts: SimpleOption[];
  value: VisitForm;
  onChange: (value: VisitForm) => void;
  onSubmit: () => void;
  loading: boolean;
};

export const MatchVisitDialog = ({
  open,
  onOpenChange,
  properties,
  contacts,
  value,
  onChange,
  onSubmit,
  loading,
}: VisitDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Programar Visita</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm font-semibold">No dejes una visita vacía</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Describe el objetivo o siguiente paso para que luego cuente de verdad en seguimiento y Horus.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Propiedad *</Label>
          <Select value={value.property_id} onValueChange={(property_id) => onChange({ ...value, property_id })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Contacto *</Label>
          <Select value={value.contact_id} onValueChange={(contact_id) => onChange({ ...value, contact_id })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha y hora *</Label>
          <Input
            type="datetime-local"
            value={value.visit_date}
            onChange={(event) => onChange({ ...value, visit_date: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Objetivo o siguiente paso *</Label>
          <Input
            value={value.notes}
            onChange={(event) => onChange({ ...value, notes: event.target.value })}
            placeholder="Ej: Validar interés real y, si encaja, dejar preacordada segunda visita."
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={loading || !value.property_id || !value.contact_id || !value.visit_date || !value.notes.trim()}>
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

type VisitConfirmationDialogProps = {
  visit: VisitConfirmation | null;
  onOpenChange: () => void;
  onSendWhatsApp: (visit: VisitConfirmation) => void;
  onCopyLink: (token: string) => void;
};

export const MatchVisitConfirmationDialog = ({
  visit,
  onOpenChange,
  onSendWhatsApp,
  onCopyLink,
}: VisitConfirmationDialogProps) => (
  <Dialog open={!!visit} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Enviar confirmación al cliente</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        La visita se ha programado. Envía el enlace de confirmación al cliente:
      </p>
      <div className="flex flex-col gap-3">
        <Button
          onClick={() => {
            onSendWhatsApp(visit);
            onOpenChange();
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Enviar por WhatsApp
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            onCopyLink(visit.confirmation_token);
            onOpenChange();
          }}
        >
          <Copy className="h-4 w-4 mr-2" />
          Copiar enlace
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

type OfferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: SimpleOption[];
  contacts: SimpleOption[];
  value: OfferForm;
  onChange: (value: OfferForm) => void;
  onSubmit: () => void;
  loading: boolean;
};

export const MatchOfferDialog = ({
  open,
  onOpenChange,
  properties,
  contacts,
  value,
  onChange,
  onSubmit,
  loading,
}: OfferDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Registrar Oferta</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm font-semibold">Oferta con lectura comercial real</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deja contexto o siguiente paso para entender después si la negociación avanza, se enfría o se cae.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Propiedad *</Label>
          <Select value={value.property_id} onValueChange={(property_id) => onChange({ ...value, property_id })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Comprador *</Label>
          <Select value={value.contact_id} onValueChange={(contact_id) => onChange({ ...value, contact_id })}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Importe (€) *</Label>
          <Input
            type="number"
            value={value.amount}
            onChange={(event) => onChange({ ...value, amount: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Contexto comercial o siguiente paso *</Label>
          <Input
            value={value.notes}
            onChange={(event) => onChange({ ...value, notes: event.target.value })}
            placeholder="Ej: Se presenta hoy y se revisa con la propiedad manana al mediodia."
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={loading || !value.property_id || !value.contact_id || !value.amount || !value.notes.trim()}>
          {loading ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

type OfferResolutionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextStatus: string | null;
  lossReason: string;
  onLossReasonChange: (value: string) => void;
  onConfirm: () => void;
  loading: boolean;
};

const resolutionTitles: Record<string, string> = {
  rechazada: 'Registrar rechazo',
  retirada: 'Registrar retirada',
  expirada: 'Registrar expiración',
};

export const MatchOfferResolutionDialog = ({
  open,
  onOpenChange,
  nextStatus,
  lossReason,
  onLossReasonChange,
  onConfirm,
  loading,
}: OfferResolutionDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{nextStatus ? resolutionTitles[nextStatus] || 'Resolver oferta' : 'Resolver oferta'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Motivo de pérdida</Label>
          <Textarea
            placeholder="Ej. precio fuera de mercado, comprador sin financiación, decide esperar..."
            value={lossReason}
            onChange={(event) => onLossReasonChange(event.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Este motivo quedará guardado en la oferta para entender por qué se ha caído la negociación.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={loading || !lossReason.trim()}>
          {loading ? 'Guardando...' : 'Guardar motivo'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

type MatchDiscardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
};

export const MatchDiscardDialog = ({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onConfirm,
}: MatchDiscardDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Descartar cruce</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Motivo de pérdida</Label>
          <Textarea
            placeholder="Ej. zona no encaja, precio alto, tipología incorrecta, ya no busca..."
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            rows={4}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={!reason.trim()}>
          Guardar motivo
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

type AiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: MatchAiResult;
};

export const MatchAiScoringDialog = ({ open, onOpenChange, result }: AiDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Análisis IA del Match
        </DialogTitle>
      </DialogHeader>
      {result && (
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-4xl font-bold text-primary">{result.score}%</span>
            <p className="text-sm text-muted-foreground mt-1">Compatibilidad IA</p>
          </div>
          {result.reasons?.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Razones:</p>
              <ul className="space-y-1">
                {result.reasons.map((reason: string, index: number) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.recommendation && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm font-medium mb-1">Recomendación:</p>
              <p className="text-sm text-muted-foreground">{result.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </DialogContent>
  </Dialog>
);
