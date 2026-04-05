import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const fixCatastroFloorDoor = (planta: string, puerta: string): { floor_number: string; door: string } => {
  const numPlanta = parseInt(planta || '0');
  if (numPlanta <= 50) return { floor_number: planta, door: puerta };
  for (let cut = 1; cut <= 2; cut++) {
    const newFloor = planta.slice(0, -cut);
    const newDoor = planta.slice(-cut) + (puerta || '');
    if (newFloor && parseInt(newFloor) <= 50) {
      return { floor_number: newFloor, door: newDoor };
    }
  }
  return { floor_number: planta, door: puerta };
};

const usoMap: Record<string, string> = {
  Residencial: 'piso',
  Vivienda: 'piso',
  Local: 'local',
  Oficina: 'oficina',
  Industrial: 'nave',
  Garaje: 'garaje',
  Almacén: 'trastero',
  Comercial: 'local',
};

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

type UsePropertyCatastroParams = {
  id?: string;
  property: {
    reference?: string | null;
    province?: string | null;
    city?: string | null;
    address?: string | null;
  } | null;
  toast: ToastFn;
  onPropertyRefresh: () => Promise<void> | void;
  onSyncSnapshot: (reference: string, catastroData: Record<string, string | number>) => Promise<void>;
};

type CatastroCandidate = {
  rc: string;
  superficie?: string | number | null;
  escalera?: string | null;
  planta?: string | null;
  puerta?: string | null;
  uso?: string | null;
};

type CatastroReferenceDetails = {
  municipio?: string | null;
  provincia?: string | null;
  address?: string | null;
  zip_code?: string | null;
  floor?: string | null;
  superficie?: number | null;
  uso?: string | null;
  property_type?: string | null;
};

type CatastroLookupResponse = {
  error?: string;
  found?: boolean;
  results?: CatastroCandidate[];
  data?: CatastroReferenceDetails;
};

export const usePropertyCatastro = ({
  id,
  property,
  toast,
  onPropertyRefresh,
  onSyncSnapshot,
}: UsePropertyCatastroParams) => {
  const [catastroLoading, setCatastroLoading] = useState(false);
  const [catastroResults, setCatastroResults] = useState<CatastroCandidate[]>([]);
  const [catastroDialogOpen, setCatastroDialogOpen] = useState(false);
  const [referenceInput, setReferenceInput] = useState('');
  const [savingRef, setSavingRef] = useState(false);

  useEffect(() => {
    setReferenceInput(property?.reference || '');
  }, [property?.reference]);

  const applyReferenceCandidate = useCallback(async (candidate: CatastroCandidate) => {
    if (!id) return;

    const updates: Record<string, string | number> = { reference: candidate.rc };
    if (candidate.superficie) updates.surface_area = parseInt(candidate.superficie);
    if (candidate.escalera) updates.staircase = candidate.escalera;
    if (candidate.planta || candidate.puerta) {
      const fixed = fixCatastroFloorDoor(candidate.planta || '', candidate.puerta || '');
      if (fixed.floor_number) updates.floor_number = fixed.floor_number;
      if (fixed.door) updates.door = fixed.door;
    }
    if (candidate.uso && usoMap[candidate.uso]) {
      updates.property_type = usoMap[candidate.uso];
    }

    await supabase.from('properties').update(updates).eq('id', id);
    await onPropertyRefresh();
    await onSyncSnapshot(candidate.rc, {
      Superficie: candidate.superficie ? `${candidate.superficie} m²` : '',
      Planta: candidate.planta || '',
      Puerta: candidate.puerta || '',
      Escalera: candidate.escalera || '',
      Uso: candidate.uso || '',
    });
  }, [id, onPropertyRefresh, onSyncSnapshot]);

  const lookupByAddress = useCallback(async () => {
    if (!property?.province || !property?.city || !property?.address) return;

    setCatastroLoading(true);
    try {
      const addressMatch = property.address?.match(/^(.+?)\s*,?\s*(\d+)\s*$/);
      const calle = addressMatch ? addressMatch[1] : property.address || '';
      const numero = addressMatch ? addressMatch[2] : '1';

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/catastro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          provincia: property.province,
          municipio: property.city,
          calle,
          numero,
        }),
      });

      const data = (await resp.json()) as CatastroLookupResponse;
      if (data.error && (!data.results || data.results.length === 0)) {
        toast({ title: 'Catastro', description: data.error, variant: 'destructive' });
      } else if (data.results?.length === 1) {
        setReferenceInput(data.results[0].rc);
        await applyReferenceCandidate(data.results[0]);
        toast({ title: 'Referencia encontrada y datos aplicados ✅' });
      } else if (data.results?.length > 1) {
        setCatastroResults(data.results);
        setCatastroDialogOpen(true);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo conectar con Catastro', variant: 'destructive' });
    }
    setCatastroLoading(false);
  }, [applyReferenceCandidate, property?.address, property?.city, property?.province, toast]);

  const lookupByReference = useCallback(async () => {
    if (!id || !referenceInput || referenceInput.length < 14) return;

    setCatastroLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/catastro`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ rc: referenceInput }),
      });

      const data = (await resp.json()) as CatastroLookupResponse;
      if (data.error) {
        toast({ title: 'Catastro', description: data.error, variant: 'destructive' });
      } else if (data.found) {
        const details = data.data;
        const updates: Record<string, string | number> = { reference: referenceInput };
        if (details.municipio) updates.city = details.municipio;
        if (details.provincia) updates.province = details.provincia;
        if (details.address) updates.address = details.address;
        if (details.zip_code) updates.zip_code = details.zip_code;
        if (details.floor) updates.floor_number = details.floor;
        if (details.superficie) updates.surface_area = details.superficie;
        if (details.property_type) updates.property_type = details.property_type;

        await supabase.from('properties').update(updates).eq('id', id);
        await onPropertyRefresh();
        await onSyncSnapshot(referenceInput, {
          Provincia: details.provincia,
          Municipio: details.municipio,
          Dirección: details.address,
          'Código Postal': details.zip_code,
          Planta: details.floor,
          'Superficie (m²)': details.superficie,
          Uso: details.uso,
          'Tipo inmueble': details.property_type,
        });
        toast({ title: 'Datos del catastro aplicados ✅', description: `${details.address}, ${details.municipio}` });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo conectar con Catastro', variant: 'destructive' });
    }
    setCatastroLoading(false);
  }, [id, onPropertyRefresh, onSyncSnapshot, referenceInput, toast]);

  const saveReference = useCallback(async () => {
    if (!id) return;

    setSavingRef(true);
    await supabase.from('properties').update({ reference: referenceInput || null }).eq('id', id);
    toast({ title: 'Referencia guardada' });
    setSavingRef(false);
    await onPropertyRefresh();
  }, [id, onPropertyRefresh, referenceInput, toast]);

  const selectCatastroResult = useCallback(async (candidate: CatastroCandidate) => {
    setReferenceInput(candidate.rc);
    setCatastroDialogOpen(false);
    await applyReferenceCandidate(candidate);
    toast({ title: 'Referencia seleccionada y datos aplicados ✅' });
  }, [applyReferenceCandidate, toast]);

  return {
    catastroLoading,
    catastroResults,
    catastroDialogOpen,
    setCatastroDialogOpen,
    referenceInput,
    setReferenceInput,
    savingRef,
    lookupByAddress,
    lookupByReference,
    saveReference,
    selectCatastroResult,
  };
};
