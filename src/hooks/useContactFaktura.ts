import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FAKTURA_PUBLIC_URL } from '@/lib/publicUrls';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

type PropertyLike = {
  id: string;
  title?: string | null;
  address?: string | null;
  price?: number | null;
  status?: string | null;
  operation?: string | null;
  reference?: string | null;
  crm_reference?: string | null;
};

type ContactLike = {
  full_name?: string | null;
  id_number?: string | null;
  email?: string | null;
  address?: string | null;
};

type CommissionWithProperty = {
  id: string;
  agency_commission?: number | null;
  properties?: PropertyLike | null;
};

export const useContactFaktura = ({
  contactId,
  contact,
  ownedProperties,
  agentId,
  toast,
  onReload,
}: {
  contactId?: string;
  contact?: ContactLike | null;
  ownedProperties: PropertyLike[];
  agentId?: string;
  toast: ToastFn;
  onReload: () => Promise<void> | void;
}) => {
  const [fakturaDialogOpen, setFakturaDialogOpen] = useState(false);
  const [fakturaLoading, setFakturaLoading] = useState(false);
  const [fakturaProperties, setFakturaProperties] = useState<PropertyLike[]>([]);
  const [selectedFakturaProperty, setSelectedFakturaProperty] = useState<string>('');

  const openFakturaDialog = async () => {
    const props: PropertyLike[] = [...ownedProperties];
    const { data: commissions } = await supabase
      .from('commissions')
      .select('*, properties:property_id(id, title, address, price, status, operation, reference, crm_reference)')
      .or(`agent_id.eq.${agentId},listing_agent_id.eq.${agentId},buying_agent_id.eq.${agentId}`)
      .in('status', ['aprobado', 'pagado']);

    const existingIds = new Set(props.map((property) => property.id));
    ((commissions || []) as CommissionWithProperty[]).forEach((commission) => {
      if (commission.properties && !existingIds.has(commission.properties.id)) {
        props.push(commission.properties);
        existingIds.add(commission.properties.id);
      }
    });

    setFakturaProperties(props);
    setSelectedFakturaProperty(props.length === 1 ? props[0].id : '');
    setFakturaDialogOpen(true);
  };

  const handleGenerateFaktura = async () => {
    if (!contactId || !contact) return;

    setFakturaLoading(true);
    try {
      const property = selectedFakturaProperty
        ? fakturaProperties.find((item) => item.id === selectedFakturaProperty) || null
        : null;

      let newStatus = '';
      let amount = 0;
      let commissionData: CommissionWithProperty | null = null;

      if (property && selectedFakturaProperty) {
        newStatus = property.operation === 'alquiler' ? 'alquilado' : 'vendido';
        await supabase.from('properties').update({ status: newStatus }).eq('id', selectedFakturaProperty);

        const { data } = await supabase
          .from('commissions')
          .select('*')
          .eq('property_id', selectedFakturaProperty)
          .in('status', ['aprobado', 'pagado'])
          .limit(1)
          .maybeSingle();

        commissionData = data;
        amount = commissionData?.agency_commission || property.price || 0;

        await supabase.from('contact_invoices').insert({
          contact_id: contactId,
          property_id: selectedFakturaProperty,
          commission_id: commissionData?.id || null,
          agent_id: agentId,
          amount,
          concept: `${newStatus === 'alquilado' ? 'Alquiler' : 'Venta'} - ${property.title || property.address || 'Inmueble'}`,
          status: 'generada',
        });
      }

      const params = new URLSearchParams({
        contact_name: contact.full_name || '',
        contact_id_number: contact.id_number || '',
        contact_email: contact.email || '',
        contact_address: contact.address || '',
        ...(property
          ? {
              property_title: property.title || '',
              property_address: property.address || '',
              property_ref: property.reference || property.crm_reference || '',
              amount: amount.toString(),
              concept: newStatus === 'alquilado' ? 'alquiler' : 'venta',
              crm_property_id: selectedFakturaProperty,
            }
          : {}),
        crm_contact_id: contactId,
      });

      window.open(`${FAKTURA_PUBLIC_URL}/facturacion?${params.toString()}`, '_blank');

      toast({
        title: '✅ Faktura abierta',
        description: property ? `Inmueble marcado como ${newStatus}.` : 'Se ha abierto Faktura con los datos del contacto.',
      });
      setFakturaDialogOpen(false);
      await onReload();
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar la factura', variant: 'destructive' });
    }
    setFakturaLoading(false);
  };

  return {
    fakturaDialogOpen,
    setFakturaDialogOpen,
    fakturaLoading,
    fakturaProperties,
    selectedFakturaProperty,
    setSelectedFakturaProperty,
    openFakturaDialog,
    handleGenerateFaktura,
  };
};
