import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // Mode: List municipalities for a province
    if (body.mode === 'municipios') {
      const provincia = body.provincia?.trim();
      if (!provincia) {
        return new Response(JSON.stringify({ error: "Se requiere provincia" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const url = `https://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccallejero.asmx/ConsultaMunicipio?Provincia=${encodeURIComponent(provincia)}&Municipio=`;
      console.log("Catastro municipios URL:", url);
      const response = await fetch(url);
      const xmlText = await response.text();
      console.log("Catastro municipios response (first 500):", xmlText.substring(0, 500));
      
      const municipios: string[] = [];
      // Extract municipality names from <nm> tags inside <muni> blocks
      const muniRegex = /<muni>[\s\S]*?<\/muni>/g;
      const muniMatches = xmlText.match(muniRegex) || [];
      for (const m of muniMatches) {
        const nm = m.match(/<nm>(.*?)<\/nm>/)?.[1] || "";
        if (nm) municipios.push(nm);
      }
      // If no muni blocks found, try direct nm extraction
      if (municipios.length === 0) {
        const nmRegex = /<nm>(.*?)<\/nm>/g;
        let match;
        while ((match = nmRegex.exec(xmlText)) !== null) {
          if (match[1]) municipios.push(match[1]);
        }
      }
      
      return new Response(JSON.stringify({ municipios }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode: List streets for a province+municipality
    if (body.mode === 'calles') {
      const { provincia, municipio, calle } = body;
      if (!provincia || !municipio) {
        return new Response(JSON.stringify({ error: "Se requiere provincia y municipio" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const url = `https://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccallejero.asmx/ConsultaVia?Provincia=${encodeURIComponent(provincia)}&Municipio=${encodeURIComponent(municipio)}&TipoVia=&NombreVia=${encodeURIComponent(calle || '')}`;
      console.log("Catastro calles URL:", url);
      const response = await fetch(url);
      const xmlText = await response.text();
      console.log("Catastro calles response (first 500):", xmlText.substring(0, 500));
      
      const calles: string[] = [];
      const calleRegex = /<calle>[\s\S]*?<\/calle>/g;
      const calleMatches = xmlText.match(calleRegex) || [];
      for (const c of calleMatches) {
        const tv = c.match(/<tv>(.*?)<\/tv>/)?.[1] || "";
        let nv = c.match(/<nv>(.*?)<\/nv>/)?.[1] || "";
        // Strip " en MUNICIPIO" suffix
        nv = nv.replace(/\s+en\s+.*$/i, '').trim();
        if (nv) calles.push(`${tv} ${nv}`.trim());
      }
      
      return new Response(JSON.stringify({ calles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode: List house numbers for a street
    if (body.mode === 'numeros') {
      const { provincia, municipio, calle } = body;
      if (!provincia || !municipio || !calle) {
        return new Response(JSON.stringify({ error: "Se requiere provincia, municipio y calle" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Parse street type prefix
      const viaTypes = ['CL','AV','PZ','PS','CR','CM','RD','TR','UR','PJ','GL','AL','RB','CO','CT','BV','PG','DS','SD','AC','ML','EC','PR','CS','PQ','BR','VR','CN','GR','AG','CC','PT','PL','FC','LG'];
      let tipoVia = '';
      let nomVia = calle.trim();
      const parts = calle.trim().split(/\s+/);
      if (parts.length > 1 && viaTypes.includes(parts[0].toUpperCase())) {
        tipoVia = parts[0].toUpperCase();
        nomVia = parts.slice(1).join(' ');
      }
      const url = `https://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccallejero.asmx/ConsultaNumero?Provincia=${encodeURIComponent(provincia)}&Municipio=${encodeURIComponent(municipio)}&TipoVia=${encodeURIComponent(tipoVia)}&NomVia=${encodeURIComponent(nomVia)}&Numero=`;
      console.log("Catastro numeros URL:", url);
      const response = await fetch(url);
      const xmlText = await response.text();
      console.log("Catastro numeros response (first 500):", xmlText.substring(0, 500));

      const numeros: string[] = [];
      const neroRegex = /<nump>[\s\S]*?<\/nump>/g;
      const neroMatches = xmlText.match(neroRegex) || [];
      for (const n of neroMatches) {
        const pnp = n.match(/<pnp>(.*?)<\/pnp>/)?.[1]?.trim() || "";
        if (pnp && !numeros.includes(pnp)) numeros.push(pnp);
      }
      // Fallback: try extracting <pnp> directly
      if (numeros.length === 0) {
        const pnpRegex = /<pnp>(.*?)<\/pnp>/g;
        let match;
        while ((match = pnpRegex.exec(xmlText)) !== null) {
          const v = match[1]?.trim();
          if (v && !numeros.includes(v)) numeros.push(v);
        }
      }

      return new Response(JSON.stringify({ numeros }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 1: Lookup by RC (referencia catastral)
    if (body.rc) {
      const rc = body.rc.trim();
      if (rc.length < 14) {
        return new Response(JSON.stringify({ error: "La referencia catastral debe tener al menos 14 caracteres" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = `https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPRC?Provincia=&Municipio=&RC=${encodeURIComponent(rc)}`;
      console.log("Catastro RC URL:", url);

      const response = await fetch(url);
      const xmlText = await response.text();
      console.log("Catastro RC response:", xmlText.substring(0, 800));

      // Extract address data
      const provincia = xmlText.match(/<np>(.*?)<\/np>/)?.[1] || "";
      const municipio = xmlText.match(/<nm>(.*?)<\/nm>/)?.[1] || "";
      const calle = xmlText.match(/<tv>(.*?)<\/tv>/)?.[1] || "";
      const calleNombre = xmlText.match(/<nv>(.*?)<\/nv>/)?.[1] || "";
      const numero = xmlText.match(/<pnp>(.*?)<\/pnp>/)?.[1] || "";
      const cp = xmlText.match(/<dp>(.*?)<\/dp>/)?.[1] || "";
      const planta = xmlText.match(/<plt>(.*?)<\/plt>/)?.[1] || xmlText.match(/<pt>(.*?)<\/pt>/)?.[1] || "";
      const puerta = xmlText.match(/<pta>(.*?)<\/pta>/)?.[1] || xmlText.match(/<pu>(.*?)<\/pu>/)?.[1] || "";
      const escalera = xmlText.match(/<es>(.*?)<\/es>/)?.[1] || "";
      const bloque = xmlText.match(/<bl>(.*?)<\/bl>/)?.[1] || "";
      const uso = xmlText.match(/<luso>(.*?)<\/luso>/)?.[1] || "";
      const superficie = xmlText.match(/<sfc>(.*?)<\/sfc>/)?.[1] || "";

      // Check for errors
      const errorMsg = xmlText.match(/<des>(.*?)<\/des>/)?.[1];
      if (!calleNombre && errorMsg) {
        return new Response(JSON.stringify({ error: errorMsg }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const address = `${calle} ${calleNombre}${numero ? ' ' + numero : ''}`.trim();
      const floor = [escalera ? `Esc. ${escalera}` : '', bloque ? `Bl. ${bloque}` : '', planta, puerta].filter(Boolean).join(' ').trim();

      // Map uso to property type
      const usoMap: Record<string, string> = {
        'Residencial': 'piso', 'Vivienda': 'piso', 'Local': 'local', 'Oficina': 'oficina',
        'Industrial': 'nave', 'Garaje': 'garaje', 'Almacén': 'trastero', 'Comercial': 'local',
      };
      const property_type = usoMap[uso] || '';

      return new Response(JSON.stringify({
        found: true,
        data: {
          provincia,
          municipio,
          address,
          zip_code: cp,
          floor,
          planta,
          puerta,
          escalera,
          bloque,
          superficie: superficie ? parseInt(superficie) : null,
          uso,
          property_type,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2: Lookup by address (original flow)
    const { provincia, municipio, calle, numero } = body;

    if (!provincia || !municipio || !calle || !numero) {
      return new Response(JSON.stringify({ error: "Se requiere provincia, municipio, calle y número" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse street type prefix (e.g. "CL LUZ LA" → Sigla="CL", Calle="LUZ LA")
    const viaTypes = ['CL','AV','PZ','PS','CR','CM','RD','TR','UR','PJ','GL','AL','RB','CO','CT','BV','PG','DS','SD','AC','ML','EC','PR','CS','PQ','BR','VR','CN','GR','AG','CC','PT','PL','FC','LG'];
    let sigla = '';
    let calleNombre = calle;
    const parts = calle.trim().split(/\s+/);
    if (parts.length > 1 && viaTypes.includes(parts[0].toUpperCase())) {
      sigla = parts[0].toUpperCase();
      calleNombre = parts.slice(1).join(' ');
    }

    const params = new URLSearchParams({
      Provincia: provincia, Municipio: municipio, Sigla: sigla, Calle: calleNombre,
      Numero: numero, Bloque: "", Escalera: "", Planta: "", Puerta: "",
    });

    const url = `https://ovc.catastro.meh.es/ovcservweb/ovcswlocalizacionrc/ovccallejero.asmx/Consulta_DNPLOC?${params}`;
    console.log("Catastro URL:", url);

    const response = await fetch(url);
    const xmlText = await response.text();
    console.log("Catastro response (length):", xmlText.length);
    console.log("Catastro response:", xmlText.substring(0, 1500));

    const results: any[] = [];
    // Try <rcdnp> blocks first (Consulta_DNPLOC response format)
    const rcdnpRegex = /<rcdnp>[\s\S]*?<\/rcdnp>/g;
    const rcdnpMatches = xmlText.match(rcdnpRegex) || [];
    
    for (const block of rcdnpMatches) {
      const pc1 = block.match(/<pc1>(.*?)<\/pc1>/)?.[1] || "";
      const pc2 = block.match(/<pc2>(.*?)<\/pc2>/)?.[1] || "";
      const car = block.match(/<car>(.*?)<\/car>/)?.[1] || "";
      const cc1 = block.match(/<cc1>(.*?)<\/cc1>/)?.[1] || "";
      const cc2 = block.match(/<cc2>(.*?)<\/cc2>/)?.[1] || "";
      const rc = `${pc1}${pc2}${car}${cc1}${cc2}`;
      const usoVal = block.match(/<luso>(.*?)<\/luso>/)?.[1] || "";
      const superficie = block.match(/<sfc>(.*?)<\/sfc>/)?.[1] || "";
      // DNPLOC uses <pt>/<pu> for planta/puerta; DNPRC uses <plt>/<pta>
      const planta = block.match(/<pt>(.*?)<\/pt>/)?.[1] || block.match(/<plt>(.*?)<\/plt>/)?.[1] || "";
      const puerta = block.match(/<pu>(.*?)<\/pu>/)?.[1] || block.match(/<pta>(.*?)<\/pta>/)?.[1] || "";
      const escalera = block.match(/<es>(.*?)<\/es>/)?.[1] || "";
      if (rc.length >= 14) results.push({ rc, uso: usoVal, superficie, planta, puerta, escalera });
    }

    // Fallback: try <bi> blocks (alternative response format)
    if (results.length === 0) {
      const biRegex = /<bi>[\s\S]*?<\/bi>/g;
      const biMatches = xmlText.match(biRegex) || [];
      for (const block of biMatches) {
        const pc1 = block.match(/<pc1>(.*?)<\/pc1>/)?.[1] || "";
        const pc2 = block.match(/<pc2>(.*?)<\/pc2>/)?.[1] || "";
        const car = block.match(/<car>(.*?)<\/car>/)?.[1] || "";
        const cc1 = block.match(/<cc1>(.*?)<\/cc1>/)?.[1] || "";
        const cc2 = block.match(/<cc2>(.*?)<\/cc2>/)?.[1] || "";
        const rc = `${pc1}${pc2}${car}${cc1}${cc2}`;
        const usoVal = block.match(/<luso>(.*?)<\/luso>/)?.[1] || "";
        const superficie = block.match(/<sfc>(.*?)<\/sfc>/)?.[1] || "";
        const planta = block.match(/<plt>(.*?)<\/plt>/)?.[1] || "";
        const puerta = block.match(/<pta>(.*?)<\/pta>/)?.[1] || "";
        if (rc.length >= 14) results.push({ rc, uso: usoVal, superficie, planta, puerta });
      }
    }

    // Last fallback: extract single RC from root level
    if (results.length === 0) {
      const pc1 = xmlText.match(/<pc1>(.*?)<\/pc1>/)?.[1] || "";
      const pc2 = xmlText.match(/<pc2>(.*?)<\/pc2>/)?.[1] || "";
      if (pc1 && pc2) {
        const car = xmlText.match(/<car>(.*?)<\/car>/)?.[1] || "";
        const cc1 = xmlText.match(/<cc1>(.*?)<\/cc1>/)?.[1] || "";
        const cc2 = xmlText.match(/<cc2>(.*?)<\/cc2>/)?.[1] || "";
        const usoVal = xmlText.match(/<luso>(.*?)<\/luso>/)?.[1] || "";
        const superficie = xmlText.match(/<sfc>(.*?)<\/sfc>/)?.[1] || "";
        const planta = xmlText.match(/<plt>(.*?)<\/plt>/)?.[1] || "";
        const puerta = xmlText.match(/<pta>(.*?)<\/pta>/)?.[1] || "";
        results.push({ rc: `${pc1}${pc2}${car}${cc1}${cc2}`, uso: usoVal, superficie, planta, puerta });
      }
    }

    if (results.length === 0) {
      const errorMsg = xmlText.match(/<des>(.*?)<\/des>/)?.[1] || "No se encontraron resultados";
      return new Response(JSON.stringify({ error: errorMsg, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Catastro error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
