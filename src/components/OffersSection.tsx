import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  DollarSign, Plus, Home, ArrowRight, ArrowLeftRight,
  CheckCircle2, XCircle, Clock, AlertTriangle, MoreVertical,
  Pencil, CalendarClock, Ban
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType; color: string }> = {
  presentada: { label: 'Presentada', variant: 'outline', icon: Clock, color: 'text-amber-600' },
  contraoferta: { label: 'Contraoferta', variant: 'secondary', icon: ArrowLeftRight, color: 'text-blue-600' },
  aceptada: { label: 'Aceptada', variant: 'default', icon: CheckCircle2, color: 'text-green-600' },
  rechazada: { label: 'Rechazada', variant: 'destructive', icon: XCircle, color: 'text-destructive' },
  retirada: { label: 'Retirada', variant: 'outline', icon: Ban, color: 'text-muted-foreground' },
  expirada: { label: 'Expirada', variant: 'outline', icon: AlertTriangle, color: 'text-muted-foreground' },
};

interface OffersSectionProps {
  offers: any[];
  contactId: string;
  contactProperties: any[];
  onReload: () => void;
}

const OffersSection = ({ offers, contactId, contactProperties, onReload }: OffersSectionProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    property_id: '',
    amount: '',
    counter_amount: '',
    status: 'presentada',
    offer_type: 'compra',
    notes: '',
    conditions: '',
    expiry_date: '',
  });

  const openNew = () => {
    setEditId(null);
    setForm({
      property_id: contactProperties.length === 1 ? contactProperties[0].id : '',
      amount: '',
      counter_amount: '',
      status: 'presentada',
      offer_type: 'compra',
      notes: '',
      conditions: '',
      expiry_date: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (o: any) => {
    setEditId(o.id);
    setForm({
      property_id: o.property_id || '',
      amount: o.amount?.toString() || '',
      counter_amount: o.counter_amount?.toString() || '',
      status: o.status || 'presentada',
      offer_type: o.offer_type || 'compra',
      notes: o.notes || '',
      conditions: o.conditions || '',
      expiry_date: o.expiry_date ? new Date(o.expiry_date).toISOString().slice(0, 10) : '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.property_id || !form.amount) {
      toast({ title: 'Faltan datos', description: 'Propiedad e importe son obligatorios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      contact_id: contactId,
      property_id: form.property_id,
      amount: parseFloat(form.amount),
      counter_amount: form.counter_amount ? parseFloat(form.counter_amount) : null,
      status: form.status,
      offer_type: form.offer_type,
      notes: form.notes || null,
      conditions: form.conditions || null,
      expiry_date: form.expiry_date || null,
      agent_id: user?.id,
    };

    if (form.status === 'aceptada' || form.status === 'rechazada' || form.status === 'retirada') {
      payload.response_date = new Date().toISOString();
    }

    const { error } = editId
      ? await supabase.from('offers').update(payload).eq('id', editId)
      : await supabase.from('offers').insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editId ? 'Oferta actualizada' : '✅ Oferta registrada' });
    setDialogOpen(false);
    onReload();
  };

  const updateStatus = async (offerId: string, newStatus: string) => {
    const payload: any = { status: newStatus };
    if (newStatus === 'aceptada' || newStatus === 'rechazada' || newStatus === 'retirada') {
      payload.response_date = new Date().toISOString();
    }
    const { error } = await supabase.from('offers').update(payload).eq('id', offerId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `Oferta → ${STATUS_CONFIG[newStatus]?.label || newStatus}` });
    onReload();
  };

  const renderStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status];
    if (!cfg) return <Badge variant="outline">{status}</Badge>;
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    );
  };

  // Summary stats
  const active = offers.filter(o => o.status === 'presentada' || o.status === 'contraoferta');
  const accepted = offers.filter(o => o.status === 'aceptada');

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>{active.length} activa{active.length !== 1 ? 's' : ''}</span>
          </div>
          {accepted.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>{accepted.length} aceptada{accepted.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nueva oferta
        </Button>
      </div>

      {offers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin ofertas</p>
            <p className="text-sm mt-1">Registra la primera oferta de este contacto</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Oferta</TableHead>
                <TableHead>Contraoferta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map(o => {
                const isActive = o.status === 'presentada' || o.status === 'contraoferta';
                const isExpired = o.expiry_date && new Date(o.expiry_date) < new Date() && isActive;
                return (
                  <TableRow key={o.id} className={isExpired ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      <button
                        className="flex items-center gap-2 hover:text-primary transition-colors text-left"
                        onClick={() => o.property_id && navigate(`/properties/${o.property_id}`)}
                      >
                        <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate max-w-[180px]">{o.properties?.title || 'Propiedad'}</span>
                      </button>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {Number(o.amount).toLocaleString('es-ES')} €
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {o.counter_amount ? `${Number(o.counter_amount).toLocaleString('es-ES')} €` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {renderStatusBadge(o.status)}
                        {isExpired && (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 w-fit">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Expirada
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(o.created_at), "dd MMM yyyy", { locale: es })}
                      {o.expiry_date && (
                        <p className="text-[10px] flex items-center gap-0.5 mt-0.5">
                          <CalendarClock className="h-3 w-3" />
                          Exp: {format(new Date(o.expiry_date), "dd/MM", { locale: es })}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(o)}>
                            <Pencil className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          {isActive && (
                            <>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'contraoferta')}>
                                <ArrowLeftRight className="h-4 w-4 mr-2" />Contraoferta
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'aceptada')}>
                                <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />Aceptar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'rechazada')}>
                                <XCircle className="h-4 w-4 mr-2 text-destructive" />Rechazar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'retirada')}>
                                <Ban className="h-4 w-4 mr-2" />Retirar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {editId ? 'Editar oferta' : 'Nueva oferta'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Propiedad *</Label>
              <Select value={form.property_id} onValueChange={v => setForm({ ...form, property_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar propiedad" /></SelectTrigger>
                <SelectContent>
                  {contactProperties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title || p.address || p.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Importe oferta (€) *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="250.000"
                />
              </div>
              <div>
                <Label>Contraoferta (€)</Label>
                <Input
                  type="number"
                  value={form.counter_amount}
                  onChange={e => setForm({ ...form, counter_amount: e.target.value })}
                  placeholder="260.000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presentada">Presentada</SelectItem>
                    <SelectItem value="contraoferta">Contraoferta</SelectItem>
                    <SelectItem value="aceptada">Aceptada</SelectItem>
                    <SelectItem value="rechazada">Rechazada</SelectItem>
                    <SelectItem value="retirada">Retirada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha expiración</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={e => setForm({ ...form, expiry_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Condiciones</Label>
              <Textarea
                value={form.conditions}
                onChange={e => setForm({ ...form, conditions: e.target.value })}
                placeholder="Sujeta a hipoteca, plazos de entrega..."
                rows={2}
              />
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando...' : editId ? 'Guardar' : 'Registrar oferta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OffersSection;
