import { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ocrDemandScreenshot, prepareDemandScreenshot } from '@/lib/demandScreenshot';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

export type DemandForm = {
  property_type: string;
  operation: string;
  min_price: string;
  max_price: string;
  min_surface: string;
  min_bedrooms: string;
  notes: string;
  cities: string;
  zones: string;
};

type DemandRow = {
  id: string;
  property_type?: string | null;
  operation?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  min_surface?: number | null;
  min_bedrooms?: number | null;
  notes?: string | null;
  cities?: string[] | null;
  zones?: string[] | null;
};

type DemandExtractResponse = {
  ok?: boolean;
  error?: string;
  extracted?: {
    property_type?: string;
    operation?: string;
    min_price?: number;
    max_price?: number;
    min_surface?: number;
    min_bedrooms?: number;
    notes?: string;
    cities?: string[];
    zones?: string[];
    summary?: string;
  };
};

const EMPTY_DEMAND_FORM: DemandForm = {
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
  const [demandExtracting, setDemandExtracting] = useState(false);

  const emptyDemandForm = useMemo(() => ({ ...EMPTY_DEMAND_FORM }), []);

  const openNewDemand = () => {
    setDemandEditId(null);
    setDemandForm(emptyDemandForm);
    setDemandDialogOpen(true);
  };

  const openEditDemand = (demand: DemandRow) => {
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
      property_type: demandForm.property_type || null,
      operation: demandForm.operation,
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

  const extractDemandFromScreenshot = async (file: File) => {
    setDemandExtracting(true);

      try {
        const prepared = await prepareDemandScreenshot(file);
        const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        };

        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const sendExtractRequest = (rawText?: string) =>
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-demand-screenshot-extract`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              image_base64: prepared.base64,
              mime_type: prepared.mimeType,
              file_name: prepared.fileName,
              raw_text: rawText,
            }),
          });

        let response = await sendExtractRequest();
        let data = (await response.json().catch(() => ({}))) as DemandExtractResponse;

        const shouldRetryWithOcr =
          response.status === 429 ||
          String(data?.error || '').toLowerCase().includes('límite de peticiones') ||
          String(data?.error || '').toLowerCase().includes('limite de peticiones');

        if ((!response.ok || !data?.ok) && shouldRetryWithOcr) {
          const rawText = await ocrDemandScreenshot(file);
          if (rawText) {
            response = await sendExtractRequest(rawText);
            data = (await response.json().catch(() => ({}))) as DemandExtractResponse;
          }
        }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Error ${response.status} extrayendo la demanda`);
      }

      const extracted = data.extracted || {};
      setDemandForm((current) => ({
        ...current,
        property_type: extracted.property_type || current.property_type,
        operation: extracted.operation || current.operation || 'venta',
        min_price: extracted.min_price ? String(extracted.min_price) : current.min_price,
        max_price: extracted.max_price ? String(extracted.max_price) : current.max_price,
        min_surface: extracted.min_surface ? String(extracted.min_surface) : current.min_surface,
        min_bedrooms: extracted.min_bedrooms ? String(extracted.min_bedrooms) : current.min_bedrooms,
        notes: extracted.notes || current.notes,
        cities: extracted.cities?.length ? extracted.cities.join(', ') : current.cities,
        zones: extracted.zones?.length ? extracted.zones.join(', ') : current.zones,
      }));

      toast({
        title: 'Demanda rellenada desde pantallazo',
        description: extracted.summary || 'Revisa los datos y guarda cuando quieras.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo leer el pantallazo',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setDemandExtracting(false);
    }
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
    demandExtracting,
    emptyDemandForm,
    openNewDemand,
    openEditDemand,
    handleDemandSubmit,
    extractDemandFromScreenshot,
    toggleDemandActive,
    deleteDemand,
  };
};
