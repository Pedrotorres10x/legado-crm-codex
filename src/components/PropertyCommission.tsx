import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Euro, Plus, Calculator, Send, Award, CheckCircle, User, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getSemesterRange, getAgentTier, fmt, calcProgressiveAgentAmount } from '@/lib/commissions';
import { notifyERP } from '@/lib/erp-sync';
import { useAgentHorusStatus } from '@/hooks/useAgentHorusStatus';

interface PropertyCommissionProps {
  propertyId: string;
  propertyTitle?: string;
  propertyPrice?: number | null;
  propertyAgentId?: string | null;
  propertyOwnerId?: string | null;
  propertyCity?: string | null;
}

interface Commission {
  id: string;
  property_id: string | null;
  agent_id: string;
  listing_agent_id: string | null;
  buying_agent_id: string | null;
  listing_origin_agent_id: string | null;
  listing_field_agent_id: string | null;
  buying_origin_agent_id: string | null;
  buying_field_agent_id: string | null;
  sale_price: number;
  agency_commission_pct: number;
  agency_commission: number;
  agent_base_pct: number;
  agent_base_amount: number;
  horus_bonus: boolean;
  horus_bonus_pct: number;
  horus_bonus_amount: number;
  agent_total: number;
  listing_pct: number;
  buying_pct: number;
  listing_amount: number;
  buying_amount: number;
  origin_pct: number;
  field_pct: number;
  listing_origin_amount: number;
  listing_field_amount: number;
  buying_origin_amount: number;
  buying_field_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
}

const calcCommission = (
  salePrice: number, agencyPct = 6, prevAccumulated = 0, horusBonus = false, horusPct = 5,
  listingPct = 60, buyingPct = 40, originPct = 30, fieldPct = 70
) => {
  const agencyCommission = salePrice * (agencyPct / 100);
  const { agentBase, bonusAmount, agentTotal, effectivePct } = calcProgressiveAgentAmount(prevAccumulated, agencyCommission, horusBonus, horusPct);
  const listingAmount = agentTotal * (listingPct / 100);
  const buyingAmount = agentTotal * (buyingPct / 100);
  const listingOriginAmount = listingAmount * (originPct / 100);
  const listingFieldAmount = listingAmount * (fieldPct / 100);
  const buyingOriginAmount = buyingAmount * (originPct / 100);
  const buyingFieldAmount = buyingAmount * (fieldPct / 100);
  return { agencyCommission, agentBase, bonusAmount, agentTotal, effectivePct, listingAmount, buyingAmount, listingOriginAmount, listingFieldAmount, buyingOriginAmount, buyingFieldAmount };
};

