import { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notifyERP } from '@/lib/erp-sync';

export type ContactCreateForm = {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  contact_type: string;
  notes: string;
  id_number: string;
  nationality: string;
  birth_date: string;
  budget_min: string;
  budget_max: string;
  desired_bedrooms: string;
  desired_surface: string;
  desired_cities: string;
  desired_zones: string;
  desired_property_type: string;
  desired_operation: string;
  property_address: string;
  estimated_price: string;
  property_type: string;
  source_url: string;
  source_ref: string;
};

export const EMPTY_CONTACT_CREATE_FORM: ContactCreateForm = {
  full_name: '',
  email: '',
  phone: '',
  city: '',
  contact_type: '',
  notes: '',
  id_number: '',
  nationality: '',
  birth_date: '',
  budget_min: '',
  budget_max: '',
  desired_bedrooms: '',
  desired_surface: '',
  desired_cities: '',
  desired_zones: '',
  desired_property_type: 'piso',
  desired_operation: 'venta',
  property_address: '',
  estimated_price: '',
  property_type: 'piso',
  source_url: '',
  source_ref: '',
};

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

type Params = {
  userId?: string;
  toast: ToastFn;
  onCreated: () => Promise<void> | void;
};

export const useContactCreate = ({ userId, toast, onCreated }: Params) => {
  const [loading, setLoading] = useState(false);

  const emptyForm = useMemo<ContactCreateForm>(() => ({ ...EMPTY_CONTACT_CREATE_FORM }), []);

  const createContact = useCallback(async (form: ContactCreateForm, formTags: string[]) => {
    setLoading(true);

    const defaultStage =
      form.contact_type === 'comprador'
        ? 'nuevo'
        : form.contact_type === 'colaborador'
          ? 'activo'
          : form.contact_type === 'contacto'
            ? 'nuevo'
            : form.contact_type === 'propietario'
              ? 'captado'
              : 'prospecto';

    const { data: contactData, error } = await supabase.from('contacts').insert([{
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      city: form.city || null,
      contact_type: form.contact_type as any,
      notes: form.notes || null,
      agent_id: userId,
      pipeline_stage: defaultStage,
      id_number: form.id_number || null,
      nationality: form.nationality || null,
      birth_date: form.birth_date || null,
      tags: formTags.length > 0 ? formTags : [],
      source_url: form.source_url || null,
      source_ref: form.source_ref || null,
    } as any]).select().single();

    if (error) {
      setLoading(false);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return { ok: false as const };
    }

    if (form.contact_type === 'comprador' && contactData) {
      const citiesArray = form.desired_cities ? form.desired_cities.split(',').map((value) => value.trim()).filter(Boolean) : [];
      const zonesArray = form.desired_zones ? form.desired_zones.split(',').map((value) => value.trim()).filter(Boolean) : [];
      await supabase.from('demands').insert([{
        contact_id: contactData.id,
        property_type: form.desired_property_type as any,
        operation: form.desired_operation as any,
        min_price: form.budget_min ? parseFloat(form.budget_min) : null,
        max_price: form.budget_max ? parseFloat(form.budget_max) : null,
        min_bedrooms: form.desired_bedrooms ? parseInt(form.desired_bedrooms) : null,
        min_surface: form.desired_surface ? parseFloat(form.desired_surface) : null,
        cities: citiesArray,
        zones: zonesArray,
      }]);
    }

    toast({ title: 'Contacto añadido' });

    if (contactData) {
      notifyERP('contact_created', {
        contact_id: contactData.id,
        full_name: contactData.full_name,
        email: contactData.email,
        phone: contactData.phone,
        contact_type: contactData.contact_type,
        city: contactData.city,
      });
    }

    await onCreated();
    setLoading(false);
    return { ok: true as const, contactId: contactData?.id as string | undefined };
  }, [onCreated, toast, userId]);

  return {
    emptyForm,
    loading,
    createContact,
  };
};
