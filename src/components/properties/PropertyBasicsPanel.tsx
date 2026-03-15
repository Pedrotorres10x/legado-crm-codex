import PriceHistory from '@/components/PriceHistory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Plus, X, Zap } from 'lucide-react';

export default function PropertyBasicsPanel({
  property,
  propertyId,
  saveField,
  setProperty,
  commissionMode,
  setCommissionMode,
  commissionPctInput,
  setCommissionPctInput,
  featureInput,
  setFeatureInput,
  popularFeatures,
  validateFloorNumber,
}: {
  property: any;
  propertyId?: string;
  saveField: (updates: Record<string, any>) => Promise<any>;
  setProperty: React.Dispatch<React.SetStateAction<any>>;
  commissionMode: 'fixed' | 'pct';
  setCommissionMode: (mode: 'fixed' | 'pct') => void;
  commissionPctInput: string;
  setCommissionPctInput: (value: string) => void;
  featureInput: string;
  setFeatureInput: (value: string) => void;
  popularFeatures: string[];
  validateFloorNumber: (value: string) => string | null;
}) {
  return (
    <>
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-primary font-bold">€</span>
            Precios y Comisión
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex flex-col flex-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground mb-1">Precio propietario</Label>
              <div className="flex items-center gap-1">
                <Input
                  className="text-right text-lg font-bold"
                  type="number"
                  placeholder="0"
                  value={property.owner_price != null ? property.owner_price : ''}
                  onChange={e => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setProperty((p: any) => {
                      const np = { ...p, owner_price: val };
                      if (val != null && p.commission != null && p.commission !== 0) {
                        np.price = Math.round(val + p.commission * 1.21);
                      } else if (val != null && p.price != null && p.price !== 0) {
                        np.commission = Math.round((p.price - val) / 1.21);
                        if (np.commission < 0) np.commission = null;
                      }
                      return np;
                    });
                    if (val && property.commission) setCommissionPctInput(((property.commission / val) * 100).toFixed(2));
                  }}
                  onBlur={() => saveField({ owner_price: property.owner_price, commission: property.commission, price: property.price })}
                />
                <span className="text-sm text-muted-foreground">€</span>
              </div>
            </div>

            <span className="text-muted-foreground text-2xl font-light mt-5">+</span>

            <div className="flex flex-col flex-1 min-w-[180px]">
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-xs text-muted-foreground">Comisión <span className="text-[10px] opacity-60">(sin IVA)</span></Label>
                <div className="flex rounded-md border border-border overflow-hidden text-[10px] ml-auto">
                  <button type="button" className={`px-2 py-0.5 transition-colors ${commissionMode === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`} onClick={() => setCommissionMode('fixed')}>€</button>
                  <button
                    type="button"
                    className={`px-2 py-0.5 transition-colors ${commissionMode === 'pct' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                    onClick={() => {
                      setCommissionMode('pct');
                      if (property.owner_price && property.commission) setCommissionPctInput(((property.commission / property.owner_price) * 100).toFixed(2));
                    }}
                  >%</button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {commissionMode === 'fixed' ? (
                  <>
                    <Input
                      className="text-right text-lg font-bold"
                      type="number"
                      placeholder="0"
                      value={property.commission != null ? property.commission : ''}
                      onChange={e => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        setProperty((p: any) => {
                          const np = { ...p, commission: val };
                          if (val != null && p.owner_price != null && p.owner_price !== 0) {
                            np.price = Math.round(p.owner_price + val * 1.21);
                          } else if (val != null && p.price != null && p.price !== 0) {
                            np.owner_price = Math.round(p.price - val * 1.21);
                            if (np.owner_price < 0) np.owner_price = null;
                          }
                          return np;
                        });
                        if (val && property.owner_price) setCommissionPctInput(((val / property.owner_price) * 100).toFixed(2));
                      }}
                      onBlur={() => saveField({ owner_price: property.owner_price, commission: property.commission, price: property.price })}
                    />
                    <span className="text-sm text-muted-foreground">€</span>
                  </>
                ) : (
                  <>
                    <Input
                      className="text-right text-lg font-bold"
                      type="number"
                      placeholder="0"
                      step="0.1"
                      value={commissionPctInput}
                      onChange={e => {
                        setCommissionPctInput(e.target.value);
                        const pct = e.target.value ? Number(e.target.value) : null;
                        if (pct != null && property.owner_price) {
                          const commVal = Math.round(property.owner_price * pct / 100);
                          setProperty((p: any) => ({ ...p, commission: commVal, price: Math.round(p.owner_price + commVal * 1.21) }));
                        } else if (pct != null && property.price) {
                          const owner = Math.round(property.price / (1 + (pct / 100) * 1.21));
                          const commVal = Math.round(owner * pct / 100);
                          setProperty((p: any) => ({ ...p, owner_price: owner, commission: commVal }));
                        }
                      }}
                      onBlur={() => saveField({ owner_price: property.owner_price, commission: property.commission, price: property.price })}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </>
                )}
              </div>
              {property.commission ? (
                <div className="mt-1.5 space-y-0.5 text-[10px]">
                  <span className="text-muted-foreground block">
                    Base: <span className="font-semibold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(property.commission)}</span>
                    {property.owner_price ? ` (${((property.commission / property.owner_price) * 100).toFixed(1)}%)` : ''}
                  </span>
                  <span className="text-muted-foreground block">
                    IVA 21%: <span className="font-semibold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(property.commission * 0.21)}</span>
                  </span>
                  <span className="text-primary font-semibold block">
                    Comisión total: {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(property.commission * 1.21)}
                  </span>
                </div>
              ) : null}
            </div>

            <span className="text-muted-foreground text-2xl font-light mt-5">=</span>

            <div className="flex flex-col flex-1 min-w-[140px]">
              <Label className="text-xs text-primary font-semibold mb-1">Precio publicación</Label>
              <div className="flex items-center gap-1">
                <Input
                  className="text-right text-xl font-display font-bold text-primary"
                  type="number"
                  placeholder="Precio"
                  value={property.price != null ? property.price : ''}
                  onChange={e => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setProperty((p: any) => {
                      const np = { ...p, price: val };
                      if (val != null && p.owner_price != null && p.owner_price !== 0) {
                        np.commission = Math.round((val - p.owner_price) / 1.21);
                        if (np.commission < 0) np.commission = null;
                      } else if (val != null && p.commission != null && p.commission !== 0) {
                        np.owner_price = Math.round(val - p.commission * 1.21);
                        if (np.owner_price < 0) np.owner_price = null;
                      }
                      if (np.commission != null && np.owner_price) setCommissionPctInput(((np.commission / np.owner_price) * 100).toFixed(2));
                      return np;
                    });
                  }}
                  onBlur={() => saveField({ owner_price: property.owner_price, commission: property.commission, price: property.price })}
                />
                <span className="text-xl font-bold text-primary">€</span>
              </div>
              {property.owner_price && property.price ? (
                <span className="text-[10px] text-muted-foreground mt-1">Margen total: {((property.price - property.owner_price) / property.owner_price * 100).toFixed(1)}%</span>
              ) : null}
            </div>
          </div>
          {propertyId && <PriceHistory propertyId={propertyId} />}
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />Ubicación</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Dirección</Label>
              <Input value={property.address || ''} placeholder="Calle, número" onChange={e => setProperty((p: any) => ({ ...p, address: e.target.value }))} onBlur={() => saveField({ address: property.address || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Escalera</Label>
              <Input value={property.staircase || ''} placeholder="Ej: 1, A, B" onChange={e => setProperty((p: any) => ({ ...p, staircase: e.target.value }))} onBlur={() => saveField({ staircase: property.staircase || null })} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Planta</Label>
                {validateFloorNumber(property.floor_number) && <span className="text-xs text-destructive font-medium flex items-center gap-1">⚠️ {validateFloorNumber(property.floor_number)}</span>}
              </div>
              <Input value={property.floor_number || ''} placeholder="Ej: 3º, Bajo, Ático" className={validateFloorNumber(property.floor_number) ? 'border-destructive' : ''} onChange={e => setProperty((p: any) => ({ ...p, floor_number: e.target.value }))} onBlur={() => saveField({ floor_number: property.floor_number || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Puerta</Label>
              <Input value={property.door || ''} placeholder="Ej: A, 1ª, Izq" onChange={e => setProperty((p: any) => ({ ...p, door: e.target.value }))} onBlur={() => saveField({ door: property.door || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">País</Label>
              <Input list="detail-country-list" value={property.country || 'España'} placeholder="País" onChange={e => setProperty((p: any) => ({ ...p, country: e.target.value }))} onBlur={() => saveField({ country: property.country || 'España' })} />
              <datalist id="detail-country-list">
                {['España', 'Portugal', 'Francia', 'Italia', 'Alemania', 'Reino Unido', 'Países Bajos', 'Bélgica', 'Suiza', 'Andorra', 'Marruecos', 'Estados Unidos', 'México', 'Argentina', 'Colombia', 'Chile', 'Brasil', 'Dubái (EAU)', 'Turquía', 'Grecia', 'Croacia', 'Tailandia'].map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ciudad</Label>
              <Input value={property.city || ''} placeholder="Ciudad" onChange={e => setProperty((p: any) => ({ ...p, city: e.target.value }))} onBlur={() => saveField({ city: property.city || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Provincia / Región</Label>
              <Input value={property.province || ''} placeholder={property.country === 'España' ? 'Provincia' : 'Región / Estado'} onChange={e => setProperty((p: any) => ({ ...p, province: e.target.value }))} onBlur={() => saveField({ province: property.province || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zona</Label>
              <Input value={property.zone || ''} placeholder="Ej: Costa Blanca, Marina Alta" onChange={e => setProperty((p: any) => ({ ...p, zone: e.target.value }))} onBlur={() => saveField({ zone: property.zone || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Código Postal</Label>
              <Input value={property.zip_code || ''} placeholder="C.P." onChange={e => setProperty((p: any) => ({ ...p, zip_code: e.target.value }))} onBlur={() => saveField({ zip_code: property.zip_code || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Certificado Energético</Label>
              <Select value={property.energy_cert || 'none'} onValueChange={v => saveField({ energy_cert: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin certificar</SelectItem>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Antigüedad (año construcción)</Label>
              <Input type="number" min="1800" max="2100" value={property.year_built ?? ''} placeholder="Ej: 2005" onChange={e => setProperty((p: any) => ({ ...p, year_built: e.target.value ? parseInt(e.target.value) : null }))} onBlur={() => saveField({ year_built: property.year_built || null })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />Características y Equipamiento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {([
              { field: 'has_elevator', label: '🛗 Ascensor' },
              { field: 'has_garage', label: '🅿️ Garaje' },
              { field: 'has_pool', label: '🏊 Piscina' },
              { field: 'has_terrace', label: '☀️ Terraza' },
              { field: 'has_garden', label: '🌿 Jardín' },
            ] as const).map(item => (
              <label key={item.field} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors">
                <Checkbox checked={!!property[item.field]} onCheckedChange={(checked) => saveField({ [item.field]: !!checked })} />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Extras (etiquetas para matching)</Label>
            <div className="flex flex-wrap gap-2">
              {(property.features || []).map((f: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs gap-1">
                  {f}
                  <button className="ml-1 hover:text-destructive" onClick={() => saveField({ features: (property.features || []).filter((_: string, idx: number) => idx !== i) })}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {popularFeatures.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Habituales (clic para añadir)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {popularFeatures.filter(f => !(property.features || []).includes(f)).map(f => (
                    <button key={f} className="text-xs px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors" onClick={() => saveField({ features: [...(property.features || []), f] })}>
                      + {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Input className="flex-1" placeholder="Añadir extra (ej: aire acondicionado, trastero...)" value={featureInput} onChange={e => setFeatureInput(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter' && featureInput.trim()) {
                  e.preventDefault();
                  saveField({ features: [...(property.features || []), featureInput.trim()] });
                  setFeatureInput('');
                }
              }} />
              <Button size="sm" variant="outline" disabled={!featureInput.trim()} onClick={() => {
                saveField({ features: [...(property.features || []), featureInput.trim()] });
                setFeatureInput('');
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up">
        <CardHeader><CardTitle className="text-base">Descripción</CardTitle></CardHeader>
        <CardContent>
          <Textarea className="min-h-[120px]" placeholder="Descripción del inmueble..." value={property.description || ''} onChange={e => setProperty((p: any) => ({ ...p, description: e.target.value }))} onBlur={() => saveField({ description: property.description || null })} />
        </CardContent>
      </Card>
    </>
  );
}
