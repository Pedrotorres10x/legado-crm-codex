import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { Calendar, CheckCircle, Clock, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ContactVisit = {
  id: string;
  visit_date: string;
  notes: string | null;
  confirmation_status: string | null;
  properties: { title: string | null } | null;
};

interface ContactsInsightsDialogsProps {
  visitsOpen: string | null;
  onVisitsOpenChange: (open: string | null) => void;
  visitsLoading: boolean;
  contactVisits: ContactVisit[];
  summaryOpen: string | null;
  onSummaryOpenChange: (open: string | null) => void;
  summaryLoading: boolean;
  summary: string;
}

const ContactsInsightsDialogs = ({
  visitsOpen,
  onVisitsOpenChange,
  visitsLoading,
  contactVisits,
  summaryOpen,
  onSummaryOpenChange,
  summaryLoading,
  summary,
}: ContactsInsightsDialogsProps) => {
  return (
    <>
      <Dialog open={!!visitsOpen} onOpenChange={() => onVisitsOpenChange(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Historial de Visitas
            </DialogTitle>
          </DialogHeader>
          {visitsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contactVisits.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No hay visitas registradas para este contacto.</p>
          ) : (
            <div className="max-h-[50vh] space-y-3 overflow-y-auto">
              {contactVisits.map((visit) => (
                <div key={visit.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{visit.properties?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(visit.visit_date), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                    {visit.notes && <p className="mt-1 text-xs text-muted-foreground">{visit.notes}</p>}
                  </div>
                  {visit.confirmation_status === 'confirmado' ? (
                    <Badge className="shrink-0 border-0 bg-green-600 text-white">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Confirmado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 border-amber-300 text-amber-600">
                      <Clock className="mr-1 h-3 w-3" />
                      Pendiente
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!summaryOpen} onOpenChange={() => onSummaryOpenChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Resumen IA del contacto
            </DialogTitle>
          </DialogHeader>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContactsInsightsDialogs;
