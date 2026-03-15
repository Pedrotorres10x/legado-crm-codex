import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, ExternalLink } from 'lucide-react';

interface Props {
  buyerId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onNavigate: (id: string) => void;
}

export default function ArrasBuyerField({ buyerId, onSelect, onClear, onNavigate }: Props) {
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    if (!buyerId) { setBuyerName(null); return; }
    supabase.from('contacts').select('full_name').eq('id', buyerId).single()
      .then(({ data }) => setBuyerName(data?.full_name || 'Contacto'));
  }, [buyerId]);

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await supabase.from('contacts').select('id, full_name')
      .ilike('full_name', `%${q}%`).limit(10);
    setResults(data || []);
  };

  if (buyerId) {
    return (
      <div>
        <Label className="text-xs text-muted-foreground">Comprador (contacto)</Label>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">{buyerName || 'Contacto'}</Badge>
          <Button size="sm" variant="ghost" className="h-6 px-1" onClick={onClear}><X className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => onNavigate(buyerId)}><ExternalLink className="h-3 w-3" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-xs text-muted-foreground">Comprador (contacto)</Label>
      <Input
        className="mt-1"
        placeholder="Buscar contacto por nombre..."
        value={search}
        onChange={e => handleSearch(e.target.value)}
      />
      {results.length > 0 && (
        <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-popover">
          {results.map(c => (
            <button key={c.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors" onClick={() => { onSelect(c.id); setSearch(''); setResults([]); }}>
              {c.full_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
