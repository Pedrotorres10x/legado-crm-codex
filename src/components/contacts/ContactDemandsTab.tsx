import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import type { Database } from '@/integrations/supabase/types';
import { DollarSign, MapPin, Pencil, Plus, Power, Search as SearchIcon, Trash2, Zap } from 'lucide-react';

type DemandRow = Database['public']['Tables']['demands']['Row'];

type Props = {
  demands: DemandRow[];
  onOpenNewDemand: () => void;
  onEditDemand: (demand: DemandRow) => void;
  onToggleDemandActive: (demandId: string, isActive: boolean) => void;
  onDeleteDemand: (demandId: string) => void;
  onToggleAutoMatch: (demandId: string, checked: boolean) => void;
};

export default function ContactDemandsTab({
  demands,
  onOpenNewDemand,
  onEditDemand,
  onToggleDemandActive,
  onDeleteDemand,
  onToggleAutoMatch,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={onOpenNewDemand}><Plus className="h-4 w-4 mr-1" />Nueva Demanda</Button>
      </div>
      {demands.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <SearchIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No hay demandas. Registra lo que busca este contacto.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {demands.map((demand) => (
            <Card key={demand.id} className={`border-0 shadow-card ${!demand.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2 text-sm">
                    {demand.property_type && <Badge variant="outline">{demand.property_type}</Badge>}
                    <Badge variant="outline">{demand.operation}</Badge>
                  </div>
                  <Badge variant={demand.is_active ? 'default' : 'secondary'}>{demand.is_active ? 'Activa' : 'Inactiva'}</Badge>
                </div>
                {((demand.cities && demand.cities.length > 0) || (demand.zones && demand.zones.length > 0)) && (
                  <div className="flex flex-wrap gap-1.5">
                    {(demand.cities || []).map((city, index) => (
                      <Badge key={`city-${index}`} variant="secondary" className="text-xs gap-1"><MapPin className="h-3 w-3" />{city}</Badge>
                    ))}
                    {(demand.zones || []).map((zone, index) => (
                      <Badge key={`zone-${index}`} variant="outline" className="text-xs">{zone}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm font-medium">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  {(demand.min_price || demand.max_price)
                    ? <span>{demand.min_price ? `${Number(demand.min_price).toLocaleString('es-ES')}€` : '?'} - {demand.max_price ? `${Number(demand.max_price).toLocaleString('es-ES')}€` : '?'}</span>
                    : <span className="text-muted-foreground italic">Sin presupuesto definido</span>
                  }
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {demand.min_surface && <p>Sup. mín: {demand.min_surface}m²</p>}
                  {demand.min_bedrooms && <p>Hab. mín: {demand.min_bedrooms}</p>}
                </div>
                {demand.notes && <p className="text-sm text-muted-foreground italic line-clamp-2">{demand.notes}</p>}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEditDemand(demand)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onToggleDemandActive(demand.id, demand.is_active)}><Power className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => onDeleteDemand(demand.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className={`h-3 w-3 ${demand.auto_match !== false ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-[10px] text-muted-foreground">Cruce</span>
                    <Switch checked={demand.auto_match !== false} onCheckedChange={(checked) => onToggleAutoMatch(demand.id, checked)} className="scale-[0.6]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
