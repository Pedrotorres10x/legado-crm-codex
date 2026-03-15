import AddToGoogleCalendarButton from '@/components/AddToGoogleCalendarButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarClock, CheckCircle, Home, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type VisitLike = {
  id: string;
  property_id?: string | null;
  visit_date: string;
  confirmation_status: string;
  notes?: string | null;
  properties?: {
    title?: string | null;
    address?: string | null;
  } | null;
};

const visitStatusBadge = (status: string) => {
  if (status === 'confirmado') {
    return <Badge className="bg-green-600 text-white border-0"><CheckCircle className="h-3 w-3 mr-1" />Confirmado</Badge>;
  }
  if (status === 'cancelado') {
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
  }
  if (status === 'reprogramado') {
    return <Badge className="bg-orange-500 text-white border-0"><CalendarClock className="h-3 w-3 mr-1" />Reprogramado</Badge>;
  }
  return <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
};

type Props = {
  visits: VisitLike[];
  contactName?: string | null;
  onOpenProperty: (propertyId: string) => void;
};

export default function ContactVisitsPanel({ visits, contactName, onOpenProperty }: Props) {
  if (visits.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hay visitas registradas.
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
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Notas</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((visit) => (
            <TableRow
              key={visit.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => visit.property_id && onOpenProperty(visit.property_id)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  {visit.properties?.title || 'Propiedad'}
                </div>
              </TableCell>
              <TableCell>{format(new Date(visit.visit_date), 'dd MMM yyyy HH:mm', { locale: es })}</TableCell>
              <TableCell>{visitStatusBadge(visit.confirmation_status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{visit.notes || '-'}</TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <AddToGoogleCalendarButton
                  visitDate={visit.visit_date}
                  propertyTitle={visit.properties?.title}
                  contactName={contactName || undefined}
                  propertyAddress={visit.properties?.address}
                  notes={visit.notes || undefined}
                  size="sm"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
