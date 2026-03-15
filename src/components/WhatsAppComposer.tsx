import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  contactId: string;
  contactName: string;
  phone: string;
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WhatsAppComposer = ({ contactId, contactName, phone, agentId, open, onOpenChange }: Props) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const cleanPhone = phone.replace(/\D/g, '');

  const handleSend = async () => {
    if (!message.trim() || message.trim().length < 12) {
      toast({
        title: 'Falta contexto del WhatsApp',
        description: 'Escribe un mensaje con intención real para que el toque tenga valor comercial y quede bien registrado.',
        variant: 'destructive',
      });
      return;
    }
    setSending(true);

    try {
      // Insert into interactions (timeline)
      await supabase.from('interactions').insert({
        contact_id: contactId,
        agent_id: agentId,
        interaction_type: 'whatsapp',
        subject: 'WhatsApp enviado',
        description: message.trim(),
      });

      // Insert into communication_logs (history)
      await supabase.from('communication_logs').insert({
        contact_id: contactId,
        agent_id: agentId,
        channel: 'whatsapp',
        direction: 'outbound',
        status: 'enviado',
        source: 'manual_wa_me',
        body_preview: message.trim().slice(0, 500),
      });

      // Open wa.me
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message.trim())}`, '_blank');

      toast({ title: 'WhatsApp registrado en el CRM' });
      setMessage('');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error al registrar', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
            WhatsApp a {contactName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">+{cleanPhone}</p>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          Registra WhatsApps con intención real: contexto, propuesta o siguiente paso. Si no, el toque pierde valor en la lectura comercial.
        </div>

        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Ej: Te paso la propuesta y si te encaja te llamo manana para cerrar la visita."
          rows={4}
          className="resize-none"
        />

        <DialogFooter>
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar por WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppComposer;
