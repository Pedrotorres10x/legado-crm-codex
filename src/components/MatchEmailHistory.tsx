import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, CheckCircle, XCircle, User, Home } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface MatchEmailHistoryProps {
  contactId?: string;
  propertyId?: string;
}

const MatchEmailHistory = ({ contactId, propertyId }: MatchEmailHistoryProps) => {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEmails = async () => {
      setLoading(true);
      let query = supabase
        .from('match_emails')
        .select('*, contacts(id, full_name), properties(id, title, city)')
        .order('sent_at', { ascending: false })
        .limit(100);

      if (contactId) query = query.eq('contact_id', contactId);
      if (propertyId) query = query.eq('property_id', propertyId);

      const { data } = await query;
      setEmails(data || []);
      setLoading(false);
    };
    fetchEmails();
  }, [contactId, propertyId]);

  if (loading) return null;

  return (
    <Card className="animate-fade-in-up">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Emails enviados ({emails.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No se han enviado emails automáticos aún.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {!contactId && <TableHead>Contacto</TableHead>}
                {!propertyId && <TableHead>Propiedad</TableHead>}
                <TableHead>Asunto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((e) => (
                <TableRow key={e.id}>
                  {!contactId && (
                    <TableCell
                      className="cursor-pointer hover:underline"
                      onClick={() => e.contacts?.id && navigate(`/contacts/${e.contacts.id}`)}
                    >
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{(e.contacts as any)?.full_name || e.email_to}</span>
                      </div>
                    </TableCell>
                  )}
                  {!propertyId && (
                    <TableCell
                      className="cursor-pointer hover:underline"
                      onClick={() => e.properties?.id && navigate(`/properties/${e.properties.id}`)}
                    >
                      <div className="flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{(e.properties as any)?.title || '-'}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-sm max-w-[250px] truncate">{e.subject}</TableCell>
                  <TableCell>
                    {e.status === 'enviado' ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300 gap-1">
                        <CheckCircle className="h-3 w-3" />Enviado
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />Error
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(e.sent_at), 'dd MMM yyyy HH:mm', { locale: es })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default MatchEmailHistory;
