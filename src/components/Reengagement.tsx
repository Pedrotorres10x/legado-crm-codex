import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, MessageCircle, Sparkles, RefreshCw, Send, ExternalLink, Phone, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type BuyerAnalysis = {
  contact: { id: string; full_name: string; email: string | null; phone: string | null; contact_type: string; status: string };
  demands: any[];
  matchCount: number;
  pendingMatches: number;
  interestedMatches: number;
  recentMatches: { property: any; status: string; compatibility: number }[];
  recentVisits: any[];
  daysSinceContact: number;
  newPropertiesCount: number;
  hasEmail: boolean;
  hasPhone: boolean;
};

type GeneratedMessages = {
  contact: { id: string; full_name: string; email: string | null; phone: string | null };
  messages: { email_subject: string; email_body: string; whatsapp_message: string };
};

const Reengagement = () => {
  const { toast } = useToast();
  const [buyers, setBuyers] = useState<BuyerAnalysis[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [messageDialog, setMessageDialog] = useState(false);
  const [currentMessages, setCurrentMessages] = useState<GeneratedMessages | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  const callFunction = async (body: any) => {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-reengagement`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Error en la función');
    return data;
  };

  const analyzeBuyers = async () => {
    setAnalyzing(true);
    try {
      const data = await callFunction({ action: 'analyze' });
      setBuyers(data.buyers || []);
      if (data.buyers?.length === 0) {
        toast({ title: 'Sin compradores activos', description: 'No hay compradores con demandas activas para reactivar.' });
      } else {
        toast({ title: `${data.buyers.length} compradores analizados` });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setAnalyzing(false);
  };

  const generateMessages = async (contactId: string) => {
    setGenerating(contactId);
    try {
      const data = await callFunction({ action: 'generate', contact_id: contactId });
      setCurrentMessages(data);
      setEditSubject(data.messages.email_subject);
      setEditBody(data.messages.email_body);
      setEditWhatsapp(data.messages.whatsapp_message);
      setMessageDialog(true);
    } catch (e: any) {
      toast({ title: 'Error generando mensajes', description: e.message, variant: 'destructive' });
    }
    setGenerating(null);
  };

  const sendEmail = async () => {
    if (!currentMessages?.contact.email) {
      toast({ title: 'Sin email', description: 'Este contacto no tiene email registrado.', variant: 'destructive' });
      return;
    }
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('multichannel-send', {
        body: {
          channel: 'email',
          contact_id: currentMessages.contact.id,
          text: editBody,
          subject: editSubject,
          html: editBody,
          source: 'reengagement',
        },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Error enviando email');
      toast({ title: '📧 Email enviado', description: `Email enviado a ${currentMessages.contact.email}` });
    } catch (e: any) {
      toast({ title: 'Error enviando email', description: e.message, variant: 'destructive' });
    }
    setSendingEmail(false);
  };

  const openWhatsApp = async () => {
    if (!currentMessages?.contact.phone) {
      toast({ title: 'Sin teléfono', description: 'Este contacto no tiene teléfono registrado.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('multichannel-send', {
        body: {
          channel: 'whatsapp',
          contact_id: currentMessages.contact.id,
          text: editWhatsapp,
          source: 'reengagement',
        },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'Error enviando WhatsApp');
      toast({ title: '✅ WhatsApp enviado', description: `Mensaje enviado a ${currentMessages.contact.full_name}` });
    } catch (e: any) {
      toast({ title: 'Error WhatsApp', description: e.message, variant: 'destructive' });
    }
  };

  const urgencyBadge = (days: number) => {
    if (days >= 30) return <Badge variant="destructive" className="text-[10px]">{days}d sin contacto</Badge>;
    if (days >= 14) return <Badge className="bg-orange-500 text-white border-0 text-[10px]">{days}d sin contacto</Badge>;
    if (days >= 7) return <Badge variant="secondary" className="text-[10px]">{days}d sin contacto</Badge>;
    return <Badge variant="outline" className="text-[10px]">{days}d</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Reengagement de Compradores
            </CardTitle>
            <Button onClick={analyzeBuyers} disabled={analyzing} size="sm">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {buyers.length > 0 ? 'Reanalizar' : 'Analizar compradores'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            La IA analiza el historial de cada comprador y genera mensajes personalizados de seguimiento por email y WhatsApp.
          </p>
        </CardHeader>
        <CardContent>
          {buyers.length === 0 && !analyzing ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Pulsa "Analizar compradores" para que la IA identifique a quién reactivar.</p>
            </div>
          ) : analyzing ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-foreground">Analizando historial de compradores...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Cruces</TableHead>
                  <TableHead>Últmo contacto</TableHead>
                  <TableHead>Novedades</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyers.map(b => (
                  <TableRow key={b.contact.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{b.contact.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {b.demands.map(d => `${d.property_type || 'cualquier'} · ${(d.cities || []).join(', ') || 'cualquier zona'}`).join(' | ')}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {b.hasEmail && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                        {b.hasPhone && <Phone className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <span>{b.matchCount} total</span>
                        {b.pendingMatches > 0 && <Badge variant="secondary" className="text-[10px]">{b.pendingMatches} pend.</Badge>}
                        {b.interestedMatches > 0 && <Badge className="bg-primary text-primary-foreground border-0 text-[10px]">{b.interestedMatches} inter.</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{urgencyBadge(b.daysSinceContact)}</TableCell>
                    <TableCell>
                      {b.newPropertiesCount > 0 ? (
                        <Badge variant="outline" className="text-[10px] border-primary text-primary">{b.newPropertiesCount} nuevas</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateMessages(b.contact.id)}
                        disabled={generating === b.contact.id}
                      >
                        {generating === b.contact.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                        )}
                        Generar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Message Preview & Send Dialog */}
      <Dialog open={messageDialog} onOpenChange={setMessageDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Mensajes para {currentMessages?.contact.full_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Email Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Email</h3>
                {currentMessages?.contact.email && (
                  <span className="text-xs text-muted-foreground">→ {currentMessages.contact.email}</span>
                )}
              </div>
              <div className="space-y-2">
                <Label>Asunto</Label>
                <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cuerpo (HTML)</Label>
                <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={6} className="font-mono text-xs" />
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-2">Vista previa:</p>
                <iframe
                  srcDoc={editBody}
                  sandbox=""
                  className="w-full h-48 border-0 rounded bg-white"
                  title="Vista previa del email"
                />
              </div>
              <Button onClick={sendEmail} disabled={sendingEmail || !currentMessages?.contact.email} className="w-full">
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {currentMessages?.contact.email ? 'Enviar Email' : 'Sin email disponible'}
              </Button>
            </div>

            {/* WhatsApp Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold">WhatsApp</h3>
                {currentMessages?.contact.phone && (
                  <span className="text-xs text-muted-foreground">→ {currentMessages.contact.phone}</span>
                )}
              </div>
              <div className="space-y-2">
                <Label>Mensaje</Label>
                <Textarea value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)} rows={3} />
              </div>
              <Button
                onClick={openWhatsApp}
                disabled={!currentMessages?.contact.phone}
                variant="outline"
                className="w-full border-green-600 text-green-600 hover:bg-green-50"
              >
                <Send className="h-4 w-4 mr-2" />
                {currentMessages?.contact.phone ? 'Enviar WhatsApp' : 'Sin teléfono disponible'}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialog(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reengagement;
