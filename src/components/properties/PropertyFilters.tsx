import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, SlidersHorizontal, X, ArrowUpDown, Check } from 'lucide-react';
import { statusLabels } from './property-card-config';
import { propertyTypes } from './property-filters-config';

export interface PropertyFiltersState {
  filterType: string;
  filterStatus: string;
  filterOperation: string;
  filterLegalRisk: string;
  filterCohort: string;
  priceMin: string;
  priceMax: string;
  surfaceMin: string;
  bedroomsMin: string;
  filterMandate: string;
  sortBy: string;
  filterCity: string;
  filterCountry: string;
}

interface PropertyFiltersProps {
  filters: PropertyFiltersState;
  onFiltersChange: (patch: Partial<PropertyFiltersState>) => void;
  availableCities: string[];
  availableCountries: string[];
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  cityPopoverOpen: boolean;
  onCityPopoverChange: (open: boolean) => void;
}

export const PropertyFilters = ({
  filters,
  onFiltersChange,
  availableCities,
  availableCountries,
  showAdvanced,
  onToggleAdvanced,
  cityPopoverOpen,
  onCityPopoverChange,
}: PropertyFiltersProps) => {
  const { filterType, filterStatus, filterOperation, filterCohort, priceMin, priceMax, surfaceMin, bedroomsMin, filterMandate, sortBy, filterCity, filterCountry } = filters;
  const { filterLegalRisk } = filters;

  const activeFilterCount = useMemo(() =>
    [
      filterOperation !== 'all',
      filterLegalRisk !== 'all',
      filterCohort !== 'all',
      priceMin,
      priceMax,
      surfaceMin,
      bedroomsMin !== 'any',
      filterCity,
      filterCountry,
      filterMandate !== 'all',
    ].filter(Boolean).length,
    [filterOperation, filterLegalRisk, filterCohort, priceMin, priceMax, surfaceMin, bedroomsMin, filterCity, filterCountry, filterMandate]
  );

  const clearAdvancedFilters = () => {
    onFiltersChange({
      filterOperation: 'all', priceMin: '', priceMax: '',
      surfaceMin: '', bedroomsMin: '', filterCity: '', filterCountry: '', filterMandate: 'all', filterLegalRisk: 'all', filterCohort: 'all',
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Select value={filterType} onValueChange={v => onFiltersChange({ filterType: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {propertyTypes.map(t => (
              <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={v => onFiltersChange({ filterStatus: v })}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={v => onFiltersChange({ sortBy: v })}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="h-3.5 w-3.5 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="oldest">Más antiguos</SelectItem>
            <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
            <SelectItem value="surface_desc">Superficie: mayor</SelectItem>
            <SelectItem value="surface_asc">Superficie: menor</SelectItem>
          </SelectContent>
        </Select>

        <Button variant={showAdvanced ? 'secondary' : 'outline'} onClick={onToggleAdvanced} className="relative">
          <SlidersHorizontal className="h-4 w-4 mr-2" />Filtros
          {activeFilterCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        <Button
          variant={filterCohort === 'kyero_alicante_50' ? 'secondary' : 'outline'}
          onClick={() => onFiltersChange({ filterCohort: filterCohort === 'kyero_alicante_50' ? 'all' : 'kyero_alicante_50' })}
        >
          Muestra Alicante 50
        </Button>
      </div>

      {showAdvanced && (
        <Card className="animate-fade-in-up">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Filtros avanzados</p>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAdvancedFilters} className="text-xs h-7">
                  <X className="h-3 w-3 mr-1" />Limpiar filtros
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Ciudad */}
              <div className="space-y-1">
                <Label className="text-xs">Ciudad</Label>
                <Popover open={cityPopoverOpen} onOpenChange={onCityPopoverChange}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full h-9 justify-between text-sm font-normal">
                      {filterCity || 'Todas'}
                      <MapPin className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar ciudad..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>Sin resultados</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => { onFiltersChange({ filterCity: '' }); onCityPopoverChange(false); }}>
                            <Check className={`mr-2 h-3.5 w-3.5 ${!filterCity ? 'opacity-100' : 'opacity-0'}`} />
                            Todas
                          </CommandItem>
                          {availableCities.map(city => (
                            <CommandItem key={city} onSelect={() => { onFiltersChange({ filterCity: city }); onCityPopoverChange(false); }}>
                              <Check className={`mr-2 h-3.5 w-3.5 ${filterCity === city ? 'opacity-100' : 'opacity-0'}`} />
                              {city}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* País */}
              <div className="space-y-1">
                <Label className="text-xs">País</Label>
                <Select value={filterCountry || 'all'} onValueChange={v => onFiltersChange({ filterCountry: v === 'all' ? '' : v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {availableCountries.map(country => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operación */}
              <div className="space-y-1">
                <Label className="text-xs">Operación</Label>
                <Select value={filterOperation} onValueChange={v => onFiltersChange({ filterOperation: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="alquiler">Alquiler</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Riesgo legal</Label>
                <Select value={filterLegalRisk} onValueChange={v => onFiltersChange({ filterLegalRisk: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="medio">Medio</SelectItem>
                    <SelectItem value="bajo">Bajo</SelectItem>
                    <SelectItem value="sin_datos">Sin análisis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Precio */}
              <div className="space-y-1">
                <Label className="text-xs">Precio mín. (€)</Label>
                <Input type="number" placeholder="0" value={priceMin} onChange={e => onFiltersChange({ priceMin: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Precio máx. (€)</Label>
                <Input type="number" placeholder="∞" value={priceMax} onChange={e => onFiltersChange({ priceMax: e.target.value })} className="h-9" />
              </div>

              {/* Superficie */}
              <div className="space-y-1">
                <Label className="text-xs">Superficie mín. (m²)</Label>
                <Input type="number" placeholder="0" value={surfaceMin} onChange={e => onFiltersChange({ surfaceMin: e.target.value })} className="h-9" />
              </div>

              {/* Habitaciones */}
              <div className="space-y-1">
                <Label className="text-xs">Habitaciones mín.</Label>
                <Select value={bedroomsMin} onValueChange={v => onFiltersChange({ bedroomsMin: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Todas</SelectItem>
                    {['1','2','3','4','5'].map(n => <SelectItem key={n} value={n}>{n}+</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Mandato */}
              <div className="space-y-1">
                <Label className="text-xs">Mandato</Label>
                <Select value={filterMandate} onValueChange={v => onFiltersChange({ filterMandate: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Vigente</SelectItem>
                    <SelectItem value="expired">Caducado</SelectItem>
                    <SelectItem value="no_mandate">Sin mandato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};
