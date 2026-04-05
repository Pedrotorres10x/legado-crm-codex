import type { Dispatch, SetStateAction } from 'react';
import type { Database } from '@/integrations/supabase/types';
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

type PropertyBasicsState = Pick<
  Database['public']['Tables']['properties']['Row'],
  | 'address'
  | 'city'
  | 'commission'
  | 'country'
  | 'description'
  | 'door'
  | 'energy_cert'
  | 'features'
  | 'floor_number'
  | 'has_elevator'
  | 'has_garage'
  | 'has_garden'
  | 'has_pool'
  | 'has_terrace'
  | 'images'
  | 'mandate_end'
  | 'mandate_type'
  | 'owner_price'
  | 'price'
  | 'province'
  | 'source'
  | 'staircase'
  | 'status'
  | 'title'
  | 'xml_id'
  | 'year_built'
  | 'zip_code'
  | 'zone'
>;

type SaveField = (updates: Record<string, unknown>) => Promise<unknown>;

type Props = {
  property: PropertyBasicsState;
  propertyId?: string;
  saveField: SaveField;
  setProperty: Dispatch<SetStateAction<PropertyBasicsState>>;
  commissionMode: 'fixed' | 'pct';
  setCommissionMode: (mode: 'fixed' | 'pct') => void;
  commissionPctInput: string;
  setCommissionPctInput: (value: string) => void;
  featureInput: string;
  setFeatureInput: (value: string) => void;
  popularFeatures: string[];
  validateFloorNumber: (value: string) => string | null;
};

const COUNTRIES = ['España', 'Portugal', 'Francia', 'Italia', 'Alemania', 'Reino Unido', 'Países Bajos', 'Bélgica', 'Suiza', 'Andorra', 'Marruecos', 'Estados Unidos', 'México', 'Argentina', 'Colombia', 'Chile', 'Brasil', 'Dubái (EAU)', 'Turquía', 'Grecia', 'Croacia', 'Tailandia'];

const FEATURE_TOGGLES = [
  { field: 'has_elevator', label: 'Ascensor' },
  { field: 'has_garage', label: 'Garaje' },
  { field: 'has_pool', label: 'Piscina' },
  { field: 'has_terrace', label: 'Terraza' },
  { field: 'has_garden', label: 'Jardín' },
] as const;

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

const updatePriceFromOwnerAndCommission = (ownerPrice: number | null, commission: number | null) =>
  ownerPrice != null && commission != null ? Math.round(ownerPrice + commission * 1.21) : null;

const updateCommissionFromPriceAndOwner = (price: number | null, ownerPrice: number | null) => {
  if (price == null || ownerPrice == null) return null;
  const next = Math.round((price - ownerPrice) / 1.21);
  return next >= 0 ? next : null;
};