const statusColors: Record<string, string> = {
  borrador: 'bg-muted text-muted-foreground',
  aprobado: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pagado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const PropertyCommission = ({ propertyId, propertyTitle, propertyPrice, propertyAgentId, propertyOwnerId, propertyCity }: PropertyCommissionProps) => {
  const { user, isAdmin } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agents, setAgents] = useState<{ user_id: string; full_name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; full_name: string; email: string | null; phone: string | null; contact_type: string }[]>([]);
  const [sameAgent, setSameAgent] = useState(false);
  const [semesterAccumulated, setSemesterAccumulated] = useState(0);

  const horusStatus = useAgentHorusStatus(propertyAgentId || undefined);

  const semester = getSemesterRange();
  const tier = getAgentTier(semesterAccumulated);

  const defaultForm = {
    listing_origin_agent_id: propertyAgentId || '',
    listing_field_agent_id: '',
    buying_origin_agent_id: '',
    buying_field_agent_id: '',
    seller_contact_id: propertyOwnerId || '',
    buyer_contact_id: '',
    sale_price: propertyPrice?.toString() || '',
    agency_pct: '6',
    horus_bonus: false,
    horus_pct: '5',
    listing_pct: '60',
    buying_pct: '40',
    origin_pct: '30',
    field_pct: '70',
    notes: '',
  };
  const [form, setForm] = useState(defaultForm);

  const fetchCommissions = async () => {
    const { data } = await supabase
      .from('commissions')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    setCommissions((data as Commission[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    const fetchAccumulated = async () => {
      const originAgentId = propertyAgentId || user?.id;
      if (!originAgentId) {
        setSemesterAccumulated(0);
        return;
      }

      const { data } = await supabase
        .from('commissions')
        .select('agency_commission, listing_origin_agent_id, buying_origin_agent_id')
        .in('status', ['aprobado', 'pagado'])
        .gte('created_at', semester.start.toISOString())
        .or(`listing_origin_agent_id.eq.${originAgentId},buying_origin_agent_id.eq.${originAgentId}`);

      const acc = (data as any[] || []).reduce((s: number, r: any) => {
        const originatedByAgent =
          r.listing_origin_agent_id === originAgentId ||
          r.buying_origin_agent_id === originAgentId;
        return originatedByAgent ? s + (r.agency_commission || 0) : s;
      }, 0);
      setSemesterAccumulated(acc);
    };
    fetchAccumulated();
  }, [propertyAgentId, user?.id, semester.start]);

  useEffect(() => {
    setForm(f => ({ ...f, agent_pct: tier.pct.toString() }));
  }, [tier.pct]);

  // Auto-set horus bonus based on points
  useEffect(() => {
    if (!horusStatus.loading) {
      setForm(f => ({ ...f, horus_bonus: horusStatus.horusActive }));
    }
  }, [horusStatus.horusActive, horusStatus.loading]);

  useEffect(() => {
    fetchCommissions();
    supabase.from('profiles').select('user_id, full_name').then(r => setAgents(r.data || []));
    // Load contacts for buyer/seller selection
    supabase.from('contacts').select('id, full_name, email, phone, contact_type')
      .order('full_name').then(r => setContacts(r.data || []));
  }, [propertyId]);

  // Update seller when owner changes
  useEffect(() => {
    if (propertyOwnerId) {
      setForm(f => ({ ...f, seller_contact_id: propertyOwnerId }));
    }
  }, [propertyOwnerId]);

  const handleSameAgent = (checked: boolean) => {
    setSameAgent(checked);
    if (checked && user?.id) {
      setForm(f => ({
        ...f,
        listing_origin_agent_id: user.id,
        listing_field_agent_id: user.id,
        buying_origin_agent_id: user.id,
        buying_field_agent_id: user.id,
      }));
    }
  };

  const computed = calcCommission(
    Number(form.sale_price) || 0, Number(form.agency_pct) || 6,
    semesterAccumulated, form.horus_bonus, Number(form.horus_pct) || 5,
    Number(form.listing_pct) || 60, Number(form.buying_pct) || 40,
    Number(form.origin_pct) || 30, Number(form.field_pct) || 70,
  );

  const getContactName = (id: string | null) => {
    if (!id) return '—';
    return contacts.find(c => c.id === id)?.full_name || 'Contacto';
  };

  const handleSubmit = async () => {
    if (!form.listing_field_agent_id || !form.buying_field_agent_id || !form.sale_price) {
      toast.error('Completa al menos los asesores de campo y el precio');
      return;
    }
    const { error } = await supabase.from('commissions').insert({
      property_id: propertyId,
      agent_id: form.listing_field_agent_id,
      listing_agent_id: form.listing_field_agent_id,
      buying_agent_id: form.buying_field_agent_id,
      listing_origin_agent_id: form.listing_origin_agent_id || null,
      listing_field_agent_id: form.listing_field_agent_id,
      buying_origin_agent_id: form.buying_origin_agent_id || null,
      buying_field_agent_id: form.buying_field_agent_id,
      sale_price: Number(form.sale_price),
      agency_commission_pct: Number(form.agency_pct),
      agency_commission: computed.agencyCommission,
      agent_base_pct: computed.effectivePct,
      agent_base_amount: computed.agentBase,
      horus_bonus: form.horus_bonus,
      horus_bonus_pct: Number(form.horus_pct),
      horus_bonus_amount: computed.bonusAmount,
      agent_total: computed.agentTotal,
      listing_pct: Number(form.listing_pct),
      buying_pct: Number(form.buying_pct),
      listing_amount: computed.listingAmount,
      buying_amount: computed.buyingAmount,
      origin_pct: Number(form.origin_pct),
      field_pct: Number(form.field_pct),
      listing_origin_amount: computed.listingOriginAmount,
      listing_field_amount: computed.listingFieldAmount,
      buying_origin_amount: computed.buyingOriginAmount,
      buying_field_amount: computed.buyingFieldAmount,
      notes: form.notes || null,
      status: 'borrador',
    } as any);
    if (error) { toast.error('Error al guardar'); return; }

    // Notify Faktura with full sale package (seller + buyer + property + commissions)
    if (isAdmin) {
      const seller = contacts.find(c => c.id === form.seller_contact_id);
      const buyer = contacts.find(c => c.id === form.buyer_contact_id);
      const listingAgent = agents.find(a => a.user_id === form.listing_field_agent_id);
      const buyingAgent = agents.find(a => a.user_id === form.buying_field_agent_id);

      notifyERP('commission_approved', {
        commission_id: `${propertyId}-${Date.now()}`,
        property_title: propertyTitle || 'Inmueble',
        sale_price: Number(form.sale_price),
        agency_commission: computed.agencyCommission,
        agent_total: computed.agentTotal,
        agent_name: listingAgent?.full_name || '—',
        horus_bonus: form.horus_bonus,
        created_at: new Date().toISOString(),
        seller_name: seller?.full_name,
        seller_email: seller?.email,
        seller_phone: seller?.phone,
        buyer_name: buyer?.full_name,
        buyer_email: buyer?.email,
        buyer_phone: buyer?.phone,
        property_city: propertyCity,
        listing_agent_name: listingAgent?.full_name,
        buying_agent_name: buyingAgent?.full_name,
        listing_amount: computed.listingAmount,
        buying_amount: computed.buyingAmount,
      } as any);
    }

    toast.success(isAdmin ? 'Comisión registrada y enviada a facturación' : 'Solicitud enviada — pendiente de aprobación');
    setDialogOpen(false);
    setForm({ ...defaultForm });
    setSameAgent(false);
    fetchCommissions();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('commissions').update({ status } as any).eq('id', id);
    fetchCommissions();
    toast.success(`Estado actualizado a ${status}`);
  };

  const getAgentName = (id: string | null) => {
    if (!id) return '—';
    return agents.find(a => a.user_id === id)?.full_name || 'Asesor';
  };

  const AgentSelector = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={sameAgent}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent>{agents.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando comisiones...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Euro className="h-5 w-5 text-primary" />
          Comisiones de esta propiedad
          {commissions.length > 0 && <Badge variant="secondary">{commissions.length}</Badge>}
        </h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm(defaultForm); setSameAgent(false); } }}>
          <DialogTrigger asChild>
            <Button size="sm">
              {isAdmin ? <><Plus className="h-4 w-4 mr-1" />Registrar</> : <><Calculator className="h-4 w-4 mr-1" />Simular</>}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isAdmin ? 'Nueva Comisión' : 'Simulador de Comisión'}</DialogTitle>
              {propertyTitle && <p className="text-sm text-muted-foreground">{propertyTitle}</p>}
            </DialogHeader>
            <div className="space-y-4">
              {/* Seller & Buyer */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <User className="h-4 w-4 text-muted-foreground" />Vendedor
                  </p>
                  <Select value={form.seller_contact_id} onValueChange={v => setForm(f => ({ ...f, seller_contact_id: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar contacto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin asignar —</SelectItem>
                      {contacts.filter(c => ['propietario', 'vendedor_cerrado', 'ambos'].includes(c.contact_type)).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.seller_contact_id && (() => {
                    const s = contacts.find(c => c.id === form.seller_contact_id);
                    return s ? (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {s.phone && <p>📞 {s.phone}</p>}
                        {s.email && <p>✉️ {s.email}</p>}
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />Comprador
                  </p>
                  <Select value={form.buyer_contact_id} onValueChange={v => setForm(f => ({ ...f, buyer_contact_id: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar contacto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Sin asignar —</SelectItem>
                      {contacts.filter(c => ['comprador', 'comprador_cerrado', 'ambos'].includes(c.contact_type)).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.buyer_contact_id && (() => {
                    const b = contacts.find(c => c.id === form.buyer_contact_id);
                    return b ? (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {b.phone && <p>📞 {b.phone}</p>}
                        {b.email && <p>✉️ {b.email}</p>}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
                <Checkbox id="same-agent-prop" checked={sameAgent} onCheckedChange={(v) => handleSameAgent(v === true)} />
                <Label htmlFor="same-agent-prop" className="text-sm cursor-pointer">
                  Yo hago todo (captación + venta) — cobro el 100%
                </Label>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold text-primary">Listing (Captación) — {form.listing_pct}%</p>
                <div className="grid grid-cols-2 gap-2">
                  <AgentSelector label="Origen contacto (30%)" value={form.listing_origin_agent_id} onChange={v => setForm(f => ({ ...f, listing_origin_agent_id: v }))} />
                  <AgentSelector label="Trabajo de campo (70%)" value={form.listing_field_agent_id} onChange={v => setForm(f => ({ ...f, listing_field_agent_id: v }))} />
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-semibold text-primary">Buying (Comprador) — {form.buying_pct}%</p>
                <div className="grid grid-cols-2 gap-2">
                  <AgentSelector label="Origen contacto (30%)" value={form.buying_origin_agent_id} onChange={v => setForm(f => ({ ...f, buying_origin_agent_id: v }))} />
                  <AgentSelector label="Trabajo de campo (70%)" value={form.buying_field_agent_id} onChange={v => setForm(f => ({ ...f, buying_field_agent_id: v }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Precio venta (€)</Label><Input type="number" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))} /></div>
                <div><Label>% Comisión agencia</Label><Input type="number" value={form.agency_pct} onChange={e => setForm(f => ({ ...f, agency_pct: e.target.value }))} /></div>
              </div>

              <div>
              <p className="text-xs text-muted-foreground mb-1">% base progresivo según acumulado semestral originado por el agente ({fmt(semesterAccumulated)})</p>
                <Badge variant="outline" className="text-xs">
                  {tier.label}: {tier.pct}%{form.horus_bonus ? ` + ${form.horus_pct}% Horus` : ''} · Efectivo: {computed.effectivePct.toFixed(1)}%
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={form.horus_bonus} disabled />
                <Label className="flex items-center gap-1.5"><Award className="h-4 w-4 text-amber-500" /> Bonus Horus</Label>
                {horusStatus.loading ? (
                  <span className="text-xs text-muted-foreground">Calculando…</span>
                ) : horusStatus.horusActive ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1">
                    <Award className="h-3 w-3" />Activo ({horusStatus.points} pts)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-xs">
                    {horusStatus.points}/{horusStatus.target} pts — No activo
                  </Badge>
                )}
              </div>
              {form.horus_bonus && (
                <div><Label>% Bonus Horus</Label><Input type="number" value={form.horus_pct} onChange={e => setForm(f => ({ ...f, horus_pct: e.target.value }))} /></div>
              )}

              {isAdmin && (
                <div className="grid grid-cols-4 gap-2">
                  <div><Label className="text-xs">% Listing</Label><Input type="number" value={form.listing_pct} onChange={e => setForm(f => ({ ...f, listing_pct: e.target.value }))} /></div>
                  <div><Label className="text-xs">% Buying</Label><Input type="number" value={form.buying_pct} onChange={e => setForm(f => ({ ...f, buying_pct: e.target.value }))} /></div>
                  <div><Label className="text-xs">% Origen</Label><Input type="number" value={form.origin_pct} onChange={e => setForm(f => ({ ...f, origin_pct: e.target.value }))} /></div>
                  <div><Label className="text-xs">% Campo</Label><Input type="number" value={form.field_pct} onChange={e => setForm(f => ({ ...f, field_pct: e.target.value }))} /></div>
                </div>
              )}

              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Comisión agencia:</span><span className="font-semibold">{fmt(computed.agencyCommission)}</span></div>
                  <div className="flex justify-between"><span>Base asesor (progresivo {computed.effectivePct.toFixed(1)}%):</span><span className="font-semibold">{fmt(computed.agentBase)}</span></div>
                  {form.horus_bonus && <div className="flex justify-between text-amber-600"><span>Bonus Horus ({form.horus_pct}%):</span><span className="font-semibold">+{fmt(computed.bonusAmount)}</span></div>}
                  <div className="flex justify-between border-t pt-1 font-bold"><span>Total asesor:</span><span className="text-primary">{fmt(computed.agentTotal)}</span></div>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs font-semibold text-muted-foreground">Listing ({form.listing_pct}%) — {fmt(computed.listingAmount)}</p>
                    <div className="flex justify-between pl-3"><span className="text-xs">Origen ({form.origin_pct}%):</span><span className="text-xs">{fmt(computed.listingOriginAmount)}</span></div>
                    <div className="flex justify-between pl-3"><span className="text-xs">Campo ({form.field_pct}%):</span><span className="text-xs">{fmt(computed.listingFieldAmount)}</span></div>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs font-semibold text-muted-foreground">Buying ({form.buying_pct}%) — {fmt(computed.buyingAmount)}</p>
                    <div className="flex justify-between pl-3"><span className="text-xs">Origen ({form.origin_pct}%):</span><span className="text-xs">{fmt(computed.buyingOriginAmount)}</span></div>
                    <div className="flex justify-between pl-3"><span className="text-xs">Campo ({form.field_pct}%):</span><span className="text-xs">{fmt(computed.buyingFieldAmount)}</span></div>
                  </div>
                </CardContent>
              </Card>

              <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
              
              <Button onClick={handleSubmit} className="w-full">
                {isAdmin ? <><Plus className="h-4 w-4 mr-2" />Registrar comisión</> : <><Send className="h-4 w-4 mr-2" />Enviar solicitud</>}
              </Button>
              {!isAdmin && <p className="text-xs text-center text-muted-foreground">Tu solicitud será revisada y aprobada por el gerente</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {commissions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No hay comisiones registradas para este inmueble. Usa el simulador para calcular y solicitar.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {commissions.map(c => (
            <Card key={c.id} className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={statusColors[c.status] || ''}>{c.status}</Badge>
                      <span className="text-sm text-muted-foreground">{format(new Date(c.created_at), 'dd MMM yyyy', { locale: es })}</span>
                      {c.horus_bonus && <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1"><Award className="h-3 w-3" />Horus</Badge>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Precio venta</p>
                        <p className="font-semibold">{fmt(c.sale_price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Comisión agencia</p>
                        <p className="font-semibold">{fmt(c.agency_commission)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total asesor</p>
                        <p className="font-semibold text-primary">{fmt(c.agent_total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">% Efectivo</p>
                        <p className="font-semibold">{c.agent_base_pct.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-muted-foreground mb-1">Listing ({c.listing_pct}%) — {fmt(c.listing_amount)}</p>
                        <p>Origen: {getAgentName(c.listing_origin_agent_id)} · {fmt(c.listing_origin_amount)}</p>
                        <p>Campo: {getAgentName(c.listing_field_agent_id)} · {fmt(c.listing_field_amount)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground mb-1">Buying ({c.buying_pct}%) — {fmt(c.buying_amount)}</p>
                        <p>Origen: {getAgentName(c.buying_origin_agent_id)} · {fmt(c.buying_origin_amount)}</p>
                        <p>Campo: {getAgentName(c.buying_field_agent_id)} · {fmt(c.buying_field_amount)}</p>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="shrink-0">
                      {c.status === 'borrador' && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, 'aprobado')}>Aprobar</Button>}
                      {c.status === 'aprobado' && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, 'pagado')}><CheckCircle className="h-3 w-3 mr-1" />Pagar</Button>}
                      {c.status === 'pagado' && <span className="text-xs text-emerald-600 font-medium">✓ Pagado</span>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertyCommission;
