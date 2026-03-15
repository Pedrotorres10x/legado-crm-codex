import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/integrations/supabase/client';

type PostSaleInvoice = {
  id: string;
  status?: string | null;
  amount?: number | null;
  created_at?: string | null;
};

type PostSaleCommission = {
  id: string;
  status?: string | null;
  agency_commission?: number | null;
};

const PAID_INVOICE_STATUSES = ['pagada', 'cobrada', 'abonada'];

export const useClosingPostSale = ({
  propertyId,
  propertyStatus,
}: {
  propertyId?: string;
  propertyStatus?: string | null;
}) => {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<PostSaleInvoice[]>([]);
  const [commission, setCommission] = useState<PostSaleCommission | null>(null);

  useEffect(() => {
    let cancelled = false;

    const isClosed = propertyStatus === 'vendido' || propertyStatus === 'alquilado';
    if (!propertyId || !isClosed) {
      setInvoices([]);
      setCommission(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      const [{ data: commissionRow }, { data: invoiceRows }] = await Promise.all([
        supabase
          .from('commissions')
          .select('id, status, agency_commission')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('contact_invoices')
          .select('id, status, amount, created_at')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      setCommission((commissionRow as PostSaleCommission | null) || null);
      setInvoices((invoiceRows as PostSaleInvoice[]) || []);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [propertyId, propertyStatus]);

  const summary = useMemo(() => {
    const paidInvoices = invoices.filter((invoice) => PAID_INVOICE_STATUSES.includes((invoice.status || '').toLowerCase()));
    const pendingInvoices = invoices.filter((invoice) => !PAID_INVOICE_STATUSES.includes((invoice.status || '').toLowerCase()));
    const totalAmount = invoices.reduce((sum, invoice) => sum + (invoice.amount || 0), 0);
    const commissionAmount = commission?.agency_commission || 0;
    const closed = propertyStatus === 'vendido' || propertyStatus === 'alquilado';

    const label = !closed
      ? 'Aun no aplica postventa'
      : invoices.length === 0
        ? 'Facturación final pendiente'
        : pendingInvoices.length > 0
          ? 'Cobro o factura pendiente'
          : 'Postventa al día';

    const tone = !closed
      ? 'secondary'
      : invoices.length === 0 || pendingInvoices.length > 0
        ? 'destructive'
        : 'default';

    const nextAction = !closed
      ? 'Cerrar la operación para abrir el bloque postventa.'
      : invoices.length === 0
        ? 'Generar factura final o abrir Faktura desde el contacto comprador/vendedor.'
        : pendingInvoices.length > 0
          ? 'Revisar cobro y cerrar facturas pendientes de la operación.'
          : 'Postventa y cobro sin alertas visibles.';

    return {
      closed,
      label,
      tone,
      hasCommission: Boolean(commission),
      commissionStatus: commission?.status || null,
      commissionAmount,
      invoicesCount: invoices.length,
      paidInvoicesCount: paidInvoices.length,
      pendingInvoicesCount: pendingInvoices.length,
      totalAmount,
      nextAction,
    };
  }, [commission, invoices, propertyStatus]);

  return {
    loading,
    invoices,
    commission,
    summary,
  };
};
