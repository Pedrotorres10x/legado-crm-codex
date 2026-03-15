import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

const EMPTY_DEMAND_FORM = {
  property_type: '',
  operation: 'venta',
  min_price: '',
  max_price: '',
  min_surface: '',
  min_bedrooms: '',
  notes: '',
  cities: '',
  zones: '',
};

const parseList = (value: string): string[] => value.split(',').map((item) => item.trim()).filter(Boolean);

export const useContactDemands = ({
  contactId,
  toast,
  onReload,
}: {
  contactId?: string;
  toast: ToastFn;
  onReload: () => Promise<void> | void;
}) => {
  const [demandDialogOpen, setDemandDialogOpen] = useState(false);
  const [demandEditId, setDemandEditId] = useState<string | null>(null);
  const [demandForm, setDemandForm] = useState(EMPTY_DEMAND_FORM);
  const [demandSaving, setDemandSaving] = useState(false);

  const emptyDemandForm = useMemo(() => ({ ...EMPTY_DEMAND_FORM }), []);

  const openNewDemand = () => {
    setDemandEditId(null);
    setDemandForm(emptyDemandForm);
    setDemandDialogOpen(true);
  };

  const openEditDemand = (demand: any) => {
    setDemandEditId(demand.id);
    setDemandForm({
      property_type: demand.property_type || '',
      operation: demand.operation || 'venta',
      min_price: demand.min_price?.toString() || '',
      max_price: demand.max_price?.toString() || '',
      min_surface: demand.min_surface?.toString() || '',
      min_bedrooms: demand.min_bedrooms?.toString() || '',
      notes: demand.notes || '',
      cities: (demand.cities || []).join(', '),
      zones: (demand.zones || []).join(', '),
    });
    setDemandDialogOpen(true);
  };

  const handleDemandSubmit = async () => {
    if (!contactId) return;

    setDemandSaving(true);
    const payload = {
      contact_id: contactId,
      property_type: (demandForm.property_type || null) as any,
      operation: demandForm.operation as any,
      min_price: demandForm.min_price ? parseFloat(demandForm.min_price) : null,
      max_price: demandForm.max_price ? parseFloat(demandForm.max_price) : null,
      min_surface: demandForm.min_surface ? parseFloat(demandForm.min_surface) : null,
      min_bedrooms: demandForm.min_bedrooms ? parseInt(demandForm.min_bedrooms) : null,
      notes: demandForm.notes || null,
      cities: parseList(demandForm.cities),
      zones: parseList(demandForm.zones),
    };

    const { error } = demandEditId
      ? await supabase.from('demands').update(payload).eq('id', demandEditId)
      : await supabase.from('demands').insert([payload]);

    setDemandSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: demandEditId ? 'Demanda actualizada' : 'Demanda creada' });
    setDemandDialogOpen(false);
    await onReload();
  };

  const toggleDemandActive = async (demandId: string, current: boolean) => {
    await supabase.from('demands').update({ is_active: !current }).eq('id', demandId);
    await onReload();
  };

  const deleteDemand = async (demandId: string) => {
    const { error } = await supabase.from('demands').delete().eq('id', demandId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Demanda eliminada' });
    await onReload();
  };

  return {
    demandDialogOpen,
    setDemandDialogOpen,
    demandEditId,
    demandForm,
    setDemandForm,
    demandSaving,
    emptyDemandForm,
    openNewDemand,
    openEditDemand,
    handleDemandSubmit,
    toggleDemandActive,
    deleteDemand,
  };
};
