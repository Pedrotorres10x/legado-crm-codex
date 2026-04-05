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

type RawTagValue = string | string[] | null | undefined;

interface FotocasaProperty {
  id: string;
  crm_reference?: string | null;
  reference?: string | null;
  property_type?: string | null;
  secondary_property_type?: string | null;
  operation?: string | null;
  zone?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  title?: string | null;
  description?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  surface_area?: number | null;
  built_area?: number | null;
  has_terrace?: boolean | null;
  has_pool?: boolean | null;
  has_garage?: boolean | null;
  has_garden?: boolean | null;
  has_elevator?: boolean | null;
  features?: string[] | null;
  year_built?: number | null;
  floor?: string | null;
  zip_code?: string | null;
  address?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  floor_plans?: string[] | null;
  images?: string[] | null;
  videos?: string[] | null;
  virtual_tour_url?: string | null;
  source_metadata?: { raw_tags?: Record<string, RawTagValue> | null } | null;
  agent_id?: string | null;
}

interface AgentProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface FotocasaPayload {
  ExternalId: string;
  AgencyReference: string;
  TypeId: number;
  SubTypeId: number;
  ContactTypeId: number;
  PropertyAddress: Array<Record<string, unknown>>;
  Contact: Array<Record<string, unknown>>;
  TransactionTypeId: number;
  Features: FotocasaFeature[];
  Documents: FotocasaDocument[];
}

interface FotocasaResponseItem {
  ExternalId?: string;
  Message?: string;
}

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

