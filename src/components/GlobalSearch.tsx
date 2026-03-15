import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Building2, Users, CheckSquare, Sparkles, Loader2 } from 'lucide-react';
import PhoneLink from '@/components/PhoneLink';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Detecta si la query debe activar IA:
// - 2+ palabras, contiene números, contiene palabras clave inmobiliarias
// - o palabra única de 5+ letras (posible nombre de lugar/urbanización como "Benidorm", "Coblanca")
const isNaturalLanguage = (q: string) => {
  const trimmed = q.trim();
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return true;
  if (/\d/.test(trimmed)) return true;
  if (/\b(en|con|sin|más|menos|por|de|hasta|desde|piso|casa|chalet|baños|habitaciones|terraza|piscina|garaje|comprador|propietario|vendido|disponible|alquiler|venta|zona|urb|urbanización)\b/i.test(trimmed)) return true;
  // Palabras únicas de 5+ letras pueden ser nombres de lugares/urbanizaciones
  if (trimmed.length >= 5) return true;
  return false;
};

const AUTO_TASK_SOURCE_LABELS: Record<string, string> = {
  closing_blocked: 'Auto cierre',
  closing_signature_pending: 'Auto firma',
  closing_deed_due: 'Auto escritura',
};

const getTaskSearchRoute = (task: { source?: string | null; property_id?: string | null; contact_id?: string | null }) => {
  if (task.property_id && ['closing_blocked', 'closing_signature_pending', 'closing_deed_due'].includes(task.source || '')) {
    return `/properties/${task.property_id}#cierre`;
  }

  if (task.contact_id) {
    return `/contacts/${task.contact_id}`;
  }

  return '/tasks';
};

