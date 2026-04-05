import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { useToast } from '@/hooks/use-toast';

type ToastFn = ReturnType<typeof useToast>['toast'];

type ContactLike = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  phone2?: string | null;
  address?: string | null;
  city?: string | null;
  contact_type?: string | null;
  status?: string | null;
  pipeline_stage?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  id_number?: string | null;
  nationality?: string | null;
  birth_date?: string | null;
  purchase_date?: string | null;
  sale_date?: string | null;
};

export const useContactEdit = ({
  contactId,
  contact,
  toast,
  onReload,
}: {
  contactId?: string;
  contact: ContactLike | null;
  toast: ToastFn;
  onReload: () => void;
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ContactLike>>({});
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const openEdit = () => {
    if (!contact) return;
    setEditForm({ ...contact });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!contactId) return;

    setSaving(true);
    const { error } = await supabase.from('contacts').update({
      full_name: editForm.full_name,
      email: editForm.email || null,
      phone: editForm.phone || null,
      phone2: editForm.phone2 || null,
      address: editForm.address || null,
      city: editForm.city || null,
      contact_type: editForm.contact_type,
      status: editForm.status,
      pipeline_stage: editForm.pipeline_stage || 'nuevo',
      notes: editForm.notes || null,
      tags: editForm.tags || [],
      id_number: editForm.id_number || null,
      nationality: editForm.nationality || null,
      birth_date: editForm.birth_date || null,
      purchase_date: editForm.purchase_date || null,
      sale_date: editForm.sale_date || null,
    }).eq('id', contactId);
    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    import('@/lib/erp-sync').then(({ notifyERP }) => {
      notifyERP('contact_updated', {
        contact_id: contactId,
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        contact_type: editForm.contact_type,
        city: editForm.city,
        pipeline_stage: editForm.pipeline_stage,
        tags: editForm.tags,
      });
    });

    toast({ title: 'Contacto actualizado' });
    setEditOpen(false);
    onReload();
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !(editForm.tags || []).includes(tag)) {
      setEditForm({ ...editForm, tags: [...(editForm.tags || []), tag] });
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setEditForm({ ...editForm, tags: (editForm.tags || []).filter((currentTag: string) => currentTag !== tag) });
  };

  return {
    editOpen,
    setEditOpen,
    editForm,
    setEditForm,
    saving,
    tagInput,
    setTagInput,
    openEdit,
    handleSave,
    addTag,
    removeTag,
  };
};
