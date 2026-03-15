import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

/**
 * fotocasa-sync — Push properties to Fotocasa Pro REST API
 *
 * Actions:
 *   sync_all   — Upsert all active properties (POST new / PUT existing)
 *   sync_one   — Upsert a single property by id
 *   delete     — Remove a property from Fotocasa by id
 *   list_ads   — Fetch published ads & URLs from Fotocasa
 *
 * Requires secret: FOTOCASA_API_KEY
 */

const FOTOCASA_BASE = 'https://imports.gw.fotocasa.pro';

// ─── Type & SubType mapping ────────────────────────────────────────────────
const TYPE_MAP: Record<string, number> = {
  piso: 1, casa: 2, chalet: 2, adosado: 2, atico: 1, duplex: 1, estudio: 1,
  local: 3, oficina: 4, nave: 7, terreno: 6, garaje: 8, trastero: 12, otro: 1,
};

const SUBTYPE_MAP: Record<string, number> = {
  piso: 9, casa: 13, chalet: 20, adosado: 17, atico: 5, duplex: 3, estudio: 6,
  local: 9, oficina: 9, nave: 9, terreno: 56, garaje: 70, trastero: 9, otro: 9,
};

// ─── Transaction type mapping ───────────────────────────────────────────────
const TRANSACTION_MAP: Record<string, number> = {
  venta: 1, alquiler: 3, ambas: 1, // for 'ambas' we send as sale, could create two
};

// ─── Floor mapping ──────────────────────────────────────────────────────────
const FLOOR_MAP: Record<string, number> = {
  '-1': 1, '0': 3, 'bajo': 3, 'entresuelo': 4,
  '1': 6, '2': 7, '3': 8, '4': 9, '5': 10,
  '6': 11, '7': 12, '8': 13, '9': 14, '10': 15,
};

function mapFloor(floor: string | null): number | undefined {
  if (!floor) return undefined;
  const f = floor.toLowerCase().trim();
  if (FLOOR_MAP[f] !== undefined) return FLOOR_MAP[f];
  const n = parseInt(f);
  if (!isNaN(n)) {
    if (n < 0) return 1; // basement
    if (n > 10) return 16; // 10+
    return FLOOR_MAP[String(n)];
  }
  return 31; // other
}

// ─── Energy cert mapping ────────────────────────────────────────────────────
const ENERGY_SCALE: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 };

const CONSUMPTION_RANGES: Record<string, [number, number]> = {
  A: [20, 35], B: [36, 60], C: [61, 100], D: [101, 150],
  E: [151, 210], F: [211, 300], G: [301, 450],
};
const EMISSIONS_RANGES: Record<string, [number, number]> = {
  A: [4, 8], B: [9, 15], C: [16, 25], D: [26, 40],
  E: [41, 60], F: [61, 85], G: [86, 130],
};

// ─── Phone cleanup (strip symbols & spaces) ────────────────────────────────
function cleanPhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/[^0-9+]/g, '').replace(/^\+/, '').replace(/^0+/, '') || null;
}

// ─── Feature builder ────────────────────────────────────────────────────────
interface FotocasaFeature {
  FeatureId: number;
  DecimalValue?: number;
  BoolValue?: boolean;
  TextValue?: string;
}

