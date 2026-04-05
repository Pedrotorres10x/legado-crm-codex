import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarClock, Loader2, Mail, MessageCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type PropertyVisitSheetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyTitle: string;
  propertyAddress?: string | null;
  agentId?: string | null;
  canViewAll?: boolean;
  viewerUserId?: string | null;
  onCreated?: () => Promise<void> | void;
};

type ContactSearchResult = {
  id: string;
  full_name: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  contact_type: string | null;
  status: string | null;
  agent_id?: string | null;
};

type ContractTemplateRow = {
  id: string;
};

const buildDefaultVisitDate = () => {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date.toISOString().slice(0, 16);
};

const getPreferredChannel = (contact: ContactSearchResult | null) => {
  if (!contact) return null;
  if (contact.phone || contact.phone2) return 'whatsapp' as const;
  if (contact.email) return 'email' as const;
  return null;
};

const normalizeWhatsappPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 9) return `34${digits}`;
  return digits;
};

const buildVisitSheetText = ({
  contactName,
  propertyTitle,
  propertyAddress,
  visitDate,
  url,
}: {
  contactName: string;
  propertyTitle: string;
  propertyAddress?: string | null;
  visitDate: string;
  url: string;
}) => {
  const formattedDate = format(new Date(visitDate), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
  const addressLine = propertyAddress ? `\nDirección: ${propertyAddress}` : '';
  return `Hola ${contactName}. Te envío la hoja de visita de ${propertyTitle}.\n\nFecha prevista: ${formattedDate}${addressLine}\n\nRevisa y firma aquí para dejar constancia de la visita:\n${url}`;
};

const buildVisitSheetEmailHtml = ({
  contactName,
  propertyTitle,
  propertyAddress,
  visitDate,
  url,
}: {
  contactName: string;
  propertyTitle: string;
  propertyAddress?: string | null;
  visitDate: string;
  url: string;
}) => {
  const formattedDate = format(new Date(visitDate), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Hola ${contactName},</p>
      <p>Te compartimos el resumen de tu hoja de visita de <strong>${propertyTitle}</strong>.</p>
      <p><strong>Fecha prevista:</strong> ${formattedDate}</p>
      ${propertyAddress ? `<p><strong>Dirección:</strong> ${propertyAddress}</p>` : ''}
      <p>Para dejar constancia de la visita, abre este enlace, revisa la hoja de visita y fírmala electrónicamente.</p>
      <p><a href="${url}">${url}</a></p>
      <p>Durante la firma se te pedirán nombre completo y DNI/NIE, sin necesidad de adjuntar foto del documento.</p>
    </div>
  `;
};

const registerManualWhatsappPreparation = async ({
  contactId,
  contactName,
  propertyId,
  propertyTitle,
  agentId,
  messageText,
  signUrl,
  visitId,
}: {
  contactId: string;
  contactName: string;
  propertyId: string;
  propertyTitle: string;
  agentId?: string | null;
  messageText: string;
  signUrl: string;
  visitId: string;
}) => {
  const now = new Date().toISOString();

  await Promise.all([
    supabase.from('interactions').insert({
      contact_id: contactId,
      property_id: propertyId,
      interaction_type: 'whatsapp',
      interaction_date: now,
      subject: 'Hoja de visita preparada por WhatsApp',
      description: `Se preparó por WhatsApp el envío de la hoja de visita de ${propertyTitle} para ${contactName}.`,
      agent_id: agentId || null,
    }),
    supabase.from('communication_logs').insert({
      contact_id: contactId,
      property_id: propertyId,
      channel: 'whatsapp',
      direction: 'outbound',
      source: 'visit_sheet',
      status: 'prepared',
      body_preview: messageText.slice(0, 500),
      agent_id: agentId || null,
      metadata: {
        manual_whatsapp: true,
        sign_url: signUrl,
        visit_id: visitId,
      },
    }),
  ]);
};

const buildVisitSheetDocument = ({
  propertyTitle,
  propertyAddress,
  visitDate,
  contactName,
  notes,
}: {
  propertyTitle: string;
  propertyAddress?: string | null;
  visitDate: string;
  contactName: string;
  notes: string;
}) => {
  const formattedDate = format(new Date(visitDate), "EEEE d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
  const normalizedNotes = notes.trim();

  return [
    'HOJA DE VISITA',
    '',
    `Inmueble: ${propertyTitle}`,
    propertyAddress ? `Dirección: ${propertyAddress}` : null,
    `Fecha prevista de visita: ${formattedDate}`,
    `Visitante vinculado: ${contactName}`,
    '',
    'DECLARACIÓN',
    '',
    'La persona firmante declara que ha visitado o va a visitar el inmueble indicado en este documento y que los datos identificativos facilitados durante la firma son correctos.',
    'La firma deja constancia electrónica de la visita, incorporando sello temporal, IP, dispositivo y la firma manuscrita trazada en pantalla.',
    '',
    normalizedNotes ? 'NOTA INTERNA DE LA VISITA' : null,
    normalizedNotes || null,
  ]
    .filter(Boolean)
    .join('\n');
};

const ensureVisitSheetTemplate = async () => {
  const { data: existingTemplate, error: existingError } = await supabase
    .from('contract_templates')
    .select('id')
    .eq('name', 'Hoja de visita')
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingTemplate) return (existingTemplate as ContractTemplateRow).id;

  const { data: createdTemplate, error: createError } = await supabase
    .from('contract_templates')
    .insert({
      name: 'Hoja de visita',
      category: 'visita',
      content: 'Documento generado automáticamente para registrar la visita a un inmueble.',
      agent_id: null,
    })
    .select('id')
    .single();

  if (createError || !createdTemplate) {
    throw createError || new Error('No se pudo crear la plantilla de hoja de visita.');
  }

  return (createdTemplate as ContractTemplateRow).id;
};

const buildSendPayload = ({
  channel,
  contactId,
  agentId,
  propertyId,
  propertyTitle,
  propertyAddress,
  contactName,
  visitDate,
  url,
}: {
  channel: 'whatsapp' | 'email';
  contactId: string;
  agentId?: string | null;
  propertyId: string;
  propertyTitle: string;
  propertyAddress?: string | null;
  contactName: string;
  visitDate: string;
  url: string;
}) => {
  const messageText = buildVisitSheetText({
    contactName,
    propertyTitle,
    propertyAddress,
    visitDate,
    url,
  });

  if (channel === 'whatsapp') {
    return {
      channel: 'whatsapp' as const,
      contact_id: contactId,
      text: messageText,
      source: 'visit_sheet',
      property_id: propertyId,
      agent_id: agentId,
      allow_first_whatsapp_links: true,
    };
  }

  return {
    channel: 'email' as const,
    contact_id: contactId,
    text: messageText,
    subject: `Hoja de visita · ${propertyTitle}`,
    html: buildVisitSheetEmailHtml({
      contactName,
      propertyTitle,
      propertyAddress,
      visitDate,
      url,
    }),
    source: 'visit_sheet',
    property_id: propertyId,
    agent_id: agentId,
  };
};

const PropertyVisitSheetDialog = ({
  open,
  onOpenChange,
  propertyId,
  propertyTitle,
  propertyAddress,
  agentId,
  canViewAll,
  viewerUserId,
  onCreated,
}: PropertyVisitSheetDialogProps) => {
  const { toast } = useToast();
  const [contactQuery, setContactQuery] = useState('');
  const [contactResults, setContactResults] = useState<ContactSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactSearchResult | null>(null);
  const [visitDate, setVisitDate] = useState(buildDefaultVisitDate);
  const [notes, setNotes] = useState('Hoja de visita enviada para dejar constancia de asistencia. El visitante debe escribir correctamente nombre completo y DNI/NIE.');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      const term = contactQuery.trim();
      if (term.length < 2) {
        if (active) setContactResults([]);
        return;
      }

      setSearching(true);

      let query = supabase
        .from('contacts')
        .select('id, full_name, phone, phone2, email, contact_type, status, agent_id')
        .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,phone2.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(8);

      if (!canViewAll && viewerUserId) {
        query = query.eq('agent_id', viewerUserId);
      }

      const { data } = await query;

      if (active) {
        setContactResults((data || []) as ContactSearchResult[]);
        setSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [canViewAll, contactQuery, open, viewerUserId]);

  useEffect(() => {
    if (!selectedContact) return;

    if (selectedContact.phone || selectedContact.phone2 || selectedContact.email) return;

    setSelectedContact(null);
  }, [selectedContact]);

  const preferredChannel = useMemo(() => getPreferredChannel(selectedContact), [selectedContact]);

  const handleSubmit = async () => {
    if (!selectedContact) {
      toast({ title: 'Selecciona un contacto', description: 'La hoja de visita tiene que ir vinculada a una persona.', variant: 'destructive' });
      return;
    }

    if (!preferredChannel) {
      toast({
        title: 'Sin canal disponible',
        description: 'Este contacto no tiene WhatsApp ni email para enviar la hoja de visita.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const channel = preferredChannel;
    const contactName = selectedContact.full_name || 'cliente';
    const normalizedVisitDate = new Date(visitDate).toISOString();
    let signUrl: string | null = null;
    let createdDocument = false;

    try {
      const templateId = await ensureVisitSheetTemplate();
      const signatureToken = crypto.randomUUID();
      const documentContent = buildVisitSheetDocument({
        propertyTitle,
        propertyAddress,
        visitDate: normalizedVisitDate,
        contactName,
        notes,
      });

      const { data: contractRow, error: contractError } = await supabase
        .from('generated_contracts')
        .insert({
          template_id: templateId,
          property_id: propertyId,
          contact_id: selectedContact.id,
          agent_id: agentId || null,
          content: documentContent,
          signature_status: 'pendiente',
          signature_token: signatureToken,
        })
        .select('id')
        .single();

      if (contractError || !contractRow) {
        throw contractError || new Error('No se pudo generar el documento de firma.');
      }

      signUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-contract?token=${signatureToken}`;
      createdDocument = true;

      if (!signUrl) {
        throw new Error('No se pudo generar el enlace de firma.');
      }

      const sendUrl = signUrl;

      const { data: visitRow, error: visitError } = await supabase
        .from('visits')
        .insert({
          property_id: propertyId,
          contact_id: selectedContact.id,
          visit_date: normalizedVisitDate,
          notes: notes.trim() || null,
          agent_id: agentId || null,
          confirmation_status: 'pendiente',
          visit_sheet_channel: channel,
          signature_contract_id: contractRow.id,
        })
        .select('id')
        .single();

      if (visitError || !visitRow) {
        await supabase.from('generated_contracts').delete().eq('id', contractRow.id);
        throw visitError || new Error('No se pudo registrar la visita.');
      }

      const sendWithChannel = async (currentChannel: 'whatsapp' | 'email') => {
        if (currentChannel === 'whatsapp') {
          const phone = selectedContact.phone || selectedContact.phone2;
          if (!phone) {
            throw new Error('El contacto no tiene teléfono para WhatsApp.');
          }

          const payload = buildSendPayload({
            channel: 'whatsapp',
            contactId: selectedContact.id,
            agentId,
            propertyId,
            propertyTitle,
            propertyAddress,
            contactName,
            visitDate: normalizedVisitDate,
            url: sendUrl,
          });

          await navigator.clipboard.writeText(sendUrl);
          const whatsappUrl = `https://wa.me/${normalizeWhatsappPhone(phone)}?text=${encodeURIComponent(payload.text)}`;
          window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
          await registerManualWhatsappPreparation({
            contactId: selectedContact.id,
            contactName,
            propertyId,
            propertyTitle,
            agentId,
            messageText: payload.text,
            signUrl: sendUrl,
            visitId: visitRow.id,
          });
          return 'whatsapp' as const;
        }

        const payload = buildSendPayload({
          channel: 'email',
          contactId: selectedContact.id,
          agentId,
          propertyId,
          propertyTitle,
          propertyAddress,
          contactName,
          visitDate: normalizedVisitDate,
          url: sendUrl,
        });

        const { data, error } = await supabase.functions.invoke('multichannel-send', { body: payload });
        if (error || !data?.ok) {
          throw new Error(data?.error || error?.message || 'No se pudo enviar por email');
        }

        return 'email' as const;
      };

      let finalChannel = channel;
      let emailSummarySent = false;
      let emailSummaryError: string | null = null;

      try {
        finalChannel = await sendWithChannel(channel);
      } catch (primaryError) {
        if (channel === 'whatsapp' && selectedContact.email) {
          finalChannel = await sendWithChannel('email');
          toast({
            title: 'Sin WhatsApp disponible, enviado por email',
            description: primaryError instanceof Error ? primaryError.message : 'Se ha usado email como respaldo.',
          });
        } else {
          throw primaryError;
        }
      }

      if (selectedContact.email && finalChannel !== 'email') {
        try {
          await sendWithChannel('email');
          emailSummarySent = true;
        } catch (secondaryError) {
          emailSummaryError = secondaryError instanceof Error ? secondaryError.message : 'No se pudo enviar el resumen por email.';
        }
      } else if (finalChannel === 'email') {
        emailSummarySent = true;
      }

      await supabase
        .from('visits')
        .update({
          visit_sheet_sent_at: new Date().toISOString(),
          visit_sheet_channel: finalChannel,
        })
        .eq('id', visitRow.id);

      toast({
        title: finalChannel === 'whatsapp' ? 'Hoja de visita preparada' : 'Hoja de visita enviada',
        description:
          finalChannel === 'whatsapp'
            ? emailSummarySent
              ? `Se ha abierto WhatsApp con el enlace listo y también se ha enviado un email resumen a ${contactName}.`
              : emailSummaryError
                ? `Se ha abierto WhatsApp con el enlace listo, pero el email resumen no se pudo enviar: ${emailSummaryError}`
                : `Se ha abierto WhatsApp con el enlace listo para ${contactName}.`
            : `Se ha enviado por email a ${contactName}.`,
      });

      setSelectedContact(null);
      setContactQuery('');
      setContactResults([]);
      setVisitDate(buildDefaultVisitDate());
      setNotes('Hoja de visita enviada para dejar constancia de asistencia. El visitante debe escribir correctamente nombre completo y DNI/NIE.');
      onOpenChange(false);
      await onCreated?.();
    } catch (error: unknown) {
      if (signUrl) {
        await navigator.clipboard.writeText(signUrl);
      }

      const fallbackMessage = createdDocument
        ? `${error instanceof Error ? error.message : 'No se pudo completar el envío.'} El enlace quedó copiado para compartirlo manualmente.`
        : error instanceof Error
          ? error.message
          : 'No se pudo crear la hoja.';
      toast({
        title: createdDocument ? 'Hoja creada pero no enviada' : 'No se pudo crear la hoja',
        description: fallbackMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear hoja de visita</DialogTitle>
          <DialogDescription>
            Relaciona la visita con un contacto y envíale un documento firmable para dejar constancia real de la visita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold">{propertyTitle}</p>
            {propertyAddress && <p className="mt-1 text-sm text-muted-foreground">{propertyAddress}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-sheet-contact">Buscar contacto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="visit-sheet-contact"
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
                className="pl-9"
                placeholder="Nombre, teléfono o email"
              />
            </div>
            {searching && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando contactos...
              </p>
            )}
            {!searching && contactQuery.trim().length >= 2 && contactResults.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay contactos con ese criterio.</p>
            )}
            {contactResults.length > 0 && (
              <div className="space-y-2 rounded-xl border p-2 max-h-56 overflow-y-auto">
                {contactResults.map((contact) => {
                  const hasWhatsapp = Boolean(contact.phone || contact.phone2);
                  const hasEmail = Boolean(contact.email);
                  const isSelected = selectedContact?.id === contact.id;

                  return (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => setSelectedContact(contact)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/40'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{contact.full_name || 'Sin nombre'}</p>
                          <p className="text-sm text-muted-foreground">
                            {contact.phone || contact.phone2 || contact.email || 'Sin canal de envío'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasWhatsapp && <Badge variant="outline" className="gap-1"><MessageCircle className="h-3 w-3" />WhatsApp</Badge>}
                          {!hasWhatsapp && hasEmail && <Badge variant="outline" className="gap-1"><Mail className="h-3 w-3" />Email</Badge>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedContact && (
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{selectedContact.full_name}</p>
                {preferredChannel === 'whatsapp' ? (
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><MessageCircle className="h-3 w-3" />Se enviará por WhatsApp</Badge>
                ) : preferredChannel === 'email' ? (
                  <Badge variant="secondary" className="gap-1"><Mail className="h-3 w-3" />Se enviará por email</Badge>
                ) : (
                  <Badge variant="destructive">Sin canal de envío</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Si tiene WhatsApp, se preparará ese envío primero. Si además tiene email, también recibirá un resumen por correo. Si no tiene WhatsApp, se enviará por email.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="visit-sheet-date">Fecha y hora prevista</Label>
              <div className="relative">
                <CalendarClock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="visit-sheet-date"
                  type="datetime-local"
                  value={visitDate}
                  onChange={(event) => setVisitDate(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Qué recibirá el cliente</Label>
              <div className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
                Un enlace a una hoja de visita firmable y, si tiene correo, un email resumen con los datos de la visita y el acceso a la firma.
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-sheet-notes">Nota interna de la visita</Label>
            <Textarea
              id="visit-sheet-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Contexto comercial o motivo de la visita"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedContact || !visitDate}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparando firma...</> : 'Crear y enviar a firma'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyVisitSheetDialog;
