import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

type VisitForm = {
  property_id: string;
  contact_id: string;
  visit_date: string;
  notes: string;
};

type OfferForm = {
  property_id: string;
  contact_id: string;
  amount: string;
  notes: string;
};

type OfferResolutionDialog = {
  offerId: string;
  nextStatus: string;
  currentNotes: string | null;
} | null;

const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const useMatchesActions = ({
  userId,
  toast,
  onRefresh,
}: {
  userId?: string;
  toast: ToastFn;
  onRefresh: () => Promise<void> | void;
}) => {
  const [visitDialog, setVisitDialog] = useState(false);
  const [offerDialog, setOfferDialog] = useState(false);
  const [sendDialog, setSendDialog] = useState<any>(null);
  const [offerResolutionDialog, setOfferResolutionDialog] = useState<OfferResolutionDialog>(null);
  const [offerLossReason, setOfferLossReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [visitForm, setVisitForm] = useState<VisitForm>({
    property_id: '',
    contact_id: '',
    visit_date: '',
    notes: '',
  });
  const [offerForm, setOfferForm] = useState<OfferForm>({
    property_id: '',
    contact_id: '',
    amount: '',
    notes: '',
  });

  const getConfirmUrl = (token: string) => `${window.location.origin}/visita/${token}`;

  const addVisit = async () => {
    if (!visitForm.notes.trim() || visitForm.notes.trim().length < 10) {
      toast({
        title: 'Falta contexto de la visita',
        description: 'Añade objetivo o siguiente paso para que la visita no quede vacía en la lectura comercial.',
        variant: 'destructive',
      });
      return;
    }

    setFormLoading(true);
    const token = generateToken();
    const { data, error } = await supabase
      .from('visits')
      .insert({
        ...visitForm,
        agent_id: userId,
        confirmation_token: token,
        confirmation_status: 'pendiente',
      } as any)
      .select('*, properties(title), contacts(full_name, phone, email)')
      .single();
    setFormLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Visita programada' });

    if (data) {
      import('@/lib/erp-sync').then(({ notifyERP }) => {
        notifyERP('visit_scheduled', {
          visit_id: data.id,
          contact_name: data.contacts?.full_name || '',
          contact_email: data.contacts?.email,
          contact_phone: data.contacts?.phone,
          property_title: data.properties?.title || '',
          visit_date: data.visit_date,
        });
      });
    }

    setVisitDialog(false);
    setVisitForm({ property_id: '', contact_id: '', visit_date: '', notes: '' });
    await onRefresh();
    if (data) {
      setSendDialog(data);
    }
  };

  const updateVisitResult = async (id: string, result: string) => {
    await supabase.from('visits').update({ result }).eq('id', id);
    await onRefresh();
  };

  const sendVisitWhatsApp = async (visit: any) => {
    const contactId = visit.contact_id;
    if (!contactId) {
      toast({
        title: 'Sin contacto',
        description: 'No se pudo identificar el contacto',
        variant: 'destructive',
      });
      return;
    }

    const url = getConfirmUrl(visit.confirmation_token);
    const date = format(new Date(visit.visit_date), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
    const msg = `Hola ${visit.contacts?.full_name}, tienes una visita programada para el ${date} en ${visit.properties?.title}.\n\nPor favor, confirma tu asistencia aquí:\n${url}`;

    try {
      const { data, error } = await supabase.functions.invoke('multichannel-send', {
        body: { channel: 'whatsapp', contact_id: contactId, text: msg, source: 'visit_confirmation' },
      });
      if (error || !data?.ok) {
        throw new Error(data?.error || error?.message || 'Error enviando WhatsApp');
      }
      toast({
        title: '✅ WhatsApp enviado',
        description: `Confirmación enviada a ${visit.contacts?.full_name}`,
      });
    } catch (error: any) {
      toast({ title: 'Error WhatsApp', description: error.message, variant: 'destructive' });
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getConfirmUrl(token));
    toast({ title: 'Enlace copiado' });
  };

  const addOffer = async () => {
    if (!offerForm.notes.trim() || offerForm.notes.trim().length < 10) {
      toast({
        title: 'Falta contexto de la oferta',
        description: 'Explica situación comercial o siguiente paso antes de registrar la oferta.',
        variant: 'destructive',
      });
      return;
    }

    setFormLoading(true);
    const { error } = await supabase.from('offers').insert({
      ...offerForm,
      amount: parseFloat(offerForm.amount),
      status: 'presentada',
      agent_id: userId,
    });
    setFormLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Oferta registrada' });
    setOfferDialog(false);
    setOfferForm({ property_id: '', contact_id: '', amount: '', notes: '' });
    await onRefresh();
  };

  const buildOfferNotes = (currentNotes: string | null, lossReason?: string) => {
    const cleanLines = (currentNotes || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('Motivo de pérdida:'));

    if (lossReason) {
      cleanLines.push(`Motivo de pérdida: ${lossReason}`);
    }

    return cleanLines.length > 0 ? cleanLines.join('\n') : null;
  };

  const requestOfferStatusChange = (offer: { id: string; status?: string | null; notes?: string | null }, nextStatus: string) => {
    if (['rechazada', 'retirada', 'expirada'].includes(nextStatus)) {
      setOfferResolutionDialog({
        offerId: offer.id,
        nextStatus,
        currentNotes: offer.notes || null,
      });
      setOfferLossReason('');
      return;
    }

    void updateOfferStatus(offer.id, nextStatus);
  };

  const updateOfferStatus = async (id: string, status: string, lossReason?: string) => {
    setFormLoading(true);
    const payload: Record<string, any> = { status };

    if (['aceptada', 'rechazada', 'retirada'].includes(status)) {
      payload.response_date = new Date().toISOString();
    }

    if (offerResolutionDialog?.offerId === id) {
      payload.notes = buildOfferNotes(offerResolutionDialog.currentNotes, lossReason);
    }

    const { error } = await supabase.from('offers').update(payload).eq('id', id);
    setFormLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setOfferResolutionDialog(null);
    setOfferLossReason('');
    await onRefresh();
  };

  return {
    visitDialog,
    setVisitDialog,
    offerDialog,
    setOfferDialog,
    offerResolutionDialog,
    setOfferResolutionDialog,
    offerLossReason,
    setOfferLossReason,
    sendDialog,
    setSendDialog,
    formLoading,
    visitForm,
    setVisitForm,
    offerForm,
    setOfferForm,
    addVisit,
    updateVisitResult,
    sendVisitWhatsApp,
    copyLink,
    addOffer,
    updateOfferStatus,
    requestOfferStatusChange,
  };
};
