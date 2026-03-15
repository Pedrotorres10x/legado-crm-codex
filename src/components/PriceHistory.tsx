import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, History } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PriceChange {
  id: string;
  old_price: number | null;
  new_price: number | null;
  old_owner_price: number | null;
  new_owner_price: number | null;
  changed_at: string;
  changed_by: string | null;
}

const fmt = (v: number | null) =>
  v != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '—';

const PriceHistory = ({ propertyId }: { propertyId: string }) => {
  const [history, setHistory] = useState<PriceChange[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('price_history')
        .select('*')
        .eq('property_id', propertyId)
        .order('changed_at', { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        setHistory(data);
        // Fetch profile names
        const userIds = [...new Set(data.map(d => d.changed_by).filter(Boolean))] as string[];
        if (userIds.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
          const map: Record<string, string> = {};
          profs?.forEach(p => { map[p.user_id] = p.full_name; });
          setProfiles(map);
        }
      }
    };
    fetch();
  }, [propertyId]);

  if (history.length === 0) return null;

  return (
    <div className="space-y-2 mt-4 pt-4 border-t">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" />Histórico de precios
      </p>
      <div className="space-y-1.5">
        {history.map(h => {
          const priceChanged = h.old_price !== h.new_price;
          const ownerChanged = h.old_owner_price !== h.new_owner_price;
          const priceDiff = (h.new_price ?? 0) - (h.old_price ?? 0);
          const Icon = priceDiff > 0 ? TrendingUp : priceDiff < 0 ? TrendingDown : Minus;
          const diffColor = priceDiff > 0 ? 'text-destructive' : priceDiff < 0 ? 'text-success' : 'text-muted-foreground';

          return (
            <div key={h.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-md bg-muted/30">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${diffColor}`} />
              <span className="text-muted-foreground shrink-0">
                {format(new Date(h.changed_at), 'dd MMM yyyy HH:mm', { locale: es })}
              </span>
              {priceChanged && (
                <span>
                  <span className="text-muted-foreground line-through">{fmt(h.old_price)}</span>
                  {' → '}
                  <span className="font-semibold">{fmt(h.new_price)}</span>
                </span>
              )}
              {ownerChanged && !priceChanged && (
                <span>
                  Propietario: <span className="line-through text-muted-foreground">{fmt(h.old_owner_price)}</span>
                  {' → '}<span className="font-semibold">{fmt(h.new_owner_price)}</span>
                </span>
              )}
              {ownerChanged && priceChanged && (
                <Badge variant="outline" className="text-[10px] py-0">
                  Prop: {fmt(h.old_owner_price)} → {fmt(h.new_owner_price)}
                </Badge>
              )}
              {priceDiff !== 0 && (
                <Badge variant={priceDiff < 0 ? 'secondary' : 'outline'} className={`text-[10px] py-0 ${diffColor}`}>
                  {priceDiff > 0 ? '+' : ''}{fmt(priceDiff)}
                </Badge>
              )}
              {h.changed_by && profiles[h.changed_by] && (
                <span className="text-muted-foreground ml-auto">{profiles[h.changed_by]}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PriceHistory;