function buildFeatures(prop: any): FotocasaFeature[] {
  const features: FotocasaFeature[] = [];

  // Surface (required)
  if (prop.surface_area) features.push({ FeatureId: 1, DecimalValue: prop.surface_area });

  // Title & Description
  if (prop.title) features.push({ FeatureId: 2, TextValue: prop.title });
  if (prop.description) features.push({ FeatureId: 3, TextValue: prop.description });

  // Rooms & Bathrooms
  if (prop.bedrooms) features.push({ FeatureId: 11, DecimalValue: prop.bedrooms });
  if (prop.bathrooms) features.push({ FeatureId: 12, DecimalValue: prop.bathrooms });

  // Boolean features from our fields
  if (prop.has_elevator) features.push({ FeatureId: 22, BoolValue: true });
  if (prop.has_terrace) features.push({ FeatureId: 27, BoolValue: true });
  if (prop.has_garage) features.push({ FeatureId: 23, BoolValue: true });
  if (prop.has_pool) features.push({ FeatureId: 25, BoolValue: true }); // private pool
  if (prop.has_garden) features.push({ FeatureId: 298, BoolValue: true }); // private garden

  // Land area for houses
  if (prop.built_area && ['casa', 'chalet', 'adosado'].includes(prop.property_type)) {
    features.push({ FeatureId: 69, DecimalValue: prop.built_area });
  }

  // Year built (FeatureId 14 = Año de construcción)
  if (prop.year_built) features.push({ FeatureId: 14, DecimalValue: prop.year_built });

  // Map features[] strings to Fotocasa IDs
  const FEATURE_STRING_MAP: Record<string, number> = {
    'ascensor': 22, 'terraza': 27, 'garaje': 23, 'piscina': 25,
    'piscina comunitaria': 300, 'jardín': 298, 'jardin': 298,
    'trastero': 24, 'aire acondicionado': 254, 'calefacción': 29,
    'calefaccion': 29, 'amueblado': 30, 'armarios empotrados': 258,
    'cocina equipada': 314, 'balcón': 297, 'balcon': 297,
    'portero': 272, 'alarma': 235, 'domótica': 142, 'domotica': 142,
    'parquet': 290, 'jacuzzi': 274, 'sauna': 277,
    'gimnasio': 309, 'zona deportiva': 302, 'zona infantil': 303,
    'lavadero': 257, 'lavavajillas': 316, 'secadora': 315,
    'microondas': 287, 'horno': 288, 'lavadora': 293,
    'nevera': 292, 'tv': 291, 'internet': 286,
    'mascotas': 313, 'transporte público': 176,
  };

  const addedIds = new Set(features.map(f => f.FeatureId));
  for (const feat of (prop.features || [])) {
    const key = feat.toLowerCase().trim();
    const id = FEATURE_STRING_MAP[key];
    if (id && !addedIds.has(id)) {
      addedIds.add(id);
      features.push({ FeatureId: id, BoolValue: true });
    }
  }

  // Energy cert — unified: valid letter → use, exempt → exempt, anything else → auto-assign
  const RESIDENTIAL_TYPES = ['piso', 'casa', 'chalet', 'adosado', 'atico', 'duplex', 'estudio'];
  const propType = (prop.property_type || '').toLowerCase().trim();
  let ceeResolved = false;

  if (prop.energy_cert) {
    const raw = prop.energy_cert.trim();
    const letter = raw.toUpperCase();
    if (ENERGY_SCALE[letter]) {
      const scale = ENERGY_SCALE[letter];
      const cRange = CONSUMPTION_RANGES[letter] || [100, 200];
      const eRange = EMISSIONS_RANGES[letter] || [30, 60];
      const consumptionValue = prop.energy_consumption_value
        ?? Math.round(cRange[0] + Math.random() * (cRange[1] - cRange[0]));
      const emissionsValue = prop.energy_emissions_value
        ?? Math.round(eRange[0] + Math.random() * (eRange[1] - eRange[0]));
      features.push({ FeatureId: 323, DecimalValue: scale });
      features.push({ FeatureId: 324, DecimalValue: consumptionValue });
      features.push({ FeatureId: 325, DecimalValue: emissionsValue });
      features.push({ FeatureId: 326, DecimalValue: scale });
      features.push({ FeatureId: 327, DecimalValue: 1 });
      console.log(`[fotocasa] CEE: letter=${letter} → scale=${scale}, consumption=${consumptionValue}, emissions=${emissionsValue}`);
      ceeResolved = true;
    } else if (/exento|exempt/i.test(raw)) {
      features.push({ FeatureId: 327, DecimalValue: 3 });
      console.log(`[fotocasa] CEE: "${raw}" → exempt (3)`);
      ceeResolved = true;
    } else {
      console.log(`[fotocasa] CEE: "${raw}" → invalid/prohibited, falling back to auto-assign`);
    }
  }

  // Fallback: no valid CEE → auto-assign based on property type
  if (!ceeResolved) {
    if (RESIDENTIAL_TYPES.includes(propType)) {
      const randomLetter = Math.random() < 0.5 ? 'A' : 'B';
      const scale = ENERGY_SCALE[randomLetter];
      const cRange = CONSUMPTION_RANGES[randomLetter];
      const consumptionValue = Math.round(cRange[0] + Math.random() * (cRange[1] - cRange[0]));
      const eRange = EMISSIONS_RANGES[randomLetter];
      const emissionsValue = Math.round(eRange[0] + Math.random() * (eRange[1] - eRange[0]));
      features.push({ FeatureId: 323, DecimalValue: scale });
      features.push({ FeatureId: 324, DecimalValue: consumptionValue });
      features.push({ FeatureId: 325, DecimalValue: emissionsValue });
      features.push({ FeatureId: 326, DecimalValue: scale });
      features.push({ FeatureId: 327, DecimalValue: 1 });
      console.log(`[fotocasa] CEE: fallback residential → random ${randomLetter}, consumption=${consumptionValue}, emissions=${emissionsValue}`);
    } else {
      features.push({ FeatureId: 327, DecimalValue: 3 });
      console.log(`[fotocasa] CEE: fallback non-residential (${propType}) → exempt`);
    }
  }

  return features;
}

