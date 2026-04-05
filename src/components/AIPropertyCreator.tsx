import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Check, X, BedDouble, Bath, Maximize, Euro, MapPin, Building2, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface ExtractedData {
  title?: string;
  property_type?: string;
  operation?: string;
  price?: number;
  surface_area?: number;
  built_area?: number;
  bedrooms?: number;
  bathrooms?: number;
  city?: string;
  province?: string;
  address?: string;
  zip_code?: string;
  floor?: string;
  energy_cert?: string;
  description?: string;
  status?: string;
  has_elevator?: boolean;
  has_garage?: boolean;
  has_pool?: boolean;
  has_terrace?: boolean;
  has_garden?: boolean;
  features?: string[];
  missing_fields?: string[];
  follow_up_message?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
type PropertyType = Database['public']['Enums']['property_type'];
type OperationType = Database['public']['Enums']['operation_type'];
type PropertyStatus = Database['public']['Enums']['property_status'];

const fieldLabels: Record<string, string> = {
  title: 'Título', property_type: 'Tipo', operation: 'Operación', price: 'Precio',
  surface_area: 'Superficie útil', built_area: 'Sup. construida', bedrooms: 'Habitaciones',
  bathrooms: 'Baños', city: 'Ciudad', province: 'Provincia', address: 'Dirección',
  zip_code: 'C.P.', floor: 'Planta', energy_cert: 'Cert. energético', status: 'Estado',
};

const boolLabels: Record<string, string> = {
  has_elevator: 'Ascensor', has_garage: 'Garaje', has_pool: 'Piscina',
  has_terrace: 'Terraza', has_garden: 'Jardín',
};

interface Props {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

const AIPropertyCreator = ({ onCreated, onCancel }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-property-extract', {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          current_data: extracted,
        },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); setLoading(false); return; }

      const ext = data.extracted as ExtractedData;
      // Merge with existing data (keep old values if new ones are undefined)
      if (extracted) {
        const merged: ExtractedData = { ...extracted };
        for (const [k, v] of Object.entries(ext)) {
          if (v !== undefined && v !== null && v !== '') {
            merged[k as keyof ExtractedData] = v as never;
          }
        }
        setExtracted(merged);
      } else {
        setExtracted(ext);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: ext.follow_up_message || 'Datos extraídos correctamente.' }]);
    } catch (err) {
      console.error(err);
      toast.error('Error al procesar con IA');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSave = async () => {
    if (!extracted?.title) { toast.error('Se necesita al menos un título'); return; }
    setSaving(true);

    const { missing_fields, follow_up_message, features, ...rest } = extracted;
    const payload: PropertyInsert = {
      title: rest.title!,
      property_type: (rest.property_type || 'otro') as PropertyType,
      operation: (rest.operation || 'venta') as OperationType,
      status: (rest.status || 'disponible') as PropertyStatus,
      price: rest.price || null,
      surface_area: rest.surface_area || null,
      built_area: rest.built_area || null,
      bedrooms: rest.bedrooms || 0,
      bathrooms: rest.bathrooms || 0,
      city: rest.city || null,
      province: rest.province || null,
      address: rest.address || null,
      zip_code: rest.zip_code || null,
      floor: rest.floor || null,
      energy_cert: rest.energy_cert || null,
      description: rest.description || null,
      has_elevator: rest.has_elevator || false,
      has_garage: rest.has_garage || false,
      has_pool: rest.has_pool || false,
      has_terrace: rest.has_terrace || false,
      has_garden: rest.has_garden || false,
      features: features || [],
      agent_id: user?.id,
    };

    const { data: propertyData, error } = await supabase.from('properties').insert([payload]).select('id').single();

    setSaving(false);
    if (error || !propertyData) { toast.error('Error al guardar: ' + (error?.message || 'Sin datos')); return; }
    toast.success('Inmueble creado con IA ✨');
    onCreated(propertyData.id);
  };

  const formatValue = (key: string, val: string | number | boolean | null | undefined): string => {
    if (key === 'price') return val ? `${Number(val).toLocaleString('es-ES')} €` : '-';
    if (key === 'surface_area' || key === 'built_area') return val ? `${val} m²` : '-';
    return String(val ?? '-');
  };

  return (
    <div className="flex flex-col h-[70vh]">
      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-lg">Crear inmueble con IA</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Descríbeme el inmueble en lenguaje natural. Puedo extraer tipo, precio, ubicación, características... 
              Te iré pidiendo lo que falte.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {[
                'Piso de 3 hab en Águilas, 120m², 185.000€, con garaje y trastero',
                'Chalet adosado en Lorca, 4 dormitorios, piscina comunitaria, 250.000€',
                'Local comercial 80m² en centro de Murcia, alquiler 900€/mes',
              ].map((ex, i) => (
                <button key={i} className="text-xs text-left px-3 py-2 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors max-w-[280px]"
                  onClick={() => { setInput(ex); inputRef.current?.focus(); }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              {m.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Extracted data preview */}
      {extracted && (
        <div className="border-t bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />Datos extraídos
            </p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4 mr-1" />Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Guardar inmueble
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {extracted.title && !editingTitle && (
              <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted" onClick={() => setEditingTitle(true)}>
                <Building2 className="h-3 w-3" />{extracted.title}<Edit className="h-3 w-3 ml-1 opacity-50" />
              </Badge>
            )}
            {editingTitle && (
              <Input
                className="h-7 w-64 text-xs"
                value={extracted.title || ''}
                onChange={e => setExtracted(prev => prev ? { ...prev, title: e.target.value } : prev)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
                autoFocus
              />
            )}
            {extracted.property_type && <Badge variant="secondary">{extracted.property_type}</Badge>}
            {extracted.operation && <Badge variant="secondary">{extracted.operation}</Badge>}
            {extracted.price && <Badge variant="outline" className="gap-1"><Euro className="h-3 w-3" />{Number(extracted.price).toLocaleString('es-ES')} €</Badge>}
            {extracted.city && <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" />{extracted.city}</Badge>}
            {extracted.bedrooms != null && extracted.bedrooms > 0 && <Badge variant="outline" className="gap-1"><BedDouble className="h-3 w-3" />{extracted.bedrooms} hab</Badge>}
            {extracted.bathrooms != null && extracted.bathrooms > 0 && <Badge variant="outline" className="gap-1"><Bath className="h-3 w-3" />{extracted.bathrooms} baños</Badge>}
            {extracted.surface_area && <Badge variant="outline" className="gap-1"><Maximize className="h-3 w-3" />{extracted.surface_area} m²</Badge>}
            {Object.entries(boolLabels).map(([k, label]) => {
              const key = k as keyof Pick<
                ExtractedData,
                'has_elevator' | 'has_garage' | 'has_pool' | 'has_terrace' | 'has_garden'
              >;
              return extracted[key] ? <Badge key={k} variant="secondary" className="text-xs">{label}</Badge> : null;
            })}
            {extracted.features?.map((f, i) => <Badge key={i} variant="outline" className="text-xs">{f}</Badge>)}
          </div>
          {extracted.missing_fields && extracted.missing_fields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Faltan: {extracted.missing_fields.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Describe el inmueble..."
          disabled={loading}
          autoFocus
        />
        <Button onClick={sendMessage} disabled={!input.trim() || loading} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default AIPropertyCreator;
