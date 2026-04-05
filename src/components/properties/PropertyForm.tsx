import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { MapPinned, Search, Loader2, Sparkles, ImagePlus, Video, Globe, Trash2 } from 'lucide-react';
import DocumentScanner from '@/components/DocumentScanner';
import { SPANISH_PROVINCES } from '@/lib/spanish-geo';
import { propertyTypes } from './property-filters-config';
import { usePropertyCreateForm } from '@/hooks/usePropertyCreateForm';
import { useToast } from '@/hooks/use-toast';

interface PropertyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

type PropertyFormWithExtras = typeof usePropertyCreateForm extends (...args: never[]) => infer T
  ? T extends { form: infer F }
    ? F & {
        zone?: string;
        has_elevator?: boolean;
        has_garage?: boolean;
        has_pool?: boolean;
        has_terrace?: boolean;
        has_garden?: boolean;
      }
    : never
  : never;

export const PropertyForm = ({ open, onOpenChange, onCreated }: PropertyFormProps) => {
  const { toast } = useToast();
  const {
    form,
    loading,
    aiLoading,
    refWarning,
    imagePreviews,
    imageLabels,
    imageScores,
    uploadingImages,
    taggingImages,
    catastroLoading,
    catastroResults,
    catastroDialogOpen,
    catastroTab,
    catastroAddress,
    catastro,
    patch,
    setAiLoading,
    setCatastroLoading,
    setCatastroResults,
    setCatastroDialogOpen,
    setCatastroTab,
    setCatastroAddress,
    applyFichaCatastral,
    resetForm,
    handleSubmit,
    handleImageSelect,
    removeImage,
    handleReferenceChange,
    handleZipCodeChange,
  } = usePropertyCreateForm({ onCreated, onOpenChange });
  const propertyForm = form as PropertyFormWithExtras;

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => { if (!value) resetForm(); onOpenChange(value); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Nuevo Inmueble</DialogTitle>
              <DocumentScanner context="property" onExtracted={(data) => {
                patch({
                  property_type: data.property_type || form.property_type,
                  price: data.price ? String(data.price) : form.price,
                  surface_area: data.surface_area ? String(data.surface_area) : form.surface_area,
                  built_area: data.built_area ? String(data.built_area) : form.built_area,
                  bedrooms: data.bedrooms ? String(data.bedrooms) : form.bedrooms,
                  bathrooms: data.bathrooms ? String(data.bathrooms) : form.bathrooms,
                  city: data.property_city || form.city,
                  province: data.property_province || form.province,
                  address: data.property_address || form.address,
                  zip_code: data.property_zip_code || form.zip_code,
                  floor: data.floor || form.floor,
                  energy_cert: data.energy_cert || form.energy_cert,
                  reference: data.cadastral_reference || form.reference,
                  description: data.property_description || form.description,
                  title: form.title || `${data.property_type ? data.property_type.charAt(0).toUpperCase() + data.property_type.slice(1) : 'Inmueble'} en ${data.property_city || data.property_address || ''}`.trim(),
                });
              }} />
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold">Alta rápida para agente</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Para arrancar bien solo necesitas tres cosas: ubicar el inmueble, marcar el tipo de producto y dejar una base comercial mínima.
              </p>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <div className="rounded-lg bg-background px-3 py-2">
                  <span className="font-medium">1. Ubicación</span>
                  <p className="mt-1 text-muted-foreground">Referencia catastral o dirección.</p>
                </div>
                <div className="rounded-lg bg-background px-3 py-2">
                  <span className="font-medium">2. Producto</span>
                  <p className="mt-1 text-muted-foreground">Tipo, operación y precio orientativo.</p>
                </div>
                <div className="rounded-lg bg-background px-3 py-2">
                  <span className="font-medium">3. Base de venta</span>
                  <p className="mt-1 text-muted-foreground">Fotos, descripción y extras si ya los tienes.</p>
                </div>
              </div>
            </div>

            {form.country === 'España' && (
              <div className="space-y-2 p-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
                <div className="flex items-center gap-1 mb-2">
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${catastroTab === 'rc' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                    onClick={() => setCatastroTab('rc')}
                  >
                    <MapPinned className="h-3.5 w-3.5" />
                    Referencia Catastral
                  </button>
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${catastroTab === 'address' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                    onClick={() => setCatastroTab('address')}
                  >
                    <Search className="h-3.5 w-3.5" />
                    Buscar por dirección
                  </button>
                </div>

                {catastroTab === 'rc' ? (
                  <>
                    <div className="flex gap-2">
                      <Input
                        className="flex-1 font-mono"
                        value={form.reference}
                        onChange={(event) => handleReferenceChange(event.target.value)}
                        placeholder="Ej: 1234567AB1234C0001XX"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={catastroLoading || !form.reference || form.reference.length < 14}
                        onClick={async () => {
                          setCatastroLoading(true);
                          await applyFichaCatastral(form.reference);
                          setCatastroLoading(false);
                        }}
                      >
                        {catastroLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPinned className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Introduce la referencia catastral y pulsa el botón para autorellenar</p>
                    {refWarning && <p className="text-xs text-amber-600 font-medium">{refWarning}</p>}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Input
                          list="catastro-prov-list"
                          placeholder="Provincia"
                          value={catastroAddress.provincia}
                          onChange={(event) => {
                            const value = event.target.value;
                            setCatastroAddress((current) => ({ ...current, provincia: value, municipio: '', calle: '' }));
                            if (value.length >= 3) catastro.fetchMunicipios(value);
                          }}
                        />
                        <datalist id="catastro-prov-list">{SPANISH_PROVINCES.map((province) => <option key={province} value={province} />)}</datalist>
                      </div>
                      <div>
                        <Input
                          list="catastro-muni-list"
                          placeholder="Municipio"
                          value={catastroAddress.municipio}
                          onChange={(event) => setCatastroAddress((current) => ({ ...current, municipio: event.target.value, calle: '' }))}
                        />
                        <datalist id="catastro-muni-list">{catastro.municipios.map((municipio) => <option key={municipio} value={municipio} />)}</datalist>
                      </div>
                      <div>
                        <Input
                          list="catastro-calle-list"
                          placeholder="Calle"
                          value={catastroAddress.calle}
                          onChange={(event) => {
                            const value = event.target.value;
                            setCatastroAddress((current) => ({ ...current, calle: value, numero: '' }));
                            if (value.length >= 2 && catastroAddress.provincia && catastroAddress.municipio) {
                              catastro.fetchCalles(catastroAddress.provincia, catastroAddress.municipio, value);
                            }
                            if (catastro.calles.includes(value) && catastroAddress.provincia && catastroAddress.municipio) {
                              catastro.fetchNumeros(catastroAddress.provincia, catastroAddress.municipio, value);
                            }
                          }}
                        />
                        <datalist id="catastro-calle-list">{catastro.calles.map((street) => <option key={street} value={street} />)}</datalist>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          list="catastro-num-list"
                          placeholder="Nº"
                          value={catastroAddress.numero}
                          onChange={(event) => setCatastroAddress((current) => ({ ...current, numero: event.target.value }))}
                        />
                        <datalist id="catastro-num-list">{catastro.numeros.map((number) => <option key={number} value={number} />)}</datalist>
                        <Button
                          type="button"
                          size="sm"
                          disabled={catastroLoading || !catastroAddress.provincia || !catastroAddress.municipio || !catastroAddress.calle || !catastroAddress.numero}
                          onClick={async () => {
                            setCatastroLoading(true);
                            try {
                              const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/catastro`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                                body: JSON.stringify(catastroAddress),
                              });
                              const data = await resp.json();
                              if (data.error && (!data.results || data.results.length === 0)) {
                                toast({ title: 'Catastro', description: data.error, variant: 'destructive' });
                              } else if (data.results?.length === 1) {
                                await applyFichaCatastral(data.results[0].rc);
                              } else if (data.results?.length > 1) {
                                setCatastroResults(data.results);
                                setCatastroDialogOpen(true);
                              }
                            } catch {
                              toast({ title: 'Error', description: 'No se pudo conectar con Catastro', variant: 'destructive' });
                            }
                            setCatastroLoading(false);
                          }}
                        >
                          {catastroLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Rellena provincia, municipio, calle y número para buscar en el Catastro</p>
                  </>
                )}
              </div>
            )}

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lo mínimo para darlo de alta</p>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.title} onChange={(event) => patch({ title: event.target.value })} placeholder="Piso en centro..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.property_type} onValueChange={(value) => patch({ property_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{propertyTypes.map((type) => <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operación</Label>
                <Select value={form.operation} onValueChange={(value) => patch({ operation: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="alquiler">Alquiler</SelectItem>
                    <SelectItem value="ambas">Ambas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Precio (€)</Label><Input type="number" value={form.price} onChange={(event) => patch({ price: event.target.value })} /></div>
              <div className="space-y-2"><Label>Superficie útil (m²)</Label><Input type="number" value={form.surface_area} onChange={(event) => patch({ surface_area: event.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Superficie construida (m²)</Label><Input type="number" value={form.built_area} onChange={(event) => patch({ built_area: event.target.value })} /></div>
              <div className="space-y-2"><Label>Planta</Label><Input value={form.floor} onChange={(event) => patch({ floor: event.target.value })} placeholder="Ej: 3ª" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Habitaciones</Label><Input type="number" value={form.bedrooms} onChange={(event) => patch({ bedrooms: event.target.value })} /></div>
              <div className="space-y-2"><Label>Baños</Label><Input type="number" value={form.bathrooms} onChange={(event) => patch({ bathrooms: event.target.value })} /></div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Ubicación</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>País</Label>
                <Input list="country-list" value={form.country} onChange={(event) => patch({ country: event.target.value })} placeholder="País" />
                <datalist id="country-list">
                  {['España', 'Portugal', 'Francia', 'Italia', 'Alemania', 'Reino Unido', 'Países Bajos', 'Bélgica', 'Suiza', 'Andorra', 'Marruecos', 'Estados Unidos', 'México', 'Argentina', 'Colombia', 'Chile', 'Brasil', 'Dubái (EAU)', 'Turquía', 'Grecia', 'Croacia', 'Tailandia'].map((country) => <option key={country} value={country} />)}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input list="form-muni-list" value={form.city} onChange={(event) => patch({ city: event.target.value })} placeholder="Escribe para buscar..." />
                {form.country === 'España' && <datalist id="form-muni-list">{catastro.municipios.map((municipio) => <option key={municipio} value={municipio} />)}</datalist>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provincia / Región</Label>
                {form.country === 'España' ? (
                  <>
                    <Input
                      list="provinces-list"
                      value={form.province}
                      onChange={(event) => {
                        patch({ province: event.target.value });
                        if (event.target.value.length >= 3) catastro.fetchMunicipios(event.target.value);
                      }}
                      placeholder="Selecciona o escribe..."
                    />
                    <datalist id="provinces-list">{SPANISH_PROVINCES.map((province) => <option key={province} value={province} />)}</datalist>
                  </>
                ) : (
                  <Input value={form.province} onChange={(event) => patch({ province: event.target.value })} placeholder="Región, estado o provincia..." />
                )}
              </div>
              <div className="space-y-2"><Label>Dirección</Label><Input value={form.address} onChange={(event) => patch({ address: event.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código Postal</Label>
                <Input value={form.zip_code} placeholder={form.country === 'España' ? '28001' : 'Código postal'} onChange={(event) => handleZipCodeChange(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Zona</Label>
                <Input value={propertyForm.zone || ''} onChange={(event) => patch({ zone: event.target.value })} placeholder="Ej: Costa Blanca, Downtown..." />
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Completa la ficha si ya lo tienes</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'has_elevator', label: 'Ascensor' },
                { key: 'has_garage', label: 'Garaje' },
                { key: 'has_pool', label: 'Piscina' },
                { key: 'has_terrace', label: 'Terraza' },
                { key: 'has_garden', label: 'Jardín' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm">{label}</Label>
                  <Switch checked={Boolean(propertyForm[key as keyof PropertyFormWithExtras])} onCheckedChange={(value) => patch({ [key]: value })} />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Certificado Energético</Label>
              <Select value={form.energy_cert} onValueChange={(value) => patch({ energy_cert: value })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'En trámite', 'Exento'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Año de construcción</Label>
              <Input type="number" placeholder="Ej: 2005" value={form.year_built} onChange={(event) => patch({ year_built: event.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Extras</Label>
              <div className="flex flex-wrap gap-2 min-h-[40px] rounded-md border border-input p-2">
                {(form.features ? form.features.split(',').map((feature) => feature.trim()).filter(Boolean) : []).map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="gap-1 px-2.5 py-1 text-sm cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => {
                      const tags = form.features.split(',').map((feature) => feature.trim()).filter(Boolean);
                      tags.splice(index, 1);
                      patch({ features: tags.join(', ') });
                    }}
                  >
                    {tag}
                    <span className="text-xs ml-0.5">×</span>
                  </Badge>
                ))}
                <Input
                  className="border-0 shadow-none p-0 h-7 min-w-[120px] flex-1 focus-visible:ring-0"
                  placeholder="Escribir y pulsar Enter..."
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      const value = (event.target as HTMLInputElement).value.trim();
                      if (value) {
                        const existing = form.features ? form.features.split(',').map((feature) => feature.trim()).filter(Boolean) : [];
                        if (!existing.includes(value)) patch({ features: [...existing, value].join(', ') });
                        (event.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Pulsa Enter o coma para añadir. Haz clic en una etiqueta para eliminarla.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Descripción</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={aiLoading}
                  onClick={async () => {
                    setAiLoading(true);
                    try {
                      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-description`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
                        body: JSON.stringify({ property: { ...form, features: form.features ? form.features.split(',').map((feature) => feature.trim()) : [] } }),
                      });
                      const data = await resp.json();
                      if (data.error) toast({ title: 'Error IA', description: data.error, variant: 'destructive' });
                      else {
                        patch({ description: data.description });
                        toast({ title: 'Descripción generada con IA ✨' });
                      }
                    } catch {
                      toast({ title: 'Error', description: 'No se pudo conectar con IA', variant: 'destructive' });
                    }
                    setAiLoading(false);
                  }}
                >
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  Generar con IA
                </Button>
              </div>
              <Textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} rows={4} />
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Multimedia</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><ImagePlus className="h-4 w-4" />Fotos</Label>
                {taggingImages && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Analizando atractivo con IA...</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {imagePreviews.map((src, index) => (
                  <div key={index} className={`relative w-24 rounded-lg overflow-hidden border group ${index === 0 && imageScores[0] > 0 ? 'ring-2 ring-primary' : ''}`}>
                    {index === 0 && imageScores[0] > 0 && (
                      <div className="absolute top-0 left-0 z-10 bg-primary text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg">★ PORTADA</div>
                    )}
                    <div className="aspect-square"><img src={src} alt="" className="w-full h-full object-cover" /></div>
                    <div className="px-1 py-0.5 bg-muted text-center">
                      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide truncate block">
                        {imageLabels[index] === '...' ? '...' : (imageLabels[index] || '').replace(/_/g, ' ')}
                      </span>
                      {imageScores[index] > 0 && (
                        <span className={`text-[8px] font-bold block ${imageScores[index] >= 70 ? 'text-green-600' : imageScores[index] >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {imageScores[index]}/100 pts
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => removeImage(index)} className="absolute top-0 right-0 p-1 bg-black/60 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
                <label className="w-24 aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground mt-0.5">Añadir</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                </label>
              </div>
              {uploadingImages && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Subiendo fotos...</p>}
              <p className="text-xs text-muted-foreground">La IA puntúa el atractivo visual de cada foto y coloca la mejor como portada</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Video className="h-4 w-4" />Vídeo (URL)</Label>
              <Input value={form.video_url} onChange={(event) => patch({ video_url: event.target.value })} placeholder="https://youtube.com/watch?v=..." />
              <p className="text-xs text-muted-foreground">YouTube, Vimeo o enlace directo a MP4</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Globe className="h-4 w-4" />Tour Virtual (URL)</Label>
              <Input value={form.virtual_tour_url} onChange={(event) => patch({ virtual_tour_url: event.target.value })} placeholder="https://my.matterport.com/show/?m=..." />
              <p className="text-xs text-muted-foreground">Matterport, Zillow 3D u otro proveedor</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading || !form.title}>
              {loading ? 'Guardando...' : 'Guardar y completar después'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catastroDialogOpen} onOpenChange={setCatastroDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecciona el inmueble</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {catastroResults.map((result, index) => (
              <button
                key={index}
                className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors space-y-1"
                onClick={async () => {
                  setCatastroDialogOpen(false);
                  setCatastroLoading(true);
                  await applyFichaCatastral(result.rc);
                  setCatastroLoading(false);
                }}
              >
                <p className="text-xs text-muted-foreground">
                  {[result.escalera ? `Esc. ${result.escalera}` : '', result.planta ? `Planta ${result.planta}` : '', result.puerta ? `Puerta ${result.puerta}` : '', result.superficie ? `${result.superficie} m²` : '', result.uso || ''].filter(Boolean).join(' · ') || result.rc}
                </p>
                {(result.planta || result.puerta) && <p className="text-sm font-semibold">{result.escalera ? `Esc ${result.escalera} - ` : ''}Planta {result.planta || '?'}{result.puerta ? ` · Pta ${result.puerta}` : ''}</p>}
                {!(result.planta || result.puerta) && <p className="text-sm font-mono text-xs">{result.rc}</p>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