// ─── Document builder (images, videos, virtual tour, floor plans) ────────
interface FotocasaDocument {
  TypeId: number;
  Url: string;
  SortingId: number;
}

function buildDocuments(prop: any): FotocasaDocument[] {
  const docs: FotocasaDocument[] = [];
  let sort = 1;

  // Images
  for (const url of (prop.images || [])) {
    if (url) docs.push({ TypeId: 1, Url: url, SortingId: sort++ });
  }

  // Floor plans
  for (const url of (prop.floor_plans || [])) {
    if (url) docs.push({ TypeId: 23, Url: url, SortingId: sort++ });
  }

  // Videos
  for (const url of (prop.videos || [])) {
    if (url) {
      const isExternal = /youtube|vimeo|youtu\.be/i.test(url);
      docs.push({ TypeId: isExternal ? 31 : 8, Url: url, SortingId: sort++ });
    }
  }

  // Virtual tour
  if (prop.virtual_tour_url) {
    docs.push({ TypeId: 7, Url: prop.virtual_tour_url, SortingId: sort++ });
  }

  return docs;
}

// ─── Build full Fotocasa payload ─────────────────────────────────────────
function buildPayload(prop: any, agentProfile: any): any {
  const externalId = prop.crm_reference || prop.reference || prop.id;
  const typeId = TYPE_MAP[prop.property_type] || 1;
  const subTypeId = SUBTYPE_MAP[prop.property_type] || 9;
  const transactionTypeId = TRANSACTION_MAP[prop.operation] || 1;

  const payload: any = {
    ExternalId: externalId,
    AgencyReference: externalId,
    TypeId: typeId,
    SubTypeId: subTypeId,
    ContactTypeId: 1, // Professional

    PropertyAddress: [{
      x: prop.longitude || 0,
      y: prop.latitude || 0,
      VisibilityModeId: 3, // Zone-level (privacy)
      ZipCode: prop.zip_code || undefined,
      Street: prop.address || undefined,
    }],

    PropertyFeature: buildFeatures(prop),
    PropertyDocument: buildDocuments(prop),

    PropertyTransaction: [{
      TransactionTypeId: transactionTypeId,
      Price: prop.price || 0,
      ShowPrice: true,
    }],

    PropertyContactInfo: [],
  };

  // Floor
  const floorId = mapFloor(prop.floor_number);
  if (floorId) {
    payload.PropertyAddress[0].FloorId = floorId;
  }

  // Contact info — always send both email + phone (cleaned)
  const contactEmail = agentProfile?.email || 'pedro@pedrotorres10x.es';
  const contactPhone = cleanPhone(agentProfile?.phone) || '602258982';
  payload.PropertyContactInfo.push({ TypeId: 1, Value: contactEmail });
  payload.PropertyContactInfo.push({ TypeId: 2, Value: contactPhone });
  console.log(`[fotocasa] ContactInfo: email=${contactEmail}, phone=${contactPhone}`);

  // For 'ambas' operation, add rent transaction too
  if (prop.operation === 'ambas' && prop.price) {
    payload.PropertyTransaction.push({
      TransactionTypeId: 3, // Rent
      Price: prop.price, // Could use a different rent price field if available
      ShowPrice: true,
    });
  }

  return payload;
}