const GlobalSearch = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ contacts: any[]; properties: any[]; tasks: any[] }>({ contacts: [], properties: [], tasks: [] });
  const [aiMode, setAiMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const navigate = useNavigate();
  const aiTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Búsqueda clásica (texto simple) — multi-campo en contactos y propiedades (incluye description)
  const searchClassic = useCallback(async (q: string) => {
    if (q.length < 2) { setResults({ contacts: [], properties: [], tasks: [] }); return; }
    const [c, p, t] = await Promise.all([
      supabase.from('contacts').select('id, full_name, phone, contact_type, city')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%,notes.ilike.%${q}%`)
        .limit(5),
      supabase.from('properties')
        .select('id, title, address, reference, crm_reference, city, zone, price, bedrooms, property_type, status')
        .or(`title.ilike.%${q}%,address.ilike.%${q}%,reference.ilike.%${q}%,crm_reference.ilike.%${q}%,description.ilike.%${q}%,zone.ilike.%${q}%,city.ilike.%${q}%`)
        .limit(6),
      supabase.from('tasks').select('id, title, due_date, completed, task_type, source, property_id, contact_id')
        .eq('agent_id', user?.id ?? '').eq('completed', false).ilike('title', `%${q}%`).limit(4),
    ]);
    setResults({ contacts: c.data || [], properties: p.data || [], tasks: t.data || [] });
  }, [user?.id]);

  // Búsqueda con IA
  const searchAI = useCallback(async (q: string) => {
    setAiLoading(true);
    setAiExplanation(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-search', { body: { query: q } });
      if (error) throw error;
      if (!data?.filters) { await searchClassic(q); return; }

      const { filters } = data;
      setAiExplanation(filters.explanation || null);

      const promises: Promise<any>[] = [];

      // Contactos
      if (filters.search_type !== 'properties' && filters.contact_filters) {
        const cf = filters.contact_filters;
        let qb = supabase.from('contacts').select('id, full_name, phone, contact_type, city');
        if (cf.text_query) {
          const fields = cf.text_fields?.length
            ? cf.text_fields.map((f: string) => `${f}.ilike.%${cf.text_query}%`).join(',')
            : `full_name.ilike.%${cf.text_query}%`;
          qb = qb.or(fields);
        }
        if (cf.contact_type) qb = qb.eq('contact_type', cf.contact_type);
        if (cf.city) qb = qb.ilike('city', `%${cf.city}%`);
        promises.push(qb.limit(5) as unknown as Promise<any>);
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      // Propiedades
      if (filters.search_type !== 'contacts' && filters.property_filters) {
        const pf = filters.property_filters;
        // full_text_search es el término libre de la IA (nombre de lugar/urbanización)
        const fts: string | null = filters.full_text_search || null;
        let qb = supabase.from('properties').select('id, title, address, city, zone, price, bedrooms, crm_reference, property_type, status');
        const orClauses: string[] = [];

        // Texto libre desde los campos explícitos de la IA
        // Siempre incluimos description para capturar nombres de urbanizaciones en el texto largo
        if (pf.text_query && pf.text_fields?.length) {
          pf.text_fields.forEach((f: string) => orClauses.push(`${f}.ilike.%${pf.text_query}%`));
          // Aseguramos que description siempre esté incluido aunque la IA no lo liste
          if (!pf.text_fields.includes('description')) {
            orClauses.push(`description.ilike.%${pf.text_query}%`);
          }
        } else if (pf.text_query) {
          orClauses.push(
            `title.ilike.%${pf.text_query}%`,
            `description.ilike.%${pf.text_query}%`,
            `address.ilike.%${pf.text_query}%`,
            `zone.ilike.%${pf.text_query}%`,
            `city.ilike.%${pf.text_query}%`
          );
        }

        // Si la IA devolvió full_text_search, usarlo también en description (urbanizaciones en texto largo)
        if (fts) {
          const ftsFields = ['title', 'description', 'address', 'zone', 'city'];
          ftsFields.forEach(f => {
            const clause = `${f}.ilike.%${fts}%`;
            if (!orClauses.includes(clause)) orClauses.push(clause);
          });
        }

        if (orClauses.length) qb = qb.or(orClauses.join(','));
        if (pf.city) qb = qb.ilike('city', `%${pf.city}%`);
        if (pf.zone) qb = qb.ilike('zone', `%${pf.zone}%`);
        if (pf.property_type) qb = qb.eq('property_type', pf.property_type);
        if (pf.operation) qb = qb.eq('operation', pf.operation);
        if (pf.status) qb = qb.eq('status', pf.status);
        if (pf.min_price) qb = qb.gte('price', pf.min_price);
        if (pf.max_price) qb = qb.lte('price', pf.max_price);
        if (pf.min_bedrooms) qb = qb.gte('bedrooms', pf.min_bedrooms);
        if (pf.min_surface) qb = qb.gte('surface_area', pf.min_surface);
        promises.push(qb.limit(6) as unknown as Promise<any>);
      } else {
        promises.push(Promise.resolve({ data: [] }));
      }

      const [c, p] = await Promise.all(promises);

      // Also search tasks in classic mode alongside AI
      const taskRes = await supabase.from('tasks').select('id, title, due_date, completed, task_type, source, property_id, contact_id')
        .eq('agent_id', user?.id ?? '').eq('completed', false).ilike('title', `%${q}%`).limit(4);

      setResults({ contacts: c.data || [], properties: p.data || [], tasks: taskRes.data || [] });
    } catch (err: any) {
      if (err?.message?.includes('429')) {
        toast.error('Límite de IA alcanzado. Usando búsqueda clásica.');
      }
      await searchClassic(q);
    } finally {
      setAiLoading(false);
    }
  }, [searchClassic, user?.id]);

  useEffect(() => {
    if (!open) return;
    if (aiTimeout.current) clearTimeout(aiTimeout.current);

    if (query.length < 2) {
      setResults({ contacts: [], properties: [], tasks: [] });
      setAiMode(false);
      setAiExplanation(null);
      return;
    }

    const natural = isNaturalLanguage(query);
    setAiMode(natural);

    const delay = natural ? 900 : 250;
    aiTimeout.current = setTimeout(() => {
      if (natural) searchAI(query);
      else searchClassic(query);
    }, delay);

    return () => { if (aiTimeout.current) clearTimeout(aiTimeout.current); };
  }, [query, open, searchAI, searchClassic]);

  const go = (path: string, searchQuery?: string) => {
    navigate(path, searchQuery ? { state: { fromSearch: searchQuery } } : undefined);
    setOpen(false);
    setQuery('');
    setAiExplanation(null);
  };

  const formatPrice = (p: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p);

  const taskTypeLabel: Record<string, string> = {
    llamada: '📞',
    visita: '🏠',
    email: '✉️',
    reunion: '🤝',
    nota: '📝',
  };

  const totalResults = results.contacts.length + results.properties.length + results.tasks.length;

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setQuery(''); setAiExplanation(null); setAiMode(false); } }}>
      <div className="relative">
        <CommandInput placeholder="Buscar contactos, inmuebles, tareas..." value={query} onValueChange={setQuery} />
        {aiMode && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-primary pointer-events-none">
            {aiLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
            <span>IA</span>
          </div>
        )}
      </div>

      {aiExplanation && (
        <div className="px-4 py-2 border-b flex items-center gap-2 text-xs text-muted-foreground bg-primary/5">
          <Sparkles className="h-3 w-3 text-primary shrink-0" />
          <span>{aiExplanation}</span>
        </div>
      )}

      {/* Result count badge */}
      {!aiLoading && totalResults > 0 && (
        <div className="px-4 py-1.5 border-b bg-muted/30">
          <span className="text-[11px] text-muted-foreground font-medium">
            {totalResults} resultado{totalResults !== 1 ? 's' : ''} · {results.contacts.length} contactos · {results.properties.length} inmuebles · {results.tasks.length} tareas
          </span>
        </div>
      )}

      <CommandList>
        {!aiLoading && <CommandEmpty>No se encontraron resultados.</CommandEmpty>}
        {aiLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Analizando con IA...
          </div>
        )}

        {/* Contactos */}
        {!aiLoading && results.contacts.length > 0 && (
          <CommandGroup heading={`Contactos (${results.contacts.length})`}>
            {results.contacts.map(c => (
              <CommandItem key={c.id} onSelect={() => go(`/contacts/${c.id}`, query)}>
                <Users className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium">{c.full_name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {c.contact_type && <span className="capitalize">{c.contact_type.replace('_', ' ')}</span>}
                    {c.city && <span>· {c.city}</span>}
                  </div>
                </div>
                {c.phone && (
                  <span className="ml-auto shrink-0">
                    <PhoneLink phone={c.phone} contactId={c.id} contactName={c.full_name} />
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Inmuebles */}
        {!aiLoading && results.properties.length > 0 && (
          <CommandGroup heading={`Inmuebles (${results.properties.length})`}>
            {results.properties.map(p => (
              <CommandItem key={p.id} onSelect={() => go(`/properties/${p.id}`, query)}>
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium truncate">{p.title}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {p.city && <span>{p.city}</span>}
                    {p.bedrooms ? <span>· {p.bedrooms} hab.</span> : null}
                    {p.price ? <span className="text-primary font-medium">· {formatPrice(p.price)}</span> : null}
                  </div>
                </div>
                {p.crm_reference && (
                  <span className="ml-2 text-xs font-mono font-bold text-primary shrink-0">{p.crm_reference}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Tareas */}
        {!aiLoading && results.tasks.length > 0 && (
          <CommandGroup heading={`Tareas pendientes (${results.tasks.length})`}>
            {results.tasks.map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date();
              const sourceLabel = t.source ? AUTO_TASK_SOURCE_LABELS[t.source] : null;
              return (
                <CommandItem key={t.id} onSelect={() => go(getTaskSearchRoute(t))}>
                  <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium truncate">
                      {taskTypeLabel[t.task_type] ?? '📋'} {t.title}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      {t.due_date && (
                        <span className={isOverdue ? 'text-destructive' : 'text-muted-foreground'}>
                          {isOverdue ? 'Vencida' : 'Vence'} {new Date(t.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                      {sourceLabel && (
                        <span className="text-primary">
                          · {sourceLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;
