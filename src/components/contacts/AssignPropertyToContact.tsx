import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Building, Loader2, Plus, Search as SearchIcon, XCircle } from 'lucide-react';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';

type Props = {
  contactId: string;
  contactName: string;
  contactType: string;
  onAssigned: () => void;
};

type PropertySearchResult = Pick<
  Tables<'properties'>,
  'id' | 'title' | 'address' | 'price' | 'status' | 'reference'
>;

export default function AssignPropertyToContact({ contactId, contactName, contactType, onAssigned }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PropertySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [open, setOpen] = useState(false);

  const search = async (value: string) => {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('properties')
      .select('id, title, address, price, status, reference')
      .or(`title.ilike.%${value}%,address.ilike.%${value}%,reference.ilike.%${value}%`)
      .limit(10);
    setResults(data || []);
    setSearching(false);
  };

  const assign = async (propertyId: string, propertyTitle: string) => {
    setAssigning(true);
    const propertyPayload: TablesUpdate<'properties'> = { owner_id: contactId };
    const { error: propertyError } = await supabase.from('properties').update(propertyPayload).eq('id', propertyId);
    if (propertyError) {
      toast({ title: 'Error', description: propertyError.message, variant: 'destructive' });
      setAssigning(false);
      return;
    }

    if (!['propietario', 'prospecto', 'ambos', 'vendedor_cerrado'].includes(contactType)) {
      const contactPayload: TablesUpdate<'contacts'> = { contact_type: 'prospecto' };
      await supabase.from('contacts').update(contactPayload).eq('id', contactId);
    }

    toast({ title: '✅ Inmueble asignado', description: `${propertyTitle} vinculado a ${contactName}. Si todavía no ha firmado, debe seguir como prospecto.` });
    setOpen(false);
    setQuery('');
    setResults([]);
    setAssigning(false);
    onAssigned();
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Asignar inmueble
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            Asignar inmueble al dueño
          </h4>
          <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setQuery(''); setResults([]); }}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por titulo, direccion o referencia..."
            value={query}
            onChange={(event) => search(event.target.value)}
            autoFocus
          />
        </div>
        {searching && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {results.length > 0 && (
          <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
            {results.map((property) => (
              <button
                key={property.id}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 disabled:opacity-50"
                onClick={() => assign(property.id, property.title)}
                disabled={assigning}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{property.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {property.address || 'Sin direccion'} {property.reference ? `· Ref: ${property.reference}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {property.price && <span className="text-xs font-medium">{Number(property.price).toLocaleString('es-ES')} €</span>}
                  <Badge variant="outline" className="text-[10px]">{property.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
        {query.length >= 2 && !searching && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Sin resultados para "{query}"</p>
        )}
      </CardContent>
    </Card>
  );
}