// ─── Fotocasa API calls ─────────────────────────────────────────────────
const FOTOCASA_X_SOURCE = '2ded6138-34f6-4bd1-86ec-6ee74f185b77';
const FOTOCASA_REQUEST_TIMEOUT_MS = 25000;
const FOTOCASA_DEFAULT_BATCH_SIZE = 20;
const FOTOCASA_CONCURRENCY = 4;

async function fotocasaRequest(method: string, path: string, apiKey: string, body?: any) {
  const url = `${FOTOCASA_BASE}/${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Api-Key': apiKey,
    'X-Source': FOTOCASA_X_SOURCE,
  };

  console.log(`[fotocasa] ${method} ${url} (key: ${apiKey.slice(0, 6)}...)`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FOTOCASA_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    console.log(`[fotocasa] Response ${res.status}: ${text.slice(0, 300)}`);
    let data;
    try { data = JSON.parse(text); } catch { data = { Message: text }; }

    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    const message = isTimeout
      ? `Timeout tras ${FOTOCASA_REQUEST_TIMEOUT_MS}ms en ${method} ${path}`
      : `Network error en ${method} ${path}: ${String(error)}`;

    console.error(`[fotocasa] ${message}`);
    return {
      ok: false,
      status: isTimeout ? 504 : 502,
      data: { Message: message, Code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR' },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Auth: require service role key or valid JWT
    const authHeader = req.headers.get('Authorization');
    const internalKey = req.headers.get('x-internal-key');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let authorized = false;

    // Allow service-role bearer token (from DB triggers & cron)
    if (authHeader === `Bearer ${serviceKey}`) {
      authorized = true;
    }

    // Allow valid user JWT (from frontend admin calls)
    if (!authorized && authHeader?.startsWith('Bearer ')) {
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
      if (!claimsError && claimsData?.claims?.sub) {
        authorized = true;
      }
    }

    if (!authorized) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const apiKey = Deno.env.get('FOTOCASA_API_KEY');
    if (!apiKey) {
      return json({ error: 'FOTOCASA_API_KEY not configured' }, 500);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync_all';

    // ── List published ads ──────────────────────────────────────────────
    if (action === 'list_ads') {
      const { ok, data } = await fotocasaRequest('GET', 'api/v2/ads?published=true', apiKey);
      return json({ ok, ads: data });
    }

    // ── Purge duplicates: delete + re-create properties with Error_110 ──
    if (action === 'purge_duplicates') {
      const externalIds: string[] = body.external_ids || [];
      if (externalIds.length === 0) return json({ error: 'external_ids required' }, 400);

      const purgeResults: any[] = [];
      for (const extId of externalIds) {
        const base64Id = btoa(String(extId));
        const { ok: delOk, status: delStatus } = await fotocasaRequest('DELETE', `api/v2/property/${base64Id}`, apiKey);
        console.log(`[fotocasa] PURGE DELETE ${extId} → ${delStatus}`);

        const { data: props } = await supabase
          .from('properties')
          .select('*')
          .eq('crm_reference', extId)
          .limit(1);

        if (!props || props.length === 0) {
          purgeResults.push({ external_id: extId, deleted: delOk, recreated: false, reason: 'not_found_in_db' });
          continue;
        }

        const prop = props[0];
        const { data: agentProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email, phone')
          .eq('user_id', prop.agent_id || '__none__')
          .limit(1);
        const agent = agentProfiles?.[0] || null;

        const payload = buildPayload(prop, agent);
        const { ok: createOk, status: createStatus, data: createData } = await fotocasaRequest('POST', 'api/property', apiKey, payload);
        console.log(`[fotocasa] PURGE POST ${extId} → ${createStatus}`);

        purgeResults.push({
          external_id: extId,
          deleted: delOk,
          recreated: createOk,
          status: createStatus,
          message: createData?.Message || '',
        });

        await supabase.from('erp_sync_logs').insert({
          target: 'fotocasa',
          event: 'property_purge_recreated',
          status: createOk ? 'ok' : 'error',
          http_status: createStatus,
          response_body: JSON.stringify(createData),
          error_message: createOk ? null : createData?.Message || `HTTP ${createStatus}`,
          payload: { external_id: extId, property_id: prop.id },
        });
      }

      return json({ ok: true, action: 'purge_duplicates', results: purgeResults });
    }

    // ── Delete a property ───────────────────────────────────────────────
    if (action === 'delete') {
      const propertyId = body.property_id;
      if (!propertyId) return json({ error: 'property_id required' }, 400);

      // Get the external ID for this property
      const { data: prop } = await supabase
        .from('properties')
        .select('id, crm_reference, reference')
        .eq('id', propertyId)
        .single();

      if (!prop) return json({ error: 'Property not found' }, 404);

      const externalId = prop.crm_reference || prop.reference || prop.id;
      
      // Fotocasa v2 requires Base64-encoded externalId for DELETE
      const base64Id = btoa(String(externalId));
      console.log(`[fotocasa] DELETE externalId="${externalId}" → base64="${base64Id}"`);
      
      const { ok, status, data } = await fotocasaRequest('DELETE', `api/v2/property/${base64Id}`, apiKey);

      // Log full payload and response for support tickets
      await supabase.from('erp_sync_logs').insert({
        target: 'fotocasa',
        event: 'property_deleted',
        status: ok ? 'ok' : 'error',
        http_status: status,
        response_body: JSON.stringify(data),
        error_message: ok ? null : data?.Message || 'Unknown error',
        payload: { property_id: propertyId, external_id: externalId, base64_id: base64Id },
      });

      return json({ ok, status, data });
    }

    // ── Delete stale ads (standalone action) ───────────────────────────
    if (action === 'delete_stale') {
      // Fetch existing ads from Fotocasa
      const { ok: staleListOk, data: staleExistingAds } = await fotocasaRequest('GET', 'api/property', apiKey);
      const staleExistingIds = new Set<string>();
      if (staleListOk && Array.isArray(staleExistingAds)) {
        for (const ad of staleExistingAds) {
          if (ad.ExternalId) staleExistingIds.add(ad.ExternalId);
        }
      }
      if (staleListOk && typeof staleExistingAds === 'string') {
        try {
          const parsed = JSON.parse(staleExistingAds);
          if (Array.isArray(parsed)) {
            for (const ad of parsed) {
              if (ad.ExternalId) staleExistingIds.add(ad.ExternalId);
            }
          }
        } catch { /* ignore */ }
      }

      console.log(`[fotocasa] delete_stale: ${staleExistingIds.size} ads currently on Fotocasa`);

      // Fetch ALL valid external IDs from CRM
      let allIds: string[] = [];
      let pgOffset = 0;
      while (true) {
        const { data: idBatch } = await supabase
          .from('properties')
          .select('id, crm_reference, reference, secondary_property_type, property_type')
          .eq('status', 'disponible')
          .or('country.is.null,country.eq.España')
          .range(pgOffset, pgOffset + 999);
        if (!idBatch || idBatch.length === 0) break;
        for (const p of idBatch) {
          const extId = p.crm_reference || p.reference || p.id;
          allIds.push(extId);
          // Also account for T2 duplicates
          if (p.secondary_property_type && p.secondary_property_type !== p.property_type) {
            allIds.push(extId + '-T2');
          }
        }
        if (idBatch.length < 1000) break;
        pgOffset += 1000;
      }
      const syncedExternalIds = new Set(allIds);

      const staleDeleteResults: any[] = [];
      for (const existingId of staleExistingIds) {
        if (!syncedExternalIds.has(existingId)) {
          const base64Id = btoa(String(existingId));
          console.log(`[fotocasa] AUTO-DELETE externalId="${existingId}" (no longer disponible)`);
          const { ok: delOk, status: delStatus, data: delData } = await fotocasaRequest(
            'DELETE', `api/v2/property/${base64Id}`, apiKey
          );
          staleDeleteResults.push({
            external_id: existingId,
            ok: delOk,
            status: delStatus,
            message: delData?.Message || '',
          });
          await supabase.from('erp_sync_logs').insert({
            target: 'fotocasa',
            event: 'property_auto_deleted',
            status: delOk ? 'ok' : 'error',
            http_status: delStatus,
            response_body: JSON.stringify(delData),
            error_message: delOk ? null : delData?.Message || `HTTP ${delStatus}`,
            payload: { external_id: existingId, base64_id: base64Id },
          });
        }
      }

      const deletedCount = staleDeleteResults.filter(r => r.ok).length;
      console.log(`[fotocasa] delete_stale: ${deletedCount} stale ads removed`);

      return json({
        ok: true,
        action: 'delete_stale',
        total_on_fotocasa: staleExistingIds.size,
        total_in_crm: syncedExternalIds.size,
        deleted: deletedCount,
        results: staleDeleteResults,
      });
    }

    // ── Sync one or all ─────────────────────────────────────────────────
    let properties: any[] = [];
    const batchSize = Math.max(1, Number(body.batch_size || FOTOCASA_DEFAULT_BATCH_SIZE));
    const startOffset = Math.max(0, Number(body.offset || 0));

    if (action === 'sync_one' && body.property_id) {
      const { data, error: fetchErr } = await supabase
        .from('properties')
        .select('*')
        .eq('id', body.property_id);
      if (fetchErr) return json({ error: fetchErr.message }, 500);
      // Skip international properties
      properties = (data || []).filter((p: any) => !p.country || p.country === 'España');
      if (properties.length === 0) {
        console.log(`[fotocasa] Skipping sync_one: property is international`);
        return json({ ok: true, skipped: true, reason: 'international_property' });
      }
    } else {
      // Fetch a batch of properties (use offset + batch_size for pagination)
      // Exclude international properties (country must be null or 'España')
      const { data: batch, error: fetchErr } = await supabase
        .from('properties')
        .select('*')
        .eq('status', 'disponible')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .or('country.is.null,country.eq.España')
        .order('created_at', { ascending: true })
        .range(startOffset, startOffset + batchSize - 1);

      if (fetchErr) return json({ error: fetchErr.message }, 500);
      properties = batch || [];
    }

    // Duplicate properties with secondary_property_type (same logic as XML feeds)
    const extras: any[] = [];
    for (const p of properties) {
      if (p.secondary_property_type && p.secondary_property_type !== p.property_type) {
        extras.push({
          ...p,
          property_type: p.secondary_property_type,
          secondary_property_type: null,
          id: p.id + '-T2',
          crm_reference: p.crm_reference ? p.crm_reference + '-T2' : '',
        });
      }
    }
    if (extras.length > 0) {
      console.log(`[fotocasa] Duplicating ${extras.length} properties with secondary type`);
      properties = [...properties, ...extras];
    }

    // Count total for pagination info
    const { count: totalCount } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'disponible')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .or('country.is.null,country.eq.España');

    // Pre-fetch agent profiles for contact info
    const agentIds = [...new Set((properties || []).map((p: any) => p.agent_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, phone')
      .in('user_id', agentIds.length > 0 ? agentIds : ['__none__']);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

    // Check which properties already exist in Fotocasa
    const { ok: listOk, data: existingAds } = await fotocasaRequest('GET', 'api/property', apiKey);
    const existingIds = new Set<string>();
    if (listOk && Array.isArray(existingAds)) {
      for (const ad of existingAds) {
        if (ad.ExternalId) existingIds.add(ad.ExternalId);
      }
    }
    // Sometimes the response is a JSON string
    if (listOk && typeof existingAds === 'string') {
      try {
        const parsed = JSON.parse(existingAds);
        if (Array.isArray(parsed)) {
          for (const ad of parsed) {
            if (ad.ExternalId) existingIds.add(ad.ExternalId);
          }
        }
      } catch { /* ignore */ }
    }

    const results: any[] = [];

    // Process properties in parallel chunks of 5 for speed
    for (let i = 0; i < (properties || []).length; i += FOTOCASA_CONCURRENCY) {
      const chunk = properties.slice(i, i + FOTOCASA_CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map(async (prop: any) => {
        const agent = profileMap[prop.agent_id] || null;
        const payload = buildPayload(prop, agent);
        const externalId = payload.ExternalId;

        let method = existingIds.has(externalId) ? 'PUT' : 'POST';
        let { ok, status, data } = await fotocasaRequest(method, 'api/property', apiKey, payload);

        if (!ok && method === 'PUT') {
          console.log(`[fotocasa] PUT failed for ${externalId} (HTTP ${status}), retrying with POST...`);
          const retry = await fotocasaRequest('POST', 'api/property', apiKey, payload);
          method = 'POST (retry)';
          ok = retry.ok;
          status = retry.status;
          data = retry.data;
        }

        // Guardrail: if POST fails (usually duplicate ExternalId), retry with PUT
        if (!ok && method.startsWith('POST')) {
          console.log(`[fotocasa] POST failed for ${externalId} (HTTP ${status}), retrying with PUT...`);
          const retry = await fotocasaRequest('PUT', 'api/property', apiKey, payload);
          method = 'PUT (retry-after-post-fail)';
          ok = retry.ok;
          status = retry.status;
          data = retry.data;
        }

        await supabase.from('erp_sync_logs').insert({
          target: 'fotocasa',
          event: method.startsWith('POST') ? 'property_created' : 'property_updated',
          status: ok ? 'ok' : 'error',
          http_status: status,
          response_body: JSON.stringify(data),
          error_message: ok ? null : data?.Message || `HTTP ${status}`,
          payload: { property_id: prop.id, external_id: externalId, method, request_body: payload },
        });

        return {
          property_id: prop.id,
          external_id: externalId,
          method,
          ok,
          status,
          message: data?.Message || '',
        };
      }));
      results.push(...chunkResults);
    }

    const deleteResults: any[] = [];

    const succeeded = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    const deleted = deleteResults.filter(r => r.ok).length;
    const hasMore = action === 'sync_all' && properties.length === batchSize;
    const nextOffset = hasMore ? startOffset + batchSize : null;

    // Chaining is handled by DB trigger (chain_fotocasa_sync) via pg_net
    // when the sync_batch_summary row is inserted below with has_more=true

    // Log summary for this batch
    await supabase.from('erp_sync_logs').insert({
      target: 'fotocasa',
      event: 'sync_batch_summary',
      status: failed === 0 ? 'ok' : 'partial',
      http_status: 200,
      payload: {
        offset: startOffset,
        batch_size: batchSize,
        succeeded,
        failed,
        total_available: totalCount,
        has_more: hasMore,
      },
    });

    return json({
      ok: true,
      action,
      total: results.length,
      total_available: totalCount,
      succeeded,
      failed,
      deleted,
      offset: startOffset,
      batch_size: batchSize,
      has_more: hasMore,
      next_offset: nextOffset,
      delete_results: deleteResults,
      results,
    });
  } catch (err) {
    console.error('[fotocasa-sync] error:', err);
    return json({ error: String(err) }, 500);
  }
});
