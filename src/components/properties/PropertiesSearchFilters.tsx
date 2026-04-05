import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PropertyFilters, type PropertyFiltersState } from '@/components/properties/PropertyFilters';

type PropertiesSearchFiltersProps = {
  isMobile: boolean;
  searchText: string;
  setSearchText: (value: string) => void;
  filters: PropertyFiltersState;
  onFiltersChange: (patch: Partial<PropertyFiltersState>) => void;
  availableCities: string[];
  availableCountries: string[];
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  cityPopoverOpen: boolean;
  onCityPopoverChange: (value: boolean) => void;
};

export default function PropertiesSearchFilters({
  isMobile,
  searchText,
  setSearchText,
  filters,
  onFiltersChange,
  availableCities,
  availableCountries,
  showAdvanced,
  onToggleAdvanced,
  cityPopoverOpen,
  onCityPopoverChange,
}: PropertiesSearchFiltersProps) {
  return (
    <>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
      </div>

      {!isMobile && (
        <PropertyFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          availableCities={availableCities}
          availableCountries={availableCountries}
          showAdvanced={showAdvanced}
          onToggleAdvanced={onToggleAdvanced}
          cityPopoverOpen={cityPopoverOpen}
          onCityPopoverChange={onCityPopoverChange}
        />
      )}
    </>
  );
}
