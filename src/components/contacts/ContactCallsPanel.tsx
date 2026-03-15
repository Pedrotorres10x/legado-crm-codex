import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type InteractionLike = {
  id: string;
  interaction_type: string;
  interaction_date: string;
  subject?: string | null;
  description?: string | null;
};

type Props = {
  interactions: InteractionLike[];
  callFilter: string;
  onCallFilterChange: (value: string) => void;
};

export default function ContactCallsPanel({ interactions, callFilter, onCallFilterChange }: Props) {
  const calls = interactions
    .filter((interaction) => interaction.interaction_type === 'llamada')
    .filter((interaction) => callFilter === 'all' || interaction.subject === callFilter);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Historial de llamadas</p>
          <Select value={callFilter} onValueChange={onCallFilterChange}>
            <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los resultados</SelectItem>
              <SelectItem value="Conectada">Conectada</SelectItem>
              <SelectItem value="No contesta">No contesta</SelectItem>
              <SelectItem value="Buzón de voz">Buzón de voz</SelectItem>
              <SelectItem value="Ocupado">Ocupado</SelectItem>
              <SelectItem value="Equivocado">Equivocado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {calls.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No hay llamadas registradas{callFilter !== 'all' ? ' con ese filtro' : ''}.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => {
                const lines = (call.description || '').split('\n');
                const durationLine = lines.find((line) => line.startsWith('Duración:'));
                const notesLine = lines.find((line) => line.startsWith('Notas:'));
                const duration = durationLine?.replace('Duración: ', '') || '—';
                const notes = notesLine?.replace('Notas: ', '') || '';
                const resultColor = call.subject === 'Conectada' ? 'text-emerald-600' : 'text-muted-foreground';

                return (
                  <TableRow key={call.id}>
                    <TableCell className="text-sm">
                      {format(new Date(call.interaction_date), 'dd MMM yyyy HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={resultColor}>{call.subject || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{duration}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{notes || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
