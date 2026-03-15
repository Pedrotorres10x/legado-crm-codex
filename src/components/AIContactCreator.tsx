import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Check, X, Phone, Mail, MapPin, Users, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface ExtractedContact {
  full_name?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  city?: string;
  address?: string;
  contact_type?: string;
  notes?: string;
  tags?: string[];
  pipeline_stage?: string;
  missing_fields?: string[];
  follow_up_message?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const typeLabels: Record<string, string> = { propietario: 'Propietario (cliente)', comprador: 'Comprador', comprador_cerrado: 'Comprador (cerrado)', vendedor_cerrado: 'Vendedor (cerrado)', ambos: 'Ambos', prospecto: 'Prospecto (dueño sin firmar)', statefox: 'Statefox', contacto: 'Contacto' };

interface Props {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

const AIContactCreator = ({ onCreated, onCancel }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedContact | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-contact-extract', {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          current_data: extracted,
        },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); setLoading(false); return; }

      const ext = data.extracted as ExtractedContact;
      if (extracted) {
        const merged: any = { ...extracted };
        for (const [k, v] of Object.entries(ext)) {
          if (v !== undefined && v !== null && v !== '') merged[k] = v;
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
    if (!extracted?.full_name) { toast.error('Se necesita al menos un nombre'); return; }
    setSaving(true);

    const defaultStage = extracted.contact_type === 'comprador' ? 'nuevo' : extracted.contact_type === 'propietario' ? 'captado' : 'prospecto';

    const { data: contactData, error } = await supabase.from('contacts').insert([{
      full_name: extracted.full_name,
      email: extracted.email || null,
      phone: extracted.phone || null,
      phone2: extracted.phone2 || null,
      city: extracted.city || null,
      address: extracted.address || null,
      contact_type: (extracted.contact_type || 'prospecto') as any,
      notes: extracted.notes || null,
      tags: extracted.tags || [],
      pipeline_stage: (extracted.pipeline_stage || defaultStage) as any,
      agent_id: user?.id,
    }]).select('id').single();

    setSaving(false);
    if (error || !contactData) { toast.error('Error al guardar: ' + (error?.message || 'Sin datos')); return; }
    toast.success('Contacto creado con IA ✨');
    onCreated(contactData.id);
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
            <h3 className="font-display font-semibold text-lg">Crear contacto con IA</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Descríbeme al contacto: quién es, qué busca, datos de contacto... Yo extraigo todo automáticamente.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {[
                'María García, busca piso en Águilas de 2-3 hab, presupuesto 150-200k, tel 666123456',
                'Juan López quiere vender su chalet en Lorca, contacto juanl@email.com, 600111222',
                'Pareja inglesa, inversores, buscan apartamentos en la costa, email smith@gmail.com',
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
              m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
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
              <Users className="h-3.5 w-3.5" />Datos extraídos
            </p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4 mr-1" />Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Guardar contacto
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {extracted.full_name && <Badge variant="outline" className="gap-1"><Users className="h-3 w-3" />{extracted.full_name}</Badge>}
            {extracted.contact_type && <Badge variant="secondary">{typeLabels[extracted.contact_type] || extracted.contact_type}</Badge>}
            {extracted.phone && <Badge variant="outline" className="gap-1"><Phone className="h-3 w-3" />{extracted.phone}</Badge>}
            {extracted.email && <Badge variant="outline" className="gap-1"><Mail className="h-3 w-3" />{extracted.email}</Badge>}
            {extracted.city && <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" />{extracted.city}</Badge>}
            {extracted.pipeline_stage && <Badge variant="secondary">{extracted.pipeline_stage}</Badge>}
            {extracted.tags?.map((t, i) => <Badge key={i} variant="outline" className="text-xs gap-1"><Tag className="h-3 w-3" />{t}</Badge>)}
          </div>
          {extracted.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">📝 {extracted.notes}</p>
          )}
          {extracted.missing_fields && extracted.missing_fields.length > 0 && (
            <p className="text-xs text-muted-foreground">Faltan: {extracted.missing_fields.join(', ')}</p>
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
          placeholder="Describe al contacto..."
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

export default AIContactCreator;