function cleanPortalText(value: string | null | undefined): string {
  if (!value) return '';

  return value
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^https?:\/\//i.test(line))
    .filter((line) => !/^not-available$/i.test(line))
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function looksMostlyEnglish(value: string): boolean {
  const text = ` ${value.toLowerCase()} `;
  const englishHits = [' the ', ' and ', ' with ', ' located ', ' property ', ' bedrooms ', ' bathrooms ', ' sea ', ' views ']
    .filter((token) => text.includes(token)).length;
  const spanishHits = [' el ', ' la ', ' con ', ' ubicado ', ' propiedad ', ' dormitorios ', ' banos ', ' baños ', ' vistas ']
    .filter((token) => text.includes(token)).length;
  return englishHits > spanishHits;
}

function extractLocalizedText(
  container: string,
  preferredLanguages: string[] = ['en', 'en_gb', 'en_us', 'english'],
  fallbackToAnyLanguage = false,
): string {
  if (!container) return '';
  if (!container.includes('<')) return cleanPortalText(container);

  for (const lang of preferredLanguages) {
    const match = container.match(new RegExp(`<${lang}[^>]*>([\\s\\S]*?)<\\/${lang}>`, 'i'));
    if (match?.[1]) return cleanPortalText(match[1]);
  }

  if (!fallbackToAnyLanguage) return '';
  const anyLanguageMatch = container.match(/<[a-z_]{2,10}[^>]*>([\s\S]*?)<\/[a-z_]{2,10}>/i);
  return cleanPortalText(anyLanguageMatch?.[1] || container);
}

function readRawTagValue(prop: FotocasaProperty, keys: string[]): string {
  const rawTags = prop?.source_metadata?.raw_tags;
  if (!rawTags || typeof rawTags !== 'object') return '';

  for (const key of keys) {
    const value = rawTags[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim()) return item.trim();
      }
    } else if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function buildGeneratedEnglishTitle(prop: FotocasaProperty): string {
  const typeMap: Record<string, string> = {
    piso: 'Apartment',
    casa: 'House',
    chalet: 'Villa',
    adosado: 'Townhouse',
    atico: 'Penthouse',
    duplex: 'Duplex',
    estudio: 'Studio',
    local: 'Commercial Property',
    oficina: 'Office',
    nave: 'Industrial Unit',
    terreno: 'Plot',
    garaje: 'Garage',
    trastero: 'Storage Room',
    otro: 'Property',
  };
  const rawType = typeof prop.property_type === 'string' ? prop.property_type.trim().toLowerCase() : 'otro';
  const typeLabel = typeMap[rawType] || 'Property';
  const area = cleanPortalText(prop.zone) || cleanPortalText(prop.city) || cleanPortalText(prop.province);
  return area ? `${typeLabel} in ${area}` : typeLabel;
}

function buildGeneratedEnglishDescription(prop: FotocasaProperty): string {
  const parts: string[] = [];
  const bedrooms = Number(prop.bedrooms) > 0 ? `${prop.bedrooms} bedroom${Number(prop.bedrooms) === 1 ? '' : 's'}` : '';
  const bathrooms = Number(prop.bathrooms) > 0 ? `${prop.bathrooms} bathroom${Number(prop.bathrooms) === 1 ? '' : 's'}` : '';
  const surface = Number(prop.surface_area) > 0 ? `${Math.round(Number(prop.surface_area))} m2` : '';
  const location = [cleanPortalText(prop.zone), cleanPortalText(prop.city), cleanPortalText(prop.province)]
    .filter(Boolean)
    .join(', ');
  const summary = [bedrooms, bathrooms, surface].filter(Boolean).join(', ');

  if (summary) parts.push(`${buildGeneratedEnglishTitle(prop)} with ${summary}.`);
  else parts.push(`${buildGeneratedEnglishTitle(prop)} available${location ? ` in ${location}` : ''}.`);

  const highlights: string[] = [];
  if (prop.has_terrace) highlights.push('terrace');
  if (prop.has_pool) highlights.push('pool');
  if (prop.has_garage) highlights.push('garage');
  if (prop.has_garden) highlights.push('garden');
  if (prop.has_elevator) highlights.push('lift');
  if (highlights.length > 0) parts.push(`Key features include ${highlights.join(', ')}.`);

  parts.push(location ? `Located in ${location}. Contact us for further details.` : 'Contact us for further details.');
  return cleanPortalText(parts.join(' '));
}

function resolvePortalCopy(prop: FotocasaProperty): { title: string; description: string } {
  const currentTitle = cleanPortalText(prop.title);
  const currentDescription = cleanPortalText(prop.description);

  const englishTitleFromRaw = cleanPortalText(
    extractLocalizedText(readRawTagValue(prop, ['title_en', 'name_en', 'headline_en', 'title', 'titulo', 'name', 'headline']))
  );
  const englishDescriptionFromRaw = cleanPortalText(
    extractLocalizedText(readRawTagValue(prop, ['description_en', 'desc_en', 'description_english', 'description', 'desc', 'descripcion', 'comments']))
  );

  const title = englishTitleFromRaw
    || (currentTitle && looksMostlyEnglish(currentTitle) ? currentTitle : '');

  const description = englishDescriptionFromRaw
    || (currentDescription && looksMostlyEnglish(currentDescription) ? currentDescription : '');

  return { title, description };
}

interface EnglishTranslations {
  [propertyId: string]: { title_en: string; description_en: string };
}

type TranslationProgressHook = (() => Promise<void>) | null;

function buildFallbackEnglishCopy(prop: FotocasaProperty) {
  const existing = resolvePortalCopy(prop);
  const title_en = existing.title || buildGeneratedEnglishTitle(prop);
  const description_en = existing.description || buildGeneratedEnglishDescription(prop);
  return {
    title_en: cleanPortalText(title_en),
    description_en: cleanPortalText(description_en),
  };
}

async function translatePropertiesToEnglish(
  properties: FotocasaProperty[],
  onProgress: TranslationProgressHook = null,
): Promise<EnglishTranslations> {
  const result: EnglishTranslations = {};
  for (const prop of properties) {
    result[prop.id] = buildFallbackEnglishCopy(prop);
    if (onProgress) await onProgress();
  }

  return result;
}

// ─── Feature builder ────────────────────────────────────────────────────────
interface FotocasaFeature {
  FeatureId: number;
  DecimalValue?: number;
  BoolValue?: boolean;
  TextValue?: string;
}

function buildFeatures(prop: FotocasaProperty): FotocasaFeature[] {
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

function buildDocuments(prop: FotocasaProperty): FotocasaDocument[] {
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
function buildPayload(prop: FotocasaProperty, agentProfile: AgentProfile | null): FotocasaPayload {
  const externalId = prop.crm_reference || prop.reference || prop.id;
  const typeId = TYPE_MAP[prop.property_type] || 1;
  const subTypeId = SUBTYPE_MAP[prop.property_type] || 9;
  const transactionTypeId = TRANSACTION_MAP[prop.operation] || 1;

  const payload: FotocasaPayload = {
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
const FOTOCASA_DEFAULT_BATCH_SIZE = 10;
const FOTOCASA_CONCURRENCY = 4;
const FOTOCASA_BULK_LOCK_KEY = 'fotocasa_bulk_sync';
const FOTOCASA_BULK_LOCK_TTL_MS = 30 * 60 * 1000;
const FOTOCASA_STALE_HEARTBEAT_MS = 15 * 60 * 1000;

interface FotocasaBulkSyncMetadata {
  action?: string;
  sync_run_id?: string;
  offset?: number;
  batch_size?: number;
  [key: string]: unknown;
}

function parseBulkSyncMetadata(metadata: unknown): FotocasaBulkSyncMetadata {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  return metadata as FotocasaBulkSyncMetadata;
}

async function acquireBulkSyncLock(
  supabase: ReturnType<typeof createClient>,
  action: string,
  syncRunId: string,
  offset: number,
  batchSize: number,
) {
  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + FOTOCASA_BULK_LOCK_TTL_MS).toISOString();

  const { data: current, error: readError } = await supabase
    .from('portal_sync_state')
    .select('sync_key, status, started_at, heartbeat_at, expires_at, metadata')
    .eq('sync_key', FOTOCASA_BULK_LOCK_KEY)
    .maybeSingle();

  if (readError) throw readError;

  const expired = !current?.expires_at || new Date(current.expires_at).getTime() <= Date.now();
  const staleHeartbeat = !current?.heartbeat_at
    || new Date(current.heartbeat_at).getTime() <= Date.now() - FOTOCASA_STALE_HEARTBEAT_MS;
  const recoveringStaleLock = current?.status === 'running' && (expired || staleHeartbeat);

  if (current?.status === 'running' && !recoveringStaleLock) {
    return { acquired: false, current };
  }

  const { error: upsertError } = await supabase
    .from('portal_sync_state')
    .upsert({
      sync_key: FOTOCASA_BULK_LOCK_KEY,
      status: 'running',
      started_at: recoveringStaleLock && current?.started_at ? current.started_at : nowIso,
      heartbeat_at: nowIso,
      expires_at: expiresIso,
      metadata: { action, sync_run_id: syncRunId, offset, batch_size: batchSize },
      finished_at: null,
    });

  if (upsertError) throw upsertError;

  return {
    acquired: true,
    recovered: recoveringStaleLock,
    previous: current,
  };
}

async function touchBulkSyncLock(
  supabase: ReturnType<typeof createClient>,
  action: string,
  syncRunId: string,
  offset: number,
  batchSize: number,
) {
  await supabase
    .from('portal_sync_state')
    .update({
      heartbeat_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + FOTOCASA_BULK_LOCK_TTL_MS).toISOString(),
      metadata: { action, sync_run_id: syncRunId, offset, batch_size: batchSize },
    })
    .eq('sync_key', FOTOCASA_BULK_LOCK_KEY);
}

async function releaseBulkSyncLock(
  supabase: ReturnType<typeof createClient>,
  action: string,
  syncRunId: string,
  offset: number,
  batchSize: number,
) {
  await supabase
    .from('portal_sync_state')
    .update({
      status: 'idle',
      heartbeat_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      expires_at: null,
      metadata: { action, sync_run_id: syncRunId, offset, batch_size: batchSize },
    })
    .eq('sync_key', FOTOCASA_BULK_LOCK_KEY);
}

function queueNextFotocasaBatch(
  supabaseUrl: string,
  serviceKey: string,
  batchSize: number,
  nextOffset: number,
  syncRunId: string,
) {
  const promise = fetch(`${supabaseUrl}/functions/v1/fotocasa-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      action: 'sync_all',
      batch_size: batchSize,
      offset: nextOffset,
      sync_run_id: syncRunId,
    }),
  }).then(async (response) => {
    if (response.ok) return;
    const responseBody = await response.text().catch(() => '');
    console.error(`[fotocasa] chained batch ${nextOffset} failed with HTTP ${response.status}: ${responseBody}`);
  }).catch((error) => {
    console.error(`[fotocasa] chained batch ${nextOffset} dispatch failed: ${String(error)}`);
  });

  const edgeRuntime = globalThis.EdgeRuntime as { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(promise);
    return;
  }

  void promise;
}

async function fotocasaRequest(method: string, path: string, apiKey: string, body?: unknown) {
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

async function deleteFotocasaPropertyByExternalId(externalId: string, apiKey: string) {
  const base64Id = btoa(String(externalId));
  return await fotocasaRequest('DELETE', `api/v2/property/${base64Id}`, apiKey);
}

async function readBulkSyncState(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('portal_sync_state')
    .select('sync_key, status, started_at, heartbeat_at, expires_at, metadata')
    .eq('sync_key', FOTOCASA_BULK_LOCK_KEY)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  let supabase: ReturnType<typeof createClient> | null = null;
  let bulkLockAcquired = false;
  let currentAction = 'sync_all';
  let currentSyncRunId = '';
  let currentOffset = 0;
  let currentBatchSize = FOTOCASA_DEFAULT_BATCH_SIZE;

  try {
    // Auth: require service role key or valid JWT
    const authHeader = req.headers.get('Authorization');
    const internalKey = req.headers.get('x-internal-key');
    const apikeyHeader = req.headers.get('apikey');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const bootstrapClient = createClient(supabaseUrl, serviceKey);
    const { data: runtimeSettings } = await bootstrapClient
      .from('settings')
      .select('value')
      .eq('key', 'service_role_key')
      .maybeSingle();

    const settingsServiceRoleKey =
      typeof runtimeSettings?.value === 'string' && runtimeSettings.value.trim()
        ? runtimeSettings.value.trim()
        : null;

    let authorized = false;

    // Allow service-role bearer token (from DB triggers & cron)
    if (
      authHeader === `Bearer ${serviceKey}` ||
      authHeader === `Bearer ${settingsServiceRoleKey}` ||
      apikeyHeader === serviceKey ||
      apikeyHeader === settingsServiceRoleKey ||
      internalKey === serviceKey ||
      internalKey === settingsServiceRoleKey
    ) {
      authorized = true;
    }

    // Allow valid user JWT (from frontend admin calls)
    if (!authorized && authHeader?.startsWith('Bearer ')) {
      const anonClient = createClient(
        supabaseUrl,
        anonKey,
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

    supabase = bootstrapClient;

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync_all';
    currentAction = action;
    currentSyncRunId = typeof body.sync_run_id === 'string' && body.sync_run_id.trim()
      ? body.sync_run_id.trim()
      : crypto.randomUUID();
    const startOffset = Math.max(0, Number(body.offset || 0));
    const batchSize = Math.max(1, Number(body.batch_size || FOTOCASA_DEFAULT_BATCH_SIZE));
    currentOffset = startOffset;
    currentBatchSize = batchSize;
    const isBulkAction = action === 'sync_all' || action === 'delete_stale';

    if (action === 'watchdog') {
      const currentState = await readBulkSyncState(supabase);
      if (!currentState) {
        return json({
          ok: true,
          action: 'watchdog',
          status: 'idle',
          recovered: false,
          reason: 'no_bulk_sync_state',
        });
      }

      const metadata = parseBulkSyncMetadata(currentState.metadata);
      const staleByHeartbeat = !currentState.heartbeat_at
        || new Date(currentState.heartbeat_at).getTime() <= Date.now() - FOTOCASA_STALE_HEARTBEAT_MS;
      const staleByExpiry = !currentState.expires_at
        || new Date(currentState.expires_at).getTime() <= Date.now();
      const shouldRecover = currentState.status === 'running' && (staleByHeartbeat || staleByExpiry);

      if (!shouldRecover) {
        return json({
          ok: true,
          action: 'watchdog',
          status: currentState.status,
          recovered: false,
          heartbeat_at: currentState.heartbeat_at,
          expires_at: currentState.expires_at,
          metadata,
        });
      }

      const resumeAction = metadata.action === 'delete_stale' ? 'delete_stale' : 'sync_all';
      const resumeOffset = Math.max(0, Number(metadata.offset ?? 0));
      const resumeBatchSize = Math.max(1, Number(metadata.batch_size ?? batchSize));
      const resumeSyncRunId = typeof metadata.sync_run_id === 'string' && metadata.sync_run_id.trim()
        ? metadata.sync_run_id.trim()
        : crypto.randomUUID();

      await supabase
        .from('portal_sync_state')
        .update({
          status: 'idle',
          heartbeat_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          expires_at: null,
          metadata: {
            ...metadata,
            action: 'watchdog_reset',
            resume_action: resumeAction,
            resume_offset: resumeOffset,
            batch_size: resumeBatchSize,
            sync_run_id: resumeSyncRunId,
          },
        })
        .eq('sync_key', FOTOCASA_BULK_LOCK_KEY);

      await supabase.from('erp_sync_logs').insert({
        target: 'fotocasa',
        event: 'sync_watchdog_recovered',
        status: 'ok',
        http_status: 202,
        payload: {
          previous_status: currentState.status,
          previous_heartbeat_at: currentState.heartbeat_at,
          previous_expires_at: currentState.expires_at,
          resume_action: resumeAction,
          resume_offset: resumeOffset,
          batch_size: resumeBatchSize,
          sync_run_id: resumeSyncRunId,
        },
      });

      const resumeResponse = await fetch(`${supabaseUrl}/functions/v1/fotocasa-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          action: resumeAction,
          batch_size: resumeBatchSize,
          offset: resumeOffset,
          sync_run_id: resumeSyncRunId,
        }),
      });

      const resumePayload = await resumeResponse.json().catch(() => null);
      return json({
        ok: resumeResponse.ok,
        action: 'watchdog',
        status: 'recovered',
        recovered: true,
        resume_action: resumeAction,
        resume_offset: resumeOffset,
        batch_size: resumeBatchSize,
        sync_run_id: resumeSyncRunId,
        dispatch_status: resumeResponse.status,
        dispatch_payload: resumePayload,
      }, { status: resumeResponse.ok ? 200 : resumeResponse.status });
    }

    if (isBulkAction) {
      const lock = await acquireBulkSyncLock(supabase, action, currentSyncRunId, startOffset, batchSize);
      if (!lock.acquired) {
        return json({
          ok: true,
          skipped: true,
          reason: 'bulk_sync_already_running',
          action,
        });
      }
      bulkLockAcquired = true;
      if (lock.recovered) {
        const previousMetadata = parseBulkSyncMetadata(lock.previous?.metadata);
        await supabase.from('erp_sync_logs').insert({
          target: 'fotocasa',
          event: 'sync_stale_lock_recovered',
          status: 'ok',
          http_status: 202,
          payload: {
            action,
            sync_run_id: currentSyncRunId,
            previous_started_at: lock.previous?.started_at,
            previous_heartbeat_at: lock.previous?.heartbeat_at,
            previous_expires_at: lock.previous?.expires_at,
            previous_metadata: previousMetadata,
            offset: startOffset,
            batch_size: batchSize,
          },
        });
      }
      await supabase.from('erp_sync_logs').insert({
        target: 'fotocasa',
        event: 'sync_started',
        status: 'ok',
        http_status: 202,
        payload: {
          action,
          sync_run_id: currentSyncRunId,
          offset: startOffset,
          batch_size: batchSize,
        },
      });
      await touchBulkSyncLock(supabase, action, currentSyncRunId, startOffset, batchSize);
    }

    // ── List published ads ──────────────────────────────────────────────
    if (action === 'list_ads') {
      const { ok, data } = await fotocasaRequest('GET', 'api/v2/ads?published=true', apiKey);
      return json({ ok, ads: data });
    }

    // ── Purge duplicates: delete + re-create properties with Error_110 ──
    if (action === 'purge_duplicates') {
      const externalIds: string[] = body.external_ids || [];
      if (externalIds.length === 0) return json({ error: 'external_ids required' }, 400);

      const purgeResults: Array<Record<string, unknown>> = [];
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
      await touchBulkSyncLock(supabase, action, currentSyncRunId, startOffset, batchSize);
      currentOffset = startOffset;
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
      const allIds: string[] = [];
      let pgOffset = 0;
      while (true) {
        await touchBulkSyncLock(supabase, action, currentSyncRunId, startOffset, batchSize);
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

      const staleDeleteResults: Array<Record<string, unknown>> = [];
      for (const existingId of staleExistingIds) {
        await touchBulkSyncLock(supabase, action, currentSyncRunId, startOffset, batchSize);
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

      const result = json({
        ok: true,
        action: 'delete_stale',
        total_on_fotocasa: staleExistingIds.size,
        total_in_crm: syncedExternalIds.size,
        deleted: deletedCount,
        results: staleDeleteResults,
      });
      await releaseBulkSyncLock(supabase, action, currentSyncRunId, startOffset, batchSize);
      bulkLockAcquired = false;
      return result;
    }

    // ── Sync one or all ─────────────────────────────────────────────────
    let properties: FotocasaProperty[] = [];
    let fetchedBaseCount = 0;
    if (action === 'sync_one' && body.property_id) {
      const { data, error: fetchErr } = await supabase
        .from('properties')
        .select('*')
        .eq('id', body.property_id);
      if (fetchErr) return json({ error: fetchErr.message }, 500);
      // Skip international properties
      properties = ((data || []) as FotocasaProperty[]).filter((p) => !p.country || p.country === 'España');
      fetchedBaseCount = properties.length;
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
      fetchedBaseCount = properties.length;
    }

    // Duplicate properties with secondary_property_type (same logic as XML feeds)
    const extras: FotocasaProperty[] = [];
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

    const translations = await translatePropertiesToEnglish(
      properties,
      isBulkAction
        ? async () => {
            await touchBulkSyncLock(supabase!, action, currentSyncRunId, startOffset, batchSize);
          }
        : null,
    );
    properties = properties.map((prop) => {
      const translation = translations[prop.id];
      if (!translation?.title_en || !translation?.description_en) {
        throw new Error(`[fotocasa-sync] Missing English copy for property ${prop.id}`);
      }
      return {
        ...prop,
        title: translation.title_en,
        description: translation.description_en,
      };
    });

    // Count total for pagination info
    const { count: totalCount } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'disponible')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .or('country.is.null,country.eq.España');

    // Pre-fetch agent profiles for contact info
    const agentIds = [...new Set((properties || []).map((p) => p.agent_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, phone')
      .in('user_id', agentIds.length > 0 ? agentIds : ['__none__']);

    const profileMap: Record<string, AgentProfile> = {};
    ((profiles || []) as AgentProfile[]).forEach((p) => { profileMap[p.user_id] = p; });

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

    const results: Array<Record<string, unknown>> = [];

    // Process properties in parallel chunks of 5 for speed
    for (let i = 0; i < (properties || []).length; i += FOTOCASA_CONCURRENCY) {
      if (isBulkAction) {
        currentOffset = startOffset + i;
        await touchBulkSyncLock(supabase, action, currentSyncRunId, currentOffset, batchSize);
      }
      const chunk = properties.slice(i, i + FOTOCASA_CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map(async (prop) => {
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

        const fotocasaMessage = typeof data?.Message === 'string' ? data.Message : '';
        const missingExternalIdAfterPutRetry =
          !ok
          && method === 'PUT (retry-after-post-fail)'
          && status === 400
          && /no existe un inmueble con el externalId informado/i.test(fotocasaMessage);

        if (missingExternalIdAfterPutRetry) {
          console.log(`[fotocasa] PUT retry says externalId is missing for ${externalId}; retrying POST one last time...`);
          const finalRetry = await fotocasaRequest('POST', 'api/property', apiKey, payload);
          method = 'POST (final-retry-after-missing-externalId)';
          ok = finalRetry.ok;
          status = finalRetry.status;
          data = finalRetry.data;
        }

        const duplicateExternalIdError =
          !ok
          && status === 400
          && /existe más de un inmueble con el id informado/i.test(fotocasaMessage || String(data?.Message || ''));

        if (duplicateExternalIdError) {
          console.log(`[fotocasa] Duplicate remote ads detected for ${externalId}; deleting duplicate remote entries and retrying POST...`);
          const purgeResult = await deleteFotocasaPropertyByExternalId(externalId, apiKey);
          await supabase.from('erp_sync_logs').insert({
            target: 'fotocasa',
            event: 'property_duplicate_purged',
            status: purgeResult.ok ? 'ok' : 'error',
            http_status: purgeResult.status,
            response_body: JSON.stringify(purgeResult.data),
            error_message: purgeResult.ok ? null : purgeResult.data?.Message || `HTTP ${purgeResult.status}`,
            payload: { property_id: prop.id, external_id: externalId, method: 'DELETE (auto-purge-duplicate)' },
          });

          const finalRetry = await fotocasaRequest('POST', 'api/property', apiKey, payload);
          method = 'POST (retry-after-duplicate-purge)';
          ok = finalRetry.ok;
          status = finalRetry.status;
          data = finalRetry.data;
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

    const deleteResults: Array<Record<string, unknown>> = [];

    const succeeded = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    const deleted = deleteResults.filter(r => r.ok).length;
    const hasMore = action === 'sync_all' && fetchedBaseCount === batchSize;
    const nextOffset = hasMore ? startOffset + batchSize : null;

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
        sync_run_id: currentSyncRunId,
      },
    });

    if (bulkLockAcquired) {
      await releaseBulkSyncLock(supabase, action, currentSyncRunId, startOffset, batchSize);
      bulkLockAcquired = false;
    }

    if (action === 'sync_all' && hasMore && nextOffset !== null) {
      await supabase.from('erp_sync_logs').insert({
        target: 'fotocasa',
        event: 'sync_batch_queued',
        status: 'ok',
        http_status: 202,
        payload: {
          current_offset: startOffset,
          next_offset: nextOffset,
          batch_size: batchSize,
          sync_run_id: currentSyncRunId,
        },
      });
      queueNextFotocasaBatch(supabaseUrl, serviceKey, batchSize, nextOffset, currentSyncRunId);
    }

    const result = json({
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
      sync_run_id: currentSyncRunId,
      delete_results: deleteResults,
      results,
    });
    return result;
  } catch (err) {
    console.error('[fotocasa-sync] error:', err);
    if (bulkLockAcquired && supabase) {
      await releaseBulkSyncLock(supabase, currentAction, currentSyncRunId, currentOffset, currentBatchSize);
    }
    return json({ error: String(err) }, 500);
  }
});
