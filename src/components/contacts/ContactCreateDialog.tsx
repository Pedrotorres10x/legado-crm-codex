import { Dispatch, SetStateAction } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import DocumentScanner from '@/components/DocumentScanner';
import { Plus, Sparkles, Tag, User, Home, ArrowLeft, X } from 'lucide-react';
import { SUGGESTED_CONTACT_TAGS } from '@/lib/contact-tags';
import type { ContactCreateForm } from '@/hooks/useContactCreate';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogStep: 'type' | 'form';
  setDialogStep: Dispatch<SetStateAction<'type' | 'form'>>;
  form: ContactCreateForm;
  setForm: Dispatch<SetStateAction<ContactCreateForm>>;
  formTags: string[];
  setFormTags: Dispatch<SetStateAction<string[]>>;
  formTagInput: string;
  setFormTagInput: Dispatch<SetStateAction<string>>;
  loading: boolean;
  onSubmit: () => Promise<void>;
};

export default function ContactCreateDialog({
  open,
  onOpenChange,
  dialogStep,
  setDialogStep,
  form,
  setForm,
  formTags,
  setFormTags,
  formTagInput,
  setFormTagInput,
  loading,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dialogStep === 'type' ? 'Nuevo contacto' : 'Completa los datos del contacto'}
          </DialogTitle>
        </DialogHeader>
        {dialogStep === 'type' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold">¿Qué estás dando de alta?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Elige el tipo correcto para que el CRM te lleve al flujo bueno desde el primer día: captar prospectos vendedores, trabajar comprador o activar tu red.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
            <button
              className="rounded-2xl border p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => { setForm((f) => ({ ...f, contact_type: 'comprador' })); setDialogStep('form'); }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Comprador</p>
                  <p className="text-xs text-muted-foreground">Crea contacto y demanda compradora.</p>
                </div>
              </div>
            </button>
            <button
              className="rounded-2xl border p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => { setForm((f) => ({ ...f, contact_type: 'prospecto' })); setDialogStep('form'); }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Home className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium">Prospecto vendedor</p>
                  <p className="text-xs text-muted-foreground">Dueño sin firmar todavía. Alta enfocada a captación.</p>
                </div>
              </div>
            </button>
            <button
              className="rounded-2xl border p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => { setForm((f) => ({ ...f, contact_type: 'colaborador' })); setDialogStep('form'); }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium">Colaborador</p>
                  <p className="text-xs text-muted-foreground">Red de colaboración y referrals.</p>
                </div>
              </div>
            </button>
            <button
              className="rounded-2xl border p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => { setForm((f) => ({ ...f, contact_type: 'contacto' })); setDialogStep('form'); }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                  <Tag className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="font-medium">Contacto genérico</p>
                  <p className="text-xs text-muted-foreground">Alta simple sin flujo específico.</p>
                </div>
              </div>
            </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold">Alta simple y útil</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Con nombre, teléfono y tipo ya puedes arrancar. El resto sirve para que el CRM te prepare mejor el siguiente paso comercial.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">Tipo seleccionado</p>
                  <p className="text-xs text-muted-foreground">{form.contact_type}</p>
                </div>
                <DocumentScanner
                  context="contact"
                  buttonLabel="Escanear DNI"
                  onExtracted={(data) => {
                    setForm((f) => ({
                      ...f,
                      full_name: data.full_name || f.full_name,
                      email: data.email || f.email,
                      phone: data.phone || f.phone,
                      city: data.city || f.city,
                      id_number: data.id_number || f.id_number,
                      nationality: data.nationality || f.nationality,
                      birth_date: data.birth_date || f.birth_date,
                      notes: data.notes || f.notes,
                    }));
                  }}
                />
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datos mínimos</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Nombre completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>DNI / NIE</Label><Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Ciudad</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-2"><Label>Nacionalidad</Label><Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
                <div className="space-y-2"><Label>Fecha de nacimiento</Label><Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                      <Select value={form.contact_type} onValueChange={(value) => setForm({ ...form, contact_type: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comprador">Comprador</SelectItem>
                          <SelectItem value="prospecto">Prospecto vendedor</SelectItem>
                          <SelectItem value="propietario">Propietario (cliente)</SelectItem>
                          <SelectItem value="contacto">Contacto</SelectItem>
                          <SelectItem value="colaborador">Colaborador</SelectItem>
                          <SelectItem value="ambos">Ambos</SelectItem>
                        </SelectContent>
                  </Select>
                </div>
              </div>

              {form.contact_type === 'comprador' && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Demanda</p>
                  <p className="text-sm text-muted-foreground -mt-2">
                    Esto te ayuda a cruzar producto y empezar a mover visitas más rápido.
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>Presupuesto mínimo</Label><Input value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Presupuesto máximo</Label><Input value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Habitaciones mínimas</Label><Input value={form.desired_bedrooms} onChange={(e) => setForm({ ...form, desired_bedrooms: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Superficie mínima</Label><Input value={form.desired_surface} onChange={(e) => setForm({ ...form, desired_surface: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Ciudades</Label><Input value={form.desired_cities} onChange={(e) => setForm({ ...form, desired_cities: e.target.value })} placeholder="Benidorm, Finestrat" /></div>
                    <div className="space-y-2"><Label>Zonas</Label><Input value={form.desired_zones} onChange={(e) => setForm({ ...form, desired_zones: e.target.value })} placeholder="Levante, Poniente" /></div>
                    <div className="space-y-2">
                      <Label>Tipo inmueble</Label>
                      <Select value={form.desired_property_type} onValueChange={(value) => setForm({ ...form, desired_property_type: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="piso">Piso</SelectItem>
                          <SelectItem value="atico">Ático</SelectItem>
                          <SelectItem value="chalet">Chalet</SelectItem>
                          <SelectItem value="adosado">Adosado</SelectItem>
                          <SelectItem value="local">Local</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Operación</Label>
                      <Select value={form.desired_operation} onValueChange={(value) => setForm({ ...form, desired_operation: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="venta">Venta</SelectItem>
                          <SelectItem value="alquiler">Alquiler</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {(form.contact_type === 'propietario' || form.contact_type === 'prospecto') && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Captación</p>
                  <p className="text-sm text-muted-foreground -mt-2">
                    Si todavía no ha firmado, este contacto es un prospecto. Solo cuando ya sea cliente pasará a propietario.
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>Dirección inmueble</Label><Input value={form.property_address} onChange={(e) => setForm({ ...form, property_address: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Precio estimado</Label><Input value={form.estimated_price} onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} /></div>
                    <div className="space-y-2">
                      <Label>Tipo inmueble</Label>
                      <Select value={form.property_type} onValueChange={(value) => setForm({ ...form, property_type: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="piso">Piso</SelectItem>
                          <SelectItem value="atico">Ático</SelectItem>
                          <SelectItem value="chalet">Chalet</SelectItem>
                          <SelectItem value="adosado">Adosado</SelectItem>
                          <SelectItem value="local">Local</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base relacional</p>
              <p className="text-sm text-muted-foreground -mt-2">
                Segmenta bien este contacto si forma parte de tu círculo de influencia. Así luego podrás trabajarlo con precisión.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Circulo', hint: 'Red personal y recomendaciones', sourceRef: 'circulo', tags: ['Circulo'] },
                  { label: 'Zona', hint: 'Barrio, finca, portal, entorno local', sourceRef: 'zona', tags: ['Zona'] },
                  { label: 'Prescriptor', hint: 'Puede abrirte clientes o referrals', sourceRef: 'prescriptor', tags: ['Prescriptor'] },
                  { label: 'Cliente cerrado', hint: 'Comprador/vendedor ya cerrado', sourceRef: 'cliente-cerrado', tags: ['Cliente cerrado'] },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => {
                      setForm((current) => ({ ...current, source_ref: preset.sourceRef }));
                      setFormTags((current) => Array.from(new Set([...current, ...preset.tags])));
                    }}
                  >
                    <p className="text-sm font-medium">{preset.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{preset.hint}</p>
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { label: 'Oro', hint: 'Puede abrir minimo un prospecto cada 6 meses', tag: 'Oro' },
                  { label: 'Plata', hint: 'Puede abrir un prospecto al ano', tag: 'Plata' },
                  { label: 'Bronce', hint: 'Sabemos que puede recomendar, pero no lo tenemos claro todavia', tag: 'Bronce' },
                ].map((tier) => (
                  <button
                    key={tier.label}
                    type="button"
                    className="rounded-xl border border-border/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => {
                      setFormTags((current) => {
                        const withoutTiers = current.filter((tag) => !['Oro', 'Plata', 'Bronce'].includes(tag));
                        return Array.from(new Set([...withoutTiers, tier.tag]));
                      });
                    }}
                  >
                    <p className="text-sm font-medium">{tier.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tier.hint}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Origen / referencia comercial</Label>
                  <Input
                    value={form.source_ref}
                    onChange={(e) => setForm({ ...form, source_ref: e.target.value })}
                    placeholder="circulo, zona, prescriptor..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fuente / enlace</Label>
                  <Input
                    value={form.source_url}
                    onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                    placeholder="URL o referencia si aplica"
                  />
                </div>
              </div>

              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {formTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button onClick={() => setFormTags(formTags.filter((item) => item !== tag))} className="rounded-full hover:bg-destructive/20 p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={formTagInput}
                  onChange={(e) => setFormTagInput(e.target.value)}
                  placeholder="Añadir etiqueta..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const value = formTagInput.trim();
                      if (value && !formTags.includes(value)) setFormTags([...formTags, value]);
                      setFormTagInput('');
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const value = formTagInput.trim();
                    if (value && !formTags.includes(value)) setFormTags([...formTags, value]);
                    setFormTagInput('');
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_CONTACT_TAGS.filter((tag) => !formTags.includes(tag)).slice(0, 12).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    onClick={() => setFormTags([...formTags, tag])}
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              <Separator />
              <div className="space-y-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Observaciones, origen del contacto..." /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogStep('type')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Atrás
              </Button>
              <Button onClick={() => void onSubmit()} disabled={loading || !form.full_name}>
                {loading ? 'Guardando...' : 'Guardar y completar después'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