const updateOwnerFromPriceAndCommission = (price: number | null, commission: number | null) => {
  if (price == null || commission == null) return null;
  const next = Math.round(price - commission * 1.21);
  return next >= 0 ? next : null;
};

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
}: Props) {
  const floorValidation = validateFloorNumber(property.floor_number || '');

  return (
    <>
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-primary font-bold">EUR</span>
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
                  value={property.owner_price ?? ''}
                  onChange={(e) => {
                    const ownerPrice = e.target.value ? Number(e.target.value) : null;
                    setProperty((prev) => {
                      const commission = prev.commission ?? updateCommissionFromPriceAndOwner(prev.price, ownerPrice);
                      return {
                        ...prev,
                        owner_price: ownerPrice,
                        commission,
                        price: updatePriceFromOwnerAndCommission(ownerPrice, commission) ?? prev.price,
                      };
                    });
                    if (ownerPrice && property.commission) {
                      setCommissionPctInput(((property.commission / ownerPrice) * 100).toFixed(2));
                    }
                  }}
                  onBlur={() => saveField({ owner_price: property.owner_price, commission: property.commission, price: property.price })}
                />
                <span className="text-sm text-muted-foreground">EUR</span>
              </div>
            </div>

            <span className="text-muted-foreground text-2xl font-light mt-5">+</span>

            <div className="flex flex-col flex-1 min-w-[180px]">
              <div className="flex items-center gap-2 mb-1">
                <Label className="text-xs text-muted-foreground">Comisión <span className="text-[10px] opacity-60">(sin IVA)</span></Label>
                <div className="flex rounded-md border border-border overflow-hidden text-[10px] ml-auto">
                  <button type="button" className={`px-2 py-0.5 transition-colors ${commissionMode === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`} onClick={() => setCommissionMode('fixed')}>EUR</button>
                  <button
                    type="button"
                    className={`px-2 py-0.5 transition-colors ${commissionMode === 'pct' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
                    onClick={() => {
                      setCommissionMode('pct');
                      if (property.owner_price && property.commission) {
                        setCommissionPctInput(((property.commission / property.owner_price) * 100).toFixed(2));
                      }
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
                      value={property.commission ?? ''}
                      onChange={(e) => {
                        const commission = e.target.value ? Number(e.target.value) : null;
                        setProperty((prev) => ({
                          ...prev,
                          commission,
                          owner_price: prev.owner_price ?? updateOwnerFromPriceAndCommission(prev.price, commission),
                          price: updatePriceFromOwnerAndCommission(prev.owner_price, commission) ?? prev.price,
                        }));
                        if (commission && property.owner_price) {
                          setCommissionPctInput(((commission / property.owner_price) * 100).toFixed(2));
                        }
                      }}
                      onBlur={() => saveField({ owner_price: property.owner_price, commission: property.commission, price: property.price })}
                    />
                    <span className="text-sm text-muted-foreground">EUR</span>
                  </>
                ) : (
                  <>
                    <Input
                      className="text-right text-lg font-bold"
                      type="number"
                      placeholder="0"
                      step="0.1"
                      value={commissionPctInput}
                      onChange={(e) => {
                        setCommissionPctInput(e.target.value);
                        const pct = e.target.value ? Number(e.target.value) : null;
                        if (pct == null) return;
                        setProperty((prev) => {
                          const ownerPrice = prev.owner_price ?? updateOwnerFromPriceAndCommission(prev.price, prev.commission);
                          const commission = ownerPrice != null ? Math.round(ownerPrice * pct / 100) : prev.commission;
                          return {
                            ...prev,
                            owner_price: ownerPrice,
                            commission,
                            price: updatePriceFromOwnerAndCommission(ownerPrice, commission) ?? prev.price,
                          };
                        });
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
                    Base: <span className="font-semibold">{formatMoney(property.commission)}</span>
                    {property.owner_price ? ` (${((property.commission / property.owner_price) * 100).toFixed(1)}%)` : ''}
                  </span>
                  <span className="text-muted-foreground block">
                    IVA 21%: <span className="font-semibold">{formatMoney(property.commission * 0.21)}</span>
                  </span>
                  <span className="text-primary font-semibold block">
                    Comisión total: {formatMoney(property.commission * 1.21)}
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
                  value={property.price ?? ''}
                  onChange={(e) => {
                    const price = e.target.value ? Number(e.target.value) : null;
                    setProperty((prev) => {
                      const commission = updateCommissionFromPriceAndOwner(price, prev.owner_price);
                      const ownerPrice = commission == null ? updateOwnerFromPriceAndCommission(price, prev.commission) : prev.owner_price;
                      if (commission != null && ownerPrice) {
                        setCommissionPctInput(((commission / ownerPrice) * 100).toFixed(2));
                      }
                      return {
                        ...prev,
                        price,
                        commission: commission ?? prev.commission,
                        owner_price: ownerPrice,
                      };
                    });
                  }}
                  onBlur={() => saveField({ owner_price: property.owner_price, commission: property.commission, price: property.price })}
                />
                <span className="text-xl font-bold text-primary">EUR</span>
              </div>
              {property.owner_price && property.price ? (
                <span className="text-[10px] text-muted-foreground mt-1">Margen total: {(((property.price - property.owner_price) / property.owner_price) * 100).toFixed(1)}%</span>
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
              <Input value={property.address || ''} placeholder="Calle, número" onChange={(e) => setProperty((prev) => ({ ...prev, address: e.target.value }))} onBlur={() => saveField({ address: property.address || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Escalera</Label>
              <Input value={property.staircase || ''} placeholder="Ej: 1, A, B" onChange={(e) => setProperty((prev) => ({ ...prev, staircase: e.target.value }))} onBlur={() => saveField({ staircase: property.staircase || null })} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Planta</Label>
                {floorValidation && <span className="text-xs text-destructive font-medium flex items-center gap-1">! {floorValidation}</span>}
              </div>
              <Input value={property.floor_number || ''} placeholder="Ej: 3º, Bajo, Ático" className={floorValidation ? 'border-destructive' : ''} onChange={(e) => setProperty((prev) => ({ ...prev, floor_number: e.target.value }))} onBlur={() => saveField({ floor_number: property.floor_number || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Puerta</Label>
              <Input value={property.door || ''} placeholder="Ej: A, 1ª, Izq" onChange={(e) => setProperty((prev) => ({ ...prev, door: e.target.value }))} onBlur={() => saveField({ door: property.door || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">País</Label>
              <Input list="detail-country-list" value={property.country || 'España'} placeholder="País" onChange={(e) => setProperty((prev) => ({ ...prev, country: e.target.value }))} onBlur={() => saveField({ country: property.country || 'España' })} />
              <datalist id="detail-country-list">
                {COUNTRIES.map((country) => <option key={country} value={country} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ciudad</Label>
              <Input value={property.city || ''} placeholder="Ciudad" onChange={(e) => setProperty((prev) => ({ ...prev, city: e.target.value }))} onBlur={() => saveField({ city: property.city || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Provincia / Región</Label>
              <Input value={property.province || ''} placeholder={property.country === 'España' ? 'Provincia' : 'Región / Estado'} onChange={(e) => setProperty((prev) => ({ ...prev, province: e.target.value }))} onBlur={() => saveField({ province: property.province || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zona</Label>
              <Input value={property.zone || ''} placeholder="Ej: Costa Blanca, Marina Alta" onChange={(e) => setProperty((prev) => ({ ...prev, zone: e.target.value }))} onBlur={() => saveField({ zone: property.zone || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Código Postal</Label>
              <Input value={property.zip_code || ''} placeholder="C.P." onChange={(e) => setProperty((prev) => ({ ...prev, zip_code: e.target.value }))} onBlur={() => saveField({ zip_code: property.zip_code || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Certificado Energético</Label>
              <Select value={property.energy_cert || 'none'} onValueChange={(value) => saveField({ energy_cert: value === 'none' ? null : value })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin certificar</SelectItem>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((label) => <SelectItem key={label} value={label}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Antigüedad (año construcción)</Label>
              <Input type="number" min="1800" max="2100" value={property.year_built ?? ''} placeholder="Ej: 2005" onChange={(e) => setProperty((prev) => ({ ...prev, year_built: e.target.value ? parseInt(e.target.value, 10) : null }))} onBlur={() => saveField({ year_built: property.year_built || null })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />Características y Equipamiento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {FEATURE_TOGGLES.map((item) => (
              <label key={item.field} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors">
                <Checkbox checked={!!property[item.field]} onCheckedChange={(checked) => saveField({ [item.field]: !!checked })} />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Extras (etiquetas para matching)</Label>
            <div className="flex flex-wrap gap-2">
              {(property.features || []).map((feature, index) => (
                <Badge key={`${feature}-${index}`} variant="secondary" className="text-xs gap-1">
                  {feature}
                  <button className="ml-1 hover:text-destructive" onClick={() => saveField({ features: (property.features || []).filter((_, currentIndex) => currentIndex !== index) })}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {popularFeatures.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Habituales (clic para añadir)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {popularFeatures.filter((feature) => !(property.features || []).includes(feature)).map((feature) => (
                    <button key={feature} className="text-xs px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors" onClick={() => saveField({ features: [...(property.features || []), feature] })}>
                      + {feature}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Añadir extra (ej: aire acondicionado, trastero...)"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && featureInput.trim()) {
                    e.preventDefault();
                    saveField({ features: [...(property.features || []), featureInput.trim()] });
                    setFeatureInput('');
                  }
                }}
              />
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
          <Textarea className="min-h-[120px]" placeholder="Descripción del inmueble..." value={property.description || ''} onChange={(e) => setProperty((prev) => ({ ...prev, description: e.target.value }))} onBlur={() => saveField({ description: property.description || null })} />
        </CardContent>
      </Card>
    </>
  );
}
