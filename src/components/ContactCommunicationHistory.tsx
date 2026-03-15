import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mail, MessageSquare, ArrowUpRight, ArrowDownLeft, CheckCircle, XCircle, Clock, Home } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Props {
  contactId: string;
}

const ContactCommunicationHistory = ({ contactId }: Props) => {
  const [commLogs, setCommLogs] = useState<any[]>([]);
  const [matchEmails, setMatchEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [logsRes, emailsRes] = await Promise.all([
        supabase
          .from('communication_logs')
          .select('*, properties(id, title)')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('match_emails')
          .select('*, properties(id, title, city)')
          .eq('contact_id', contactId)
          .order('sent_at', { ascending: false })
          .limit(200),
      ]);
      setCommLogs(logsRes.data || []);
      setMatchEmails(emailsRes.data || []);
      setLoading(false);
    };
    load();
  }, [contactId]);

  if (loading) return null;

  const emailLogs = commLogs.filter(l => l.channel === 'email');
  const whatsappLogs = commLogs.filter(l => l.channel === 'whatsapp');

  const outboundEmails = emailLogs.filter(l => l.direction === 'outbound');
  const inboundEmails = emailLogs.filter(l => l.direction === 'inbound');
  const outboundWa = whatsappLogs.filter(l => l.direction === 'outbound');
  const inboundWa = whatsappLogs.filter(l => l.direction === 'inbound');

  const statusBadge = (status: string) => {
    if (status === 'enviado' || status === 'delivered' || status === 'sent') {
      return <Badge variant="outline" className="text-emerald-600 border-emerald-300 gap-1 text-[10px]"><CheckCircle className="h-3 w-3" />Enviado</Badge>;
    }
    if (status === 'error' || status === 'failed') {
      return <Badge variant="destructive" className="gap-1 text-[10px]"><XCircle className="h-3 w-3" />Error</Badge>;
    }
    return <Badge variant="outline" className="gap-1 text-[10px]"><Clock className="h-3 w-3" />{status}</Badge>;
  };

  const directionIcon = (dir: string) => dir === 'inbound'
    ? <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
    : <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;

  const sourceBadge = (source: string | null) => {
    if (source === 'campaign_demand_enrich') {
      return <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900 dark:text-indigo-300">🎯 Enriquecimiento</Badge>;
    }
    if (source === 'campaign_classify') {
      return <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300">📋 Clasificación</Badge>;
    }
    if (source === 'campaign_demand_followup' || source === 'campaign_demand_confirmation') {
      return <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300">🏡 Demanda</Badge>;
    }
    if (source) {
      return <Badge variant="secondary" className="text-[10px]">{source}</Badge>;
    }
    return null;
  };

  const renderLogRow = (log: any) => (
    <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="mt-0.5">{directionIcon(log.direction)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {log.subject && <span className="text-sm font-medium truncate">{log.subject}</span>}
          {statusBadge(log.status)}
          {sourceBadge(log.source)}
        </div>
        {log.body_preview && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{log.body_preview}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: es })}
          </span>
          {log.properties?.title && (
            <button
              onClick={() => navigate(`/properties/${log.properties.id}`)}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              <Home className="h-3 w-3" />{log.properties.title}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderMatchEmailRow = (email: any) => (
    <div key={email.id} className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="mt-0.5"><ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{email.subject}</span>
          {statusBadge(email.status)}
          <Badge variant="secondary" className="text-[10px]">Cruce</Badge>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(email.sent_at), "dd MMM yyyy HH:mm", { locale: es })}
          </span>
          {email.properties?.title && (
            <button
              onClick={() => navigate(`/properties/${email.properties.id}`)}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              <Home className="h-3 w-3" />{email.properties.title}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const totalEmails = outboundEmails.length + inboundEmails.length + matchEmails.length;
  const totalWa = outboundWa.length + inboundWa.length;

  return (
    <Card className="animate-fade-in-up">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Historial de comunicaciones ({totalEmails + totalWa})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {totalEmails + totalWa === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No hay comunicaciones registradas aún.
          </p>
        ) : (
          <Accordion type="multiple" defaultValue={['emails-out', 'whatsapp-out']} className="w-full">
            {/* EMAILS ENVIADOS */}
            {(outboundEmails.length > 0 || matchEmails.length > 0) && (
              <AccordionItem value="emails-out">
                <AccordionTrigger className="text-sm py-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-emerald-500" />
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                    Emails enviados
                    <Badge variant="secondary" className="text-[10px] ml-1">{outboundEmails.length + matchEmails.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-2">
                    {matchEmails.map(renderMatchEmailRow)}
                    {outboundEmails.map(renderLogRow)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* EMAILS RECIBIDOS */}
            {inboundEmails.length > 0 && (
              <AccordionItem value="emails-in">
                <AccordionTrigger className="text-sm py-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
                    Emails recibidos
                    <Badge variant="secondary" className="text-[10px] ml-1">{inboundEmails.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-2">
                    {inboundEmails.map(renderLogRow)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* WHATSAPP ENVIADOS */}
            {outboundWa.length > 0 && (
              <AccordionItem value="whatsapp-out">
                <AccordionTrigger className="text-sm py-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-500" />
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                    WhatsApp enviados
                    <Badge variant="secondary" className="text-[10px] ml-1">{outboundWa.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-2">
                    {outboundWa.map(renderLogRow)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* WHATSAPP RECIBIDOS */}
            {inboundWa.length > 0 && (
              <AccordionItem value="whatsapp-in">
                <AccordionTrigger className="text-sm py-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <ArrowDownLeft className="h-3.5 w-3.5 text-blue-500" />
                    WhatsApp recibidos
                    <Badge variant="secondary" className="text-[10px] ml-1">{inboundWa.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-2">
                    {inboundWa.map(renderLogRow)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default ContactCommunicationHistory;
