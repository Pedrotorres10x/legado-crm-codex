import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, CheckCircle, Clock, GitMerge, User } from 'lucide-react';

import AddToGoogleCalendarButton from '@/components/AddToGoogleCalendarButton';
import MatchEmailHistory from '@/components/MatchEmailHistory';
import * as AccordionUI from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type PropertyCommercialActivityPanelProps = {
  propertyId: string;
  propertyTitle?: string | null;
  propertyAddress?: string | null;
  propertyVisits: any[];
  propertyMatches: any[];
  onNavigateContact: (contactId: string) => void;
  onUpdateMatchStatus: (matchId: string, status: string) => Promise<void>;
};

const PropertyCommercialActivityPanel = ({
  propertyId,
  propertyTitle,
  propertyAddress,
  propertyVisits,
  propertyMatches,
  onNavigateContact,
  onUpdateMatchStatus,
}: PropertyCommercialActivityPanelProps) => {
  return (
    <AccordionUI.AccordionItem value="activity" className="border-b border-border/60">
      <AccordionUI.AccordionTrigger className="px-6 py-4 hover:no-underline">
        <div className="min-w-0 text-left">
          <p className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Actividad comercial
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Visitas, cruces y seguimiento comercial sobre este inmueble.
          </p>
        </div>
      </AccordionUI.AccordionTrigger>
      <AccordionUI.AccordionContent className="px-6 pb-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Historial de Visitas ({propertyVisits.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {propertyVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay visitas registradas para esta propiedad.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Confirmación</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propertyVisits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell>
                        {format(new Date(visit.visit_date), 'dd MMM yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium">{visit.contacts?.full_name}</TableCell>
                      <TableCell>
                        {visit.confirmation_status === 'confirmado' ? (
                          <Badge className="bg-green-600 text-white border-0">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confirmado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{visit.notes || '-'}</TableCell>
                      <TableCell>
                        <AddToGoogleCalendarButton
                          visitDate={visit.visit_date}
                          propertyTitle={propertyTitle}
                          contactName={visit.contacts?.full_name}
                          propertyAddress={propertyAddress}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <AccordionUI.Accordion type="single" collapsible>
            <AccordionUI.AccordionItem value="matches" className="border-b-0">
              <AccordionUI.AccordionTrigger className="px-6 py-4 hover:no-underline">
                <span className="text-base font-semibold flex items-center gap-2">
                  <GitMerge className="h-4 w-4 text-primary" />
                  Historial de Cruces ({propertyMatches.length})
                </span>
              </AccordionUI.AccordionTrigger>
              <AccordionUI.AccordionContent>
                <div className="px-6 pb-4">
                  {propertyMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay cruces registrados para esta propiedad.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Comprador</TableHead>
                          <TableHead>Compatibilidad</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {propertyMatches.map((match) => (
                          <TableRow
                            key={match.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => match.demands?.contact_id && onNavigateContact(match.demands.contact_id)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {match.demands?.contacts?.full_name || 'Contacto'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {match.compatibility || 0}%
                              </Badge>
                            </TableCell>
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <Select
                                value={match.status}
                                onValueChange={(value) => onUpdateMatchStatus(match.id, value)}
                              >
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
                            <TableCell>
                              {format(new Date(match.created_at), 'dd MMM yyyy', { locale: es })}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {match.notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </AccordionUI.AccordionContent>
            </AccordionUI.AccordionItem>
          </AccordionUI.Accordion>
        </Card>

        <MatchEmailHistory propertyId={propertyId} />
      </AccordionUI.AccordionContent>
    </AccordionUI.AccordionItem>
  );
};

export default PropertyCommercialActivityPanel;
