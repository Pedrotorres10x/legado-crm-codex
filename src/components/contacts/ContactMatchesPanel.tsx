import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getCoverImage } from '@/lib/get-cover-image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type MatchLike = {
  id: string;
  property_id?: string | null;
  compatibility?: number | null;
  status: string;
  created_at: string;
  notes?: string | null;
  properties?: {
    id?: string | null;
    title?: string | null;
    address?: string | null;
    price?: number | null;
    images?: string[] | null;
    image_order?: string[] | null;
  } | null;
};

type Props = {
  matches: MatchLike[];
  onOpenProperty: (propertyId: string) => void;
  onStatusChange: (matchId: string, status: string) => Promise<void>;
};

export default function ContactMatchesPanel({ matches, onOpenProperty, onStatusChange }: Props) {
  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hay cruces registrados. Los cruces aparecen cuando las demandas del contacto coinciden con propiedades.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Propiedad</TableHead>
            <TableHead>Compatibilidad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Notas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((match) => (
            <TableRow
              key={match.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => match.property_id && onOpenProperty(match.property_id)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  {getCoverImage(match.properties?.images, match.properties?.image_order, match.property_id) && (
                    <img
                      src={getCoverImage(match.properties?.images, match.properties?.image_order, match.property_id)!}
                      alt=""
                      className="h-10 w-10 rounded object-cover shrink-0"
                    />
                  )}
                  <div>
                    <p className="truncate max-w-[200px]">{match.properties?.title || 'Propiedad'}</p>
                    {match.properties?.address && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{match.properties.address}</p>}
                    {match.properties?.price && <p className="text-xs font-semibold">{Number(match.properties.price).toLocaleString('es-ES')} €</p>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono">{match.compatibility || 0}%</Badge>
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <Select value={match.status} onValueChange={(value) => void onStatusChange(match.id, value)}>
                  <SelectTrigger className="h-8 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="interesado">Interesado</SelectItem>
                    <SelectItem value="descartado">Descartado</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>{format(new Date(match.created_at), 'dd MMM yyyy', { locale: es })}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{match.notes || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
