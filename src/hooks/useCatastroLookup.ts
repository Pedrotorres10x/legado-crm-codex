import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCatastroLookup() {
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [calles, setCalles] = useState<string[]>([]);
  const [numeros, setNumeros] = useState<string[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [loadingCalles, setLoadingCalles] = useState(false);
  const [loadingNumeros, setLoadingNumeros] = useState(false);
  const cache = useRef<Record<string, string[]>>({});

  const fetchMunicipios = useCallback(async (provincia: string) => {
    if (!provincia || provincia.length < 2) { setMunicipios([]); return; }
    const key = `muni:${provincia.toUpperCase()}`;
    if (cache.current[key]) { setMunicipios(cache.current[key]); return; }
    
    setLoadingMunicipios(true);
    try {
      const { data, error } = await supabase.functions.invoke('catastro', {
        body: { mode: 'municipios', provincia },
      });
      if (!error && data?.municipios) {
        cache.current[key] = data.municipios;
        setMunicipios(data.municipios);
      }
    } catch { /* ignore */ }
    setLoadingMunicipios(false);
  }, []);

  const fetchCalles = useCallback(async (provincia: string, municipio: string, calle: string) => {
    if (!provincia || !municipio || !calle || calle.length < 2) { setCalles([]); return; }
    const key = `calle:${provincia}:${municipio}:${calle}`.toUpperCase();
    if (cache.current[key]) { setCalles(cache.current[key]); return; }

    setLoadingCalles(true);
    try {
      const { data, error } = await supabase.functions.invoke('catastro', {
        body: { mode: 'calles', provincia, municipio, calle },
      });
      if (!error && data?.calles) {
        cache.current[key] = data.calles;
        setCalles(data.calles);
      }
    } catch { /* ignore */ }
    setLoadingCalles(false);
  }, []);

  const fetchNumeros = useCallback(async (provincia: string, municipio: string, calle: string) => {
    if (!provincia || !municipio || !calle) { setNumeros([]); return; }
    const key = `num:${provincia}:${municipio}:${calle}`.toUpperCase();
    if (cache.current[key]) { setNumeros(cache.current[key]); return; }

    setLoadingNumeros(true);
    try {
      const { data, error } = await supabase.functions.invoke('catastro', {
        body: { mode: 'numeros', provincia, municipio, calle },
      });
      if (!error && data?.numeros) {
        cache.current[key] = data.numeros;
        setNumeros(data.numeros);
      }
    } catch { /* ignore */ }
    setLoadingNumeros(false);
  }, []);

  return { municipios, calles, numeros, loadingMunicipios, loadingCalles, loadingNumeros, fetchMunicipios, fetchCalles, fetchNumeros };
}
