import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PropertyCard, PropertyListView } from './PropertyCard';
import type { HealthInfo } from '@/hooks/useHealthColors';

type PropertyListItem = {
  id: string;
  [key: string]: unknown;
};

interface PropertyListProps {
  properties: PropertyListItem[];
  healthColors: Record<string, HealthInfo | undefined>;
  viewMode: 'grid' | 'list' | 'mobile';
  currentPage: number;
  totalCount: number;
  itemsPerPage: number;
  /** When true, the parent already sliced data via .range(); we render all items as-is */
  serverPaginated: boolean;
  onPageChange: (page: number) => void;
  onRemoved?: () => void;
}

export const PropertyList = ({
  properties, healthColors, viewMode,
  currentPage, totalCount, itemsPerPage, serverPaginated,
  onPageChange, onRemoved,
}: PropertyListProps) => {
  // For server-paginated tabs, parent sends exactly 1 page of data.
  // For client-paginated tabs (for example, internacional), we slice here.
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const paginated = serverPaginated
    ? properties
    : properties.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (totalCount === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay inmuebles. Añade tu primera propiedad.</p>
        </CardContent>
      </Card>
    );
  }

  const showFrom = (currentPage - 1) * itemsPerPage + 1;
  const showTo = Math.min(currentPage * itemsPerPage, totalCount);

  return (
    <>
      {viewMode === 'mobile' && (
        <div className="space-y-2">
          {paginated.map(p => (
            <PropertyCard key={p.id} property={p} healthInfo={healthColors[p.id]} mode="mobile" onRemoved={onRemoved} />
          ))}
        </div>
      )}

      {viewMode === 'grid' && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginated.map(p => (
            <PropertyCard key={p.id} property={p} healthInfo={healthColors[p.id]} mode="grid" onRemoved={onRemoved} />
          ))}
        </div>
      )}

      {viewMode === 'list' && (
        <PropertyListView properties={paginated} healthColors={healthColors} onRemoved={onRemoved} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {showFrom}–{showTo} de {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const page = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
              return (
                <Button key={page} variant={currentPage === page ? 'default' : 'outline'} size="icon"
                  onClick={() => onPageChange(page)} className="w-9 h-9 text-xs">{page}</Button>
              );
            })}
            <Button variant="outline" size="icon" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};
