import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Heart } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type ContactLike = {
  birth_date?: string | null;
  purchase_date?: string | null;
  sale_date?: string | null;
};

type ReengagementItem = {
  id: string;
  message_type: string;
  year: number;
  sent_at: string;
  channel: string;
  message_preview?: string | null;
};

type Props = {
  contact: ContactLike;
  reengagementHistory: ReengagementItem[];
};

const formatAnnualDate = (date: string) =>
  format(
    new Date(new Date().getFullYear(), new Date(date).getMonth(), new Date(date).getDate()),
    'dd MMM',
    { locale: es }
  );

const messageTypeLabel = (messageType: string) => {
  if (messageType === 'cumpleanos') return '🎂 Cumpleaños';
  if (messageType === 'navidad') return '🎄 Navidad';
  if (messageType === 'semana_santa') return '🐣 Semana Santa';
  if (messageType === 'verano') return '☀️ Verano';
  if (messageType === 'aniversario_compra') return '🏠 Aniv. compra';
  if (messageType === 'aniversario_venta') return '🏠 Aniv. venta';
  if (messageType === 'renta_comprador') return '📋 Renta (compra)';
  if (messageType === 'renta_vendedor') return '📋 Renta (venta)';
  if (messageType === 'renta') return '📋 Renta';
  return messageType;
};

export default function ContactReengagementPanel({ contact, reengagementHistory }: Props) {
  const upcomingMessages = [
    {
      type: 'cumpleanos',
      icon: '🎂',
      label: 'Cumpleaños',
      date: contact.birth_date ? formatAnnualDate(contact.birth_date) : 'Sin fecha',
    },
    { type: 'navidad', icon: '🎄', label: 'Navidad', date: '23 dic' },
    { type: 'semana_santa', icon: '🐣', label: 'Semana Santa', date: 'Variable' },
    { type: 'verano', icon: '☀️', label: 'Verano', date: '1 jul' },
    ...(contact.purchase_date
      ? [{ type: 'aniversario_compra', icon: '🏠', label: 'Aniversario compra', date: formatAnnualDate(contact.purchase_date) }]
      : []),
    ...(contact.sale_date
      ? [{ type: 'aniversario_venta', icon: '🏠', label: 'Aniversario venta', date: formatAnnualDate(contact.sale_date) }]
      : []),
  ];

  const purchaseExtra =
    contact.purchase_date && new Date().getFullYear() === new Date(contact.purchase_date).getFullYear() + 1
      ? ' + Renta (compra)'
      : '';
  const saleExtra =
    contact.sale_date && new Date().getFullYear() === new Date(contact.sale_date).getFullYear() + 1
      ? ' + Renta (venta)'
      : '';

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              Plan de fidelización
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Mensajes automáticos: Cumpleaños, Navidad, Semana Santa, Verano
              {contact.purchase_date ? ', Aniversario de compra' : ''}
              {contact.sale_date ? ', Aniversario de venta' : ''}
              {purchaseExtra}
              {saleExtra}
            </p>
          </div>
          {!contact.purchase_date && !contact.sale_date && (
            <Badge variant="outline" className="text-xs border-destructive text-destructive">
              ⚠️ Sin fecha de compra/venta
            </Badge>
          )}
        </div>

        {(contact.purchase_date || contact.sale_date) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Próximos mensajes programados:</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingMessages.map((item) => {
                const sentThisYear = reengagementHistory.some(
                  (entry) => entry.message_type === item.type && entry.year === new Date().getFullYear()
                );
                return (
                  <div
                    key={item.type}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${sentThisYear ? 'bg-muted/50 border-muted' : 'border-border'}`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.date}</p>
                    </div>
                    {sentThisYear ? (
                      <Badge variant="secondary" className="text-[10px]">✓ Enviado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Pendiente</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reengagementHistory.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Historial de mensajes enviados:</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Mensaje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reengagementHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm font-medium">{messageTypeLabel(entry.message_type)}</TableCell>
                    <TableCell>{entry.year}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(entry.sent_at), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{entry.channel}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{entry.message_preview}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {reengagementHistory.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Heart className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Aún no se han enviado mensajes de fidelización.</p>
            <p className="text-xs mt-1">El sistema enviará automáticamente WhatsApp en las fechas programadas.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
