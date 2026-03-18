import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAI } from '../_shared/ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Property type mapping CRM → Kyero/Fotocasa ─────────────────────────────
const typeMap: Record<string, { kyero: string; fotocasa: string }> = {
  piso:     { kyero: 'apartment', fotocasa: 'flat' },
  casa:     { kyero: 'house',     fotocasa: 'house' },
  chalet:   { kyero: 'villa',     fotocasa: 'villa' },
  adosado:  { kyero: 'townhouse', fotocasa: 'semi_detached_house' },
  atico:    { kyero: 'apartment', fotocasa: 'penthouse' },
  duplex:   { kyero: 'apartment', fotocasa: 'duplex' },
  estudio:  { kyero: 'apartment', fotocasa: 'studio' },
  local:    { kyero: 'commercial', fotocasa: 'premises' },
  oficina:  { kyero: 'commercial', fotocasa: 'office' },
  nave:     { kyero: 'commercial', fotocasa: 'industrial' },
  terreno:  { kyero: 'land',      fotocasa: 'land' },
  garaje:   { kyero: 'garage',    fotocasa: 'garage' },
  trastero: { kyero: 'commercial', fotocasa: 'storage_room' },
  otro:     { kyero: 'house',     fotocasa: 'house' },
};

const operationMap: Record<string, string> = {
  venta: 'sale',
  alquiler: 'rent',
  alquiler_vacacional: 'holiday_rental',
  traspaso: 'transfer',
};

function normalizePropertyTypeKey(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const aliases: Record<string, string> = {
    apartment: 'piso',
    flat: 'piso',
    house: 'casa',
    home: 'casa',
    villa: 'chalet',
    penthouse: 'atico',
    storage: 'trastero',
    storage_room: 'trastero',
    storeroom: 'trastero',
    office: 'oficina',
    land: 'terreno',
    plot: 'terreno',
    premises: 'local',
    commercial: 'local',
    warehouse: 'nave',
    industrial: 'nave',
    garage: 'garaje',
    parking: 'garaje',
    aparcamiento: 'garaje',
    plaza_garaje: 'garaje',
    'plaza de garaje': 'garaje',
  };

  return aliases[normalized] || normalized;
}

function normalizeOperationKey(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const aliases: Record<string, string> = {
    sale: 'venta',
    sell: 'venta',
    rent: 'alquiler',
    rental: 'alquiler',
    let: 'alquiler',
    alquiler_temporal: 'alquiler',
    holiday_rental: 'alquiler_vacacional',
    'holiday-rental': 'alquiler_vacacional',
    vacation_rental: 'alquiler_vacacional',
    'vacation-rental': 'alquiler_vacacional',
    transfer: 'traspaso',
  };

  return aliases[normalized] || normalized;
}

function esc(val: string | null | undefined): string {
  if (!val) return '';
  return val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cdata(val: string | null | undefined): string {
  if (!val) return '';
  return `<![CDATA[${val}]]>`;
}

// ── CEE resolver: never return "en_tramite" ─────────────────────────────────
const RESIDENTIAL_TYPES = ['piso', 'casa', 'chalet', 'adosado', 'atico', 'duplex', 'estudio'];
const VALID_CEE_LETTERS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

function resolveCert(prop: any): string {
  const raw = (prop.energy_cert || '').trim();
  if (raw) {
    const upper = raw.toUpperCase();
    if (VALID_CEE_LETTERS.has(upper)) return upper;
    if (/exento|exempt/i.test(raw)) return 'exempt';
    // Any other value (including "en_tramite") → treat as empty
  }
  // No valid cert → decide by property type
  const propType = normalizePropertyTypeKey(prop.property_type);
  if (RESIDENTIAL_TYPES.includes(propType)) {
    return Math.random() < 0.5 ? 'A' : 'B';
  }
  return 'exempt';
}

/** Order images according to image_order JSON if present */
function orderImages(images: string[] | null, imageOrder: any): string[] {
  if (!images || images.length === 0) return [];
  if (!imageOrder || !Array.isArray(imageOrder)) return images;
  const ordered: string[] = [];
  for (const entry of imageOrder) {
    const url = typeof entry === 'string' ? entry : entry?.url;
    if (url && images.includes(url)) ordered.push(url);
  }
  for (const img of images) {
    if (!ordered.includes(img)) ordered.push(img);
  }
  return ordered;
}

/**
 * Resolve portal images using the same legacy-aware rules as the property detail:
 * image_order may contain inherited absolute URLs (xmlurl_...) even when images[]
 * is empty or incomplete.
 */
function resolvePortalImageUrls(prop: any): string[] {
  const baseImages = Array.isArray(prop.images) ? prop.images.filter((url: unknown): url is string => typeof url === 'string' && url.length > 0) : [];
  const imageOrder = Array.isArray(prop.image_order) ? prop.image_order : [];
  const ordered: string[] = [];

  for (const entry of imageOrder) {
    const rawValue = typeof entry === 'string' ? entry : entry?.url || entry?.name;
    if (typeof rawValue !== 'string' || !rawValue) continue;

    let resolvedUrl = '';
    if (rawValue.startsWith('xmlurl_')) {
      resolvedUrl = rawValue.replace('xmlurl_', '');
    } else if (/^https?:\/\//i.test(rawValue)) {
      resolvedUrl = rawValue;
    }

    if (!resolvedUrl) continue;
    if (/\.(mp4|webm|mov|avi)(\?|$)/i.test(resolvedUrl)) continue;
    if (/youtube\.com|youtu\.be|vimeo\.com/i.test(resolvedUrl)) continue;

    ordered.push(resolvedUrl);
  }

  const combined = ordered.length > 0
    ? [...ordered, ...baseImages.filter((url) => !ordered.includes(url))]
    : baseImages;

  const seen = new Set<string>();
  return combined.filter((url) => {
    const normalized = url.split('?')[0];
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/** Rewrite external image URLs through our proxy so portals can access them */
function proxyImageUrl(url: string, supabaseUrl: string): string {
  if (url.includes(supabaseUrl)) return url;
  return `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
}

// ── Feature intelligence: extract structured data from features[] ────────────
interface ParsedFeatures {
  airConditioning: boolean;
  heating: boolean;
  alarm: boolean;
  furnished: boolean;
  builtInWardrobes: boolean;
  storageRoom: boolean;
  communityPool: boolean;
  communityGarden: boolean;
  communityGym: boolean;
  privateGarage: number;
  privateParking: number;
  solarium: boolean;
  cornerProperty: boolean;
  exterior: boolean;
  gatedCommunity: boolean;
  electricShutters: boolean;
  armouredDoor: boolean;
  appliances: boolean;
  americanKitchen: boolean;
  seaView: boolean;
  cityView: boolean;
  mountainView: boolean;
  plotSize: number | null;
  toilets: number | null;
  condition: string | null; // 'good' | 'move_in' | 'needs_renovation'
  orientation: string | null;
  nearBeach: boolean;
  nearGolf: boolean;
  secondBeachLine: boolean;
  distances: { type: string; meters: number }[];
  rawFeatures: string[]; // everything else
}

function parseFeatures(features: string[] | null): ParsedFeatures {
  const result: ParsedFeatures = {
    airConditioning: false, heating: false, alarm: false, furnished: false,
    builtInWardrobes: false, storageRoom: false, communityPool: false,
    communityGarden: false, communityGym: false, privateGarage: 0,
    privateParking: 0, solarium: false, cornerProperty: false, exterior: false,
    gatedCommunity: false, electricShutters: false, armouredDoor: false,
    appliances: false, americanKitchen: false, seaView: false, cityView: false,
    mountainView: false, plotSize: null, toilets: null, condition: null,
    orientation: null, nearBeach: false, nearGolf: false, secondBeachLine: false,
    distances: [], rawFeatures: [],
  };
  if (!features) return result;

  for (const f of features) {
    const fl = f.toLowerCase().trim();

    // Distance tags
    const distMatch = f.match(/^(\w[\w\s]+) distance:\s*(\d+)m?$/i);
    if (distMatch) {
      result.distances.push({ type: distMatch[1].toLowerCase(), meters: parseInt(distMatch[2]) });
      continue;
    }

    // Plot size
    const plotMatch = f.match(/^Parcela:\s*(\d+)\s*m/i);
    if (plotMatch) { result.plotSize = parseInt(plotMatch[1]); continue; }

    // Toilets
    const toiletMatch = f.match(/^Toilet:\s*(\d+)/i);
    if (toiletMatch) { result.toilets = parseInt(toiletMatch[1]); continue; }

    // Private garage
    const garageMatch = f.match(/^Private garage:\s*(\d+)/i);
    if (garageMatch) { result.privateGarage = parseInt(garageMatch[1]); continue; }

    // Private parking
    const parkingMatch = f.match(/^Private parking:\s*(\d+)/i);
    if (parkingMatch) { result.privateParking = parseInt(parkingMatch[1]); continue; }

    // Floor (skip, already in DB)
    if (/^Floor:/i.test(fl)) continue;

    // Boolean features
    if (/air.?condition|aire.?acondicion/i.test(fl)) { result.airConditioning = true; continue; }
    if (/bomba de calor|heating|calefacc/i.test(fl)) { result.heating = true; continue; }
    if (/alarm/i.test(fl)) { result.alarm = true; continue; }
    if (/^amueblado$|^furnished$/i.test(fl)) { result.furnished = true; continue; }
    if (/armario.?empotrado|built.?in.?cabinet/i.test(fl)) { result.builtInWardrobes = true; continue; }
    if (/trastero|storage/i.test(fl)) { result.storageRoom = true; continue; }
    if (/community.?pool|piscina.?comunitaria/i.test(fl)) { result.communityPool = true; continue; }
    if (/community.?garden|jardín.?comunitario/i.test(fl)) { result.communityGarden = true; continue; }
    if (/community.?gym|gimnasio/i.test(fl)) { result.communityGym = true; continue; }
    if (/solarium/i.test(fl)) { result.solarium = true; continue; }
    if (/esquina|corner/i.test(fl)) { result.cornerProperty = true; continue; }
    if (/^exterior$/i.test(fl)) { result.exterior = true; continue; }
    if (/urbanización.?privada|gated/i.test(fl)) { result.gatedCommunity = true; continue; }
    if (/persiana.?eléctrica/i.test(fl)) { result.electricShutters = true; continue; }
    if (/puerta.?blindada|armoured/i.test(fl)) { result.armouredDoor = true; continue; }
    if (/electrodoméstico|appliance/i.test(fl)) { result.appliances = true; continue; }
    if (/cocina.*americana|american.?kitchen/i.test(fl)) { result.americanKitchen = true; continue; }
    if (/vista.?ciudad|city.?view/i.test(fl)) { result.cityView = true; continue; }
    if (/vista.?mar|sea.?view|near.?sea/i.test(fl)) { result.seaView = true; continue; }
    if (/vista.?montaña|mountain.?view/i.test(fl)) { result.mountainView = true; continue; }
    if (/cerca.?playa|near.?beach/i.test(fl)) { result.nearBeach = true; continue; }
    if (/cerca.?golf/i.test(fl)) { result.nearGolf = true; continue; }
    if (/segunda.?línea/i.test(fl)) { result.secondBeachLine = true; continue; }
    if (/buen.?estado/i.test(fl)) { result.condition = 'good'; continue; }
    if (/entrar.?a.?vivir|move.?in/i.test(fl)) { result.condition = 'move_in'; continue; }
    if (/orientación.*sur|south/i.test(fl)) { result.orientation = 'south'; continue; }
    if (/orientación.*norte|north/i.test(fl)) { result.orientation = 'north'; continue; }
    if (/orientación.*este|east/i.test(fl)) { result.orientation = 'east'; continue; }
    if (/orientación.*oeste|west/i.test(fl)) { result.orientation = 'west'; continue; }
    if (/^parking|^garage|elevator|ascensor|community.?garage|green.?area|zona.?ajardinada|zona.?comunitaria|zona.?deportiva|kitchen.*furnished|recibidor|lavadero|lavadora|horno|frigorífico|bus$|tranvía|supermercado|gres|pavimento|cerámica|2\s*planta|2\s*terraza|montacargas|ideal.?para|agua.?caliente|aerotermia/i.test(fl)) {
      // Known but already mapped via DB booleans or too generic
      continue;
    }

    // Anything else → pass through
    result.rawFeatures.push(f);
  }

  return result;
}

// ── Batch AI translation for premium properties ────────────────────────────
interface Translations {
  [propertyId: string]: { title_en: string; description_en: string };
}

async function translatePremiumProperties(properties: any[]): Promise<Translations> {
  const premium = properties.filter((p: any) => (p.price || 0) >= 500000 && (p.images?.length || 0) >= 20);
  if (premium.length === 0) return {};

  // Build a compact payload for translation
  const items = premium.map(p => ({
    id: p.id,
    title: (p.title || '').substring(0, 200),
    description: (p.description || '').substring(0, 2000),
  }));

  // Split into batches of 10 to avoid token limits
  const BATCH_SIZE = 10;
  const result: Translations = {};

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    try {
      const aiResult = await callAI('google/gemini-2.5-flash', [
        {
          role: 'system',
          content: `You are a native English copywriter specialising in luxury real estate for high-net-worth international buyers on the Spanish Mediterranean coast.

Your job is NOT to translate — it is to REWRITE the listing in natural, compelling English as if it were originally written for Savills, Knight Frank or Christie's.

Rules:
• Sound fresh and native — never stilted, never "translated". No awkward calques from Spanish.
• Evoke lifestyle, light, views and emotion. Use sensory language that sells the dream.
• Keep factual accuracy (rooms, sizes, features) but express them elegantly.
• Titles: punchy, aspirational, max 15 words. No generic "beautiful apartment" — be specific.
• Descriptions: flowing prose, short paragraphs. Highlight unique selling points first.
• Avoid clichés like "boasts", "nestled", "sought-after" — find fresher alternatives.
• Never invent features not present in the original.

Return ONLY a valid JSON array, no markdown, no explanation.
Each item: {"id":"...","title_en":"...","description_en":"..."}`,
        },
        {
          role: 'user',
          content: JSON.stringify(batch),
        },
      ], { max_tokens: 4000 });

      const raw = (aiResult.content || '')
        .replace(/```json?\n?/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(raw) as { id: string; title_en: string; description_en: string }[];
      for (const t of parsed) {
        result[t.id] = { title_en: t.title_en, description_en: t.description_en };
      }
    } catch (err) {
      console.warn('[portal-xml-feed] Translation batch failed, using Spanish fallback:', err);
      // Fallback: use Spanish text
      for (const item of batch) {
        result[item.id] = { title_en: item.title, description_en: item.description };
      }
    }
  }

  return result;
}

// ── Kyero V3 format (accepted by most Spanish portals) ──────────────────────
function toKyeroXml(properties: any[], portalName: string, supabaseUrl: string, translations: Translations = {}): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<root>\n`;
  xml += `  <kyero>\n    <feed_version>3</feed_version>\n  </kyero>\n`;

  for (const p of properties) {
    const imgs = resolvePortalImageUrls(p).map(u => proxyImageUrl(u, supabaseUrl));
    const mapped = typeMap[normalizePropertyTypeKey(p.property_type)] || typeMap.otro;
    const op = operationMap[normalizeOperationKey(p.operation)] || 'sale';
    const pf = parseFeatures(p.features);

    xml += `  <property>\n`;
    xml += `    <id>${esc(p.crm_reference || p.id)}</id>\n`;
    xml += `    <date>${p.updated_at?.substring(0, 19) || ''}</date>\n`;
    xml += `    <ref>${esc(p.crm_reference || '')}</ref>\n`;
    xml += `    <price>${p.price || 0}</price>\n`;
    xml += `    <currency>EUR</currency>\n`;
    xml += `    <price_freq>${op === 'rent' ? 'month' : 'sale'}</price_freq>\n`;
    xml += `    <new_build>0</new_build>\n`;
    xml += `    <type>${mapped.kyero}</type>\n`;
    xml += `    <operation>${op}</operation>\n`;

    // ── Status ──────────────────────────────────────────────
    if (p.status === 'reservado') xml += `    <leased>1</leased>\n`;

    // ── Location ────────────────────────────────────────────
    xml += `    <town>${esc(p.city)}</town>\n`;
    xml += `    <province>${esc(p.province)}</province>\n`;
    xml += `    <country>${esc(p.country || 'Spain')}</country>\n`;
    if (p.zip_code) xml += `    <postcode>${esc(p.zip_code)}</postcode>\n`;
    if (p.address) xml += `    <address>${esc(p.address)}</address>\n`;
    if (p.zone) xml += `    <location_detail>${esc(p.zone)}</location_detail>\n`;
    if (p.latitude && p.longitude) {
      xml += `    <latitude>${p.latitude}</latitude>\n`;
      xml += `    <longitude>${p.longitude}</longitude>\n`;
    }

    // ── Floor / staircase / door ────────────────────────────
    if (p.floor_number) xml += `    <floor>${esc(p.floor_number)}</floor>\n`;
    if (p.staircase) xml += `    <staircase>${esc(p.staircase)}</staircase>\n`;
    if (p.door) xml += `    <door>${esc(p.door)}</door>\n`;

    // ── Dimensions ──────────────────────────────────────────
    xml += `    <beds>${p.bedrooms || 0}</beds>\n`;
    xml += `    <baths>${p.bathrooms || 0}</baths>\n`;
    if (pf.toilets) xml += `    <toilets>${pf.toilets}</toilets>\n`;

    const plotSize = pf.plotSize || p.surface_area;
    const builtSize = p.built_area || p.surface_area;
    if (plotSize || builtSize) {
      xml += `    <surface_area>\n`;
      if (builtSize) xml += `      <built>${builtSize}</built>\n`;
      if (plotSize) xml += `      <plot>${plotSize}</plot>\n`;
      xml += `    </surface_area>\n`;
    }
    if (p.year_built) xml += `    <year_built>${p.year_built}</year_built>\n`;

    // ── Energy certificate (ALWAYS sent, never "en_tramite") ─
    {
      const cert = resolveCert(p);
      xml += `    <energy_rating>\n`;
      xml += `      <consumption>${esc(cert)}</consumption>\n`;
      if (p.energy_consumption_value) xml += `      <consumption_value>${p.energy_consumption_value}</consumption_value>\n`;
      xml += `      <emissions>${esc(cert)}</emissions>\n`;
      if (p.energy_emissions_value) xml += `      <emissions_value>${p.energy_emissions_value}</emissions_value>\n`;
      xml += `    </energy_rating>\n`;
    }

    // ── Condition / orientation ──────────────────────────────
    if (pf.condition) xml += `    <condition>${pf.condition === 'move_in' ? 'good' : pf.condition}</condition>\n`;
    if (pf.orientation) xml += `    <orientation>${pf.orientation}</orientation>\n`;
    if (pf.furnished) xml += `    <furnished>yes</furnished>\n`;

    // ── Features (structured) ───────────────────────────────
    const features: string[] = [];
    if (p.has_pool || pf.communityPool) features.push('pool');
    if (p.has_garage || pf.privateGarage > 0) features.push('parking');
    if (p.has_terrace) features.push('terrace');
    if (p.has_garden || pf.communityGarden) features.push('garden');
    if (p.has_elevator) features.push('elevator');
    if (pf.airConditioning) features.push('air_conditioning');
    if (pf.heating) features.push('central_heating');
    if (pf.alarm) features.push('alarm');
    if (pf.builtInWardrobes) features.push('fitted_wardrobes');
    if (pf.storageRoom) features.push('storage_room');
    if (pf.communityPool) features.push('communal_pool');
    if (pf.communityGym) features.push('gym');
    if (pf.solarium) features.push('solarium');
    if (pf.gatedCommunity) features.push('gated_community');
    if (pf.electricShutters) features.push('electric_shutters');
    if (pf.armouredDoor) features.push('security_door');
    if (pf.appliances) features.push('white_goods');
    if (pf.americanKitchen) features.push('american_kitchen');
    if (pf.exterior) features.push('exterior');
    if (pf.cornerProperty) features.push('corner_property');
    if (pf.seaView) features.push('sea_views');
    if (pf.cityView) features.push('city_views');
    if (pf.mountainView) features.push('mountain_views');
    if (pf.nearBeach) features.push('close_to_beach');
    if (pf.nearGolf) features.push('close_to_golf');
    if (pf.secondBeachLine) features.push('second_line_beach');
    if (pf.privateGarage > 1) features.push(`garage_spaces_${pf.privateGarage}`);
    if (pf.privateParking > 0) features.push(`parking_spaces_${pf.privateParking}`);
    // Add remaining raw features
    for (const rf of pf.rawFeatures) features.push(rf);

    if (features.length) {
      xml += `    <features>\n`;
      for (const f of [...new Set(features)]) xml += `      <feature>${esc(f)}</feature>\n`;
      xml += `    </features>\n`;
    }

    // ── Tags (CRM labels for portal context) ────────────────
    if ((p.tags || []).length) {
      xml += `    <tags>\n`;
      for (const tag of [...new Set(p.tags || [])]) xml += `      <tag>${esc(tag)}</tag>\n`;
      xml += `    </tags>\n`;
    }

    // ── Description ─────────────────────────────────────────
    const tr = translations[p.id];
    xml += `    <desc>\n`;
    xml += `      <es>${cdata(p.description)}</es>\n`;
    xml += `      <en>${cdata(tr?.description_en || p.description)}</en>\n`;
    xml += `    </desc>\n`;

    // ── Title ───────────────────────────────────────────────
    xml += `    <title>\n`;
    xml += `      <es>${cdata(p.title)}</es>\n`;
    xml += `      <en>${cdata(tr?.title_en || p.title)}</en>\n`;
    xml += `    </title>\n`;

    // ── Images ──────────────────────────────────────────────
    if (imgs.length) {
      xml += `    <images>\n`;
      for (let i = 0; i < imgs.length; i++) {
        xml += `      <image id="${i + 1}">\n        <url>${esc(imgs[i])}</url>\n      </image>\n`;
      }
      xml += `    </images>\n`;
    }

    // ── Floor plans ─────────────────────────────────────────
    const plans = (p.floor_plans || []).map((u: string) => proxyImageUrl(u, supabaseUrl));
    if (plans.length) {
      xml += `    <plans>\n`;
      for (let i = 0; i < plans.length; i++) {
        xml += `      <plan id="${i + 1}">\n        <url>${esc(plans[i])}</url>\n      </plan>\n`;
      }
      xml += `    </plans>\n`;
    }

    // ── Videos ──────────────────────────────────────────────
    if (p.videos?.length) {
      xml += `    <videos>\n`;
      for (const v of p.videos) {
        xml += `      <video><url>${esc(v)}</url></video>\n`;
      }
      xml += `    </videos>\n`;
    }

    // ── Virtual tour ────────────────────────────────────────
    if (p.virtual_tour_url) {
      xml += `    <virtual_tour>${esc(p.virtual_tour_url)}</virtual_tour>\n`;
    }

    // ── URL & status ────────────────────────────────────────
    xml += `    <url>https://www.legadocoleccion.es/propiedad/${p.id}</url>\n`;
    if (p.is_featured) xml += `    <featured>1</featured>\n`;
    xml += `  </property>\n`;
  }

  xml += `</root>`;
  return xml;
}
// ── Fotocasa format ─────────────────────────────────────────────────────────
function toFotocasaXml(properties: any[], supabaseUrl: string): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<feed xmlns="http://www.fotocasa.es" version="1.0">\n`;
  xml += `  <info>\n    <agency>Legado Real Estate</agency>\n    <date>${new Date().toISOString().substring(0, 10)}</date>\n  </info>\n`;

  for (const p of properties) {
    const imgs = resolvePortalImageUrls(p).map(u => proxyImageUrl(u, supabaseUrl));
    const mapped = typeMap[normalizePropertyTypeKey(p.property_type)] || typeMap.otro;
    const op = operationMap[normalizeOperationKey(p.operation)] || 'sale';
    const pf = parseFeatures(p.features);

    xml += `  <ad>\n`;
    xml += `    <id>${esc(p.crm_reference || p.id)}</id>\n`;
    xml += `    <operation>${op === 'rent' ? 'rent' : 'sale'}</operation>\n`;
    xml += `    <property_type>${mapped.fotocasa}</property_type>\n`;
    xml += `    <title>${cdata(p.title)}</title>\n`;
    xml += `    <description>${cdata(p.description)}</description>\n`;
    xml += `    <price>${p.price || 0}</price>\n`;

    // ── Location ────────────────────────────────────────────
    xml += `    <address>${esc(p.address)}</address>\n`;
    xml += `    <city>${esc(p.city)}</city>\n`;
    xml += `    <province>${esc(p.province)}</province>\n`;
    xml += `    <country>${esc(p.country || 'Spain')}</country>\n`;
    if (p.zip_code) xml += `    <postal_code>${esc(p.zip_code)}</postal_code>\n`;
    if (p.zone) xml += `    <zone>${esc(p.zone)}</zone>\n`;
    if (p.latitude && p.longitude) {
      xml += `    <latitude>${p.latitude}</latitude>\n`;
      xml += `    <longitude>${p.longitude}</longitude>\n`;
    }

    // ── Dimensions ──────────────────────────────────────────
    xml += `    <bedrooms>${p.bedrooms || 0}</bedrooms>\n`;
    xml += `    <bathrooms>${p.bathrooms || 0}</bathrooms>\n`;
    if (pf.toilets) xml += `    <toilets>${pf.toilets}</toilets>\n`;
    if (p.surface_area) xml += `    <surface>${p.surface_area}</surface>\n`;
    if (p.built_area) xml += `    <built_surface>${p.built_area}</built_surface>\n`;
    if (pf.plotSize) xml += `    <plot_surface>${pf.plotSize}</plot_surface>\n`;
    if (p.floor_number) xml += `    <floor>${esc(p.floor_number)}</floor>\n`;
    if (p.staircase) xml += `    <staircase>${esc(p.staircase)}</staircase>\n`;
    if (p.door) xml += `    <door>${esc(p.door)}</door>\n`;

    // ── Energy & condition (ALWAYS sent) ────────────────────
    xml += `    <energy_certificate>${esc(resolveCert(p))}</energy_certificate>\n`;
    if (pf.condition) xml += `    <condition>${pf.condition === 'move_in' ? 'good' : pf.condition}</condition>\n`;
    if (pf.orientation) xml += `    <orientation>${pf.orientation}</orientation>\n`;
    if (p.status === 'reservado') xml += `    <reserved>1</reserved>\n`;

    // ── Amenities (boolean tags) ────────────────────────────
    xml += `    <elevator>${p.has_elevator ? 1 : 0}</elevator>\n`;
    xml += `    <garage>${(p.has_garage || pf.privateGarage > 0) ? 1 : 0}</garage>\n`;
    if (pf.privateGarage > 0) xml += `    <garage_spaces>${pf.privateGarage}</garage_spaces>\n`;
    if (pf.privateParking > 0) xml += `    <parking_spaces>${pf.privateParking}</parking_spaces>\n`;
    xml += `    <pool>${(p.has_pool || pf.communityPool) ? 1 : 0}</pool>\n`;
    xml += `    <terrace>${p.has_terrace ? 1 : 0}</terrace>\n`;
    xml += `    <garden>${(p.has_garden || pf.communityGarden) ? 1 : 0}</garden>\n`;
    xml += `    <air_conditioning>${pf.airConditioning ? 1 : 0}</air_conditioning>\n`;
    xml += `    <heating>${pf.heating ? 1 : 0}</heating>\n`;
    xml += `    <furnished>${pf.furnished ? 1 : 0}</furnished>\n`;
    xml += `    <storage_room>${pf.storageRoom ? 1 : 0}</storage_room>\n`;
    xml += `    <fitted_wardrobes>${pf.builtInWardrobes ? 1 : 0}</fitted_wardrobes>\n`;
    xml += `    <alarm>${pf.alarm ? 1 : 0}</alarm>\n`;
    if (pf.communityPool) xml += `    <community_pool>1</community_pool>\n`;
    if (pf.communityGarden) xml += `    <community_garden>1</community_garden>\n`;
    if (pf.communityGym) xml += `    <community_gym>1</community_gym>\n`;
    if (pf.solarium) xml += `    <solarium>1</solarium>\n`;
    if (pf.gatedCommunity) xml += `    <gated_community>1</gated_community>\n`;
    if (pf.electricShutters) xml += `    <electric_shutters>1</electric_shutters>\n`;
    if (pf.armouredDoor) xml += `    <security_door>1</security_door>\n`;
    if (pf.appliances) xml += `    <appliances>1</appliances>\n`;
    if (pf.americanKitchen) xml += `    <american_kitchen>1</american_kitchen>\n`;
    if (pf.exterior) xml += `    <exterior>1</exterior>\n`;

    // ── Views & proximity ───────────────────────────────────
    if (pf.seaView) xml += `    <sea_views>1</sea_views>\n`;
    if (pf.cityView) xml += `    <city_views>1</city_views>\n`;
    if (pf.mountainView) xml += `    <mountain_views>1</mountain_views>\n`;
    if (pf.nearBeach || pf.secondBeachLine) xml += `    <close_to_beach>1</close_to_beach>\n`;
    if (pf.nearGolf) xml += `    <close_to_golf>1</close_to_golf>\n`;

    // ── Distance info ───────────────────────────────────────
    for (const d of pf.distances) {
      xml += `    <distance_${d.type.replace(/\s+/g, '_')}>${d.meters}</distance_${d.type.replace(/\s+/g, '_')}>\n`;
    }

    // ── Images ──────────────────────────────────────────────
    if (imgs.length) {
      xml += `    <images>\n`;
      for (let i = 0; i < imgs.length; i++) {
        xml += `      <image id="${i + 1}"><url>${esc(imgs[i])}</url></image>\n`;
      }
      xml += `    </images>\n`;
    }

    // ── Floor plans ─────────────────────────────────────────
    const fcPlans = (p.floor_plans || []).map((u: string) => proxyImageUrl(u, supabaseUrl));
    if (fcPlans.length) {
      xml += `    <plans>\n`;
      for (let i = 0; i < fcPlans.length; i++) {
        xml += `      <plan id="${i + 1}"><url>${esc(fcPlans[i])}</url></plan>\n`;
      }
      xml += `    </plans>\n`;
    }

    // ── Videos ──────────────────────────────────────────────
    if (p.videos?.length) {
      xml += `    <videos>\n`;
      for (const v of p.videos) {
        xml += `      <video><url>${esc(v)}</url></video>\n`;
      }
      xml += `    </videos>\n`;
    }

    // ── Virtual tour ────────────────────────────────────────
    if (p.virtual_tour_url) {
      xml += `    <virtual_tour>${esc(p.virtual_tour_url)}</virtual_tour>\n`;
    }

    // ── Tags ──────────────────────────────────────────────
    if (p.tags?.length) {
      xml += `    <tags>\n`;
      for (const tag of p.tags) xml += `      <tag>${esc(tag)}</tag>\n`;
      xml += `    </tags>\n`;
    }

    xml += `    <url>https://www.legadocoleccion.es/propiedad/${p.id}</url>\n`;
    xml += `    <date>${p.updated_at?.substring(0, 10) || ''}</date>\n`;
    if (p.is_featured) xml += `    <highlighted>1</highlighted>\n`;
    xml += `  </ad>\n`;
  }

  xml += `</feed>`;
  return xml;
}

// ── Pisos.com native XML format (<Publicacion><Table><Inmueble>) ────────────
// As specified by Pisos.com support — NOT XCP/HabitatSoft

const pisosTipoInmuebleMap: Record<string, string> = {
  piso: '2', casa: '1', chalet: '1', adosado: '1', atico: '2',
  duplex: '2', estudio: '2', local: '4', oficina: '5', nave: '6',
  terreno: '3', garaje: '8', trastero: '7', otro: '2',
};

const pisosTipoOperacionMap: Record<string, string> = {
  venta: '4', alquiler: '3', alquiler_vacacional: '3', traspaso: '4',
};

const pisosEstadoConservacionMap: Record<string, string> = {
  move_in: '1',   // A estrenar / Nuevo
  good: '3',      // Buen estado
};

const PISOS_INMOBILIARIA_ID = 'LEGADO';

function toPisosXml(properties: any[], supabaseUrl: string): string {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<Publicacion>\n`;
  xml += `  <Table Name="Inmuebles">\n`;

  for (const p of properties) {
    const imgs = resolvePortalImageUrls(p).map(u => proxyImageUrl(u, supabaseUrl));
    const pf = parseFeatures(p.features);
    const op = normalizeOperationKey(p.operation || 'venta');
    const cert = resolveCert(p);
    const propType = normalizePropertyTypeKey(p.property_type || 'piso');

    xml += `    <Inmueble>\n`;

    // ── OBLIGATORIO ─────────────────────────────────────────
    xml += `      <IdInmobiliariaExterna>${esc(PISOS_INMOBILIARIA_ID)}</IdInmobiliariaExterna>\n`;
    xml += `      <IdPisoExterno>${esc(p.crm_reference || p.id)}</IdPisoExterno>\n`;
    xml += `      <Expediente>${esc(p.crm_reference || p.id)}</Expediente>\n`;
    xml += `      <TipoInmueble>${pisosTipoInmuebleMap[propType] || '2'}</TipoInmueble>\n`;
    xml += `      <TipoOperacion>${pisosTipoOperacionMap[op] || '1'}</TipoOperacion>\n`;
    xml += `      <NombrePoblacion>${esc(p.city || 'Alicante')}</NombrePoblacion>\n`;
    xml += `      <TipoCalle>Calle</TipoCalle>\n`;
    xml += `      <TipoNumeroCalle></TipoNumeroCalle>\n`;
    xml += `      <NombreCalle>${esc(p.address || p.zone || p.city || 'Sin dirección')}</NombreCalle>\n`;
    xml += `      <NumeroCalle></NumeroCalle>\n`;
    xml += `      <CodigoPostal>${esc(p.zip_code || '03001')}</CodigoPostal>\n`;

    // ── Floor ───────────────────────────────────────────────
    if (p.floor_number) {
      const fl = p.floor_number.toString().trim();
      xml += `      <AlturaPiso>${esc(fl)}</AlturaPiso>\n`;
    } else {
      xml += `      <AlturaPiso></AlturaPiso>\n`;
    }

    xml += `      <MostrarCalle>0</MostrarCalle>\n`;
    xml += `      <Situacion1></Situacion1>\n`;

    // ── Geo ──────────────────────────────────────────────────
    if (p.latitude && p.longitude) {
      xml += `      <Latitud>${p.latitude}</Latitud>\n`;
      xml += `      <Longitud>${p.longitude}</Longitud>\n`;
    } else {
      xml += `      <Latitud></Latitud>\n`;
      xml += `      <Longitud></Longitud>\n`;
    }

    // ── Rooms ───────────────────────────────────────────────
    xml += `      <HabitacionesDobles>${p.bedrooms || 0}</HabitacionesDobles>\n`;
    xml += `      <HabitacionesSimples>0</HabitacionesSimples>\n`;
    xml += `      <BanosCompletos>${p.bathrooms || 0}</BanosCompletos>\n`;
    xml += `      <BanosAuxiliares>0</BanosAuxiliares>\n`;

    // ── OBLIGATORIO: Superficie ─────────────────────────────
    xml += `      <SuperficieConstruida>${p.built_area || p.surface_area || 0}</SuperficieConstruida>\n`;
    xml += `      <SuperficieUtil>${p.surface_area || 0}</SuperficieUtil>\n`;
    xml += `      <SuperficieSolar>${pf.plotSize || 0}</SuperficieSolar>\n`;

    // ── Description ─────────────────────────────────────────
    xml += `      <Descripcion>${cdata(p.description || p.title || 'Propiedad en venta')}</Descripcion>\n`;

    // ── Conservation ────────────────────────────────────────
    xml += `      <EstadoConservacion>${pisosEstadoConservacionMap[pf.condition || ''] || '3'}</EstadoConservacion>\n`;

    // ── Energy certificate ──────────────────────────────────
    if (cert && VALID_CEE_LETTERS.has(cert)) {
      xml += `      <EnergiaConsumoCategoria>${cert}</EnergiaConsumoCategoria>\n`;
      xml += `      <EnergiaConsumoValor>${p.energy_consumption_value || ''}</EnergiaConsumoValor>\n`;
      xml += `      <EnergiaEmisionCategoria>${cert}</EnergiaEmisionCategoria>\n`;
      xml += `      <EnergiaEmisionValor>${p.energy_emissions_value || ''}</EnergiaEmisionValor>\n`;
    } else {
      xml += `      <EnergiaConsumoCategoria></EnergiaConsumoCategoria>\n`;
      xml += `      <EnergiaConsumoValor></EnergiaConsumoValor>\n`;
      xml += `      <EnergiaEmisionCategoria></EnergiaEmisionCategoria>\n`;
      xml += `      <EnergiaEmisionValor></EnergiaEmisionValor>\n`;
    }
    xml += `      <CertificadoNumRegistro></CertificadoNumRegistro>\n`;
    xml += `      <CodigoViviendaTuristica></CodigoViviendaTuristica>\n`;
    xml += `      <EstadoCodigoViviendaTuristica></EstadoCodigoViviendaTuristica>\n`;
    xml += `      <NumeroRegistroAlquiler></NumeroRegistroAlquiler>\n`;

    // ── Price ───────────────────────────────────────────────
    xml += `      <PrecioEur>${Math.round(p.price || 0)}</PrecioEur>\n`;

    // ── Vacation rental prices ──────────────────────────────
    xml += `      <AlquilerVacacional></AlquilerVacacional>\n`;
    xml += `      <PrecioAlquilerVacacionalMes></PrecioAlquilerVacacionalMes>\n`;
    xml += `      <PrecioAlquilerVacacionalSemana></PrecioAlquilerVacacionalSemana>\n`;
    xml += `      <PrecioAlquilerVacacionalDia></PrecioAlquilerVacacionalDia>\n`;
    xml += `      <OpcionACompra></OpcionACompra>\n`;
    xml += `      <PrecioVentaOpcionCompra></PrecioVentaOpcionCompra>\n`;
    xml += `      <IndiceReferenciaPreciosVivienda></IndiceReferenciaPreciosVivienda>\n`;
    xml += `      <PrecioAlquilerAnterior></PrecioAlquilerAnterior>\n`;

    // ── Contact ─────────────────────────────────────────────
    xml += `      <Email></Email>\n`;
    xml += `      <Telefono></Telefono>\n`;
    xml += `      <NumeroVecinos></NumeroVecinos>\n`;
    xml += `      <Destacado>${p.is_featured ? '1' : '0'}</Destacado>\n`;
    xml += `      <Exclusivo>0</Exclusivo>\n`;
    xml += `      <EtiquetaExclusivo></EtiquetaExclusivo>\n`;

    // ── Amenities (tiene/comentario pattern) ────────────────
    // Cocina
    xml += `      <Cocina_tiene>1</Cocina_tiene>\n`;
    xml += `      <Cocina_comentario>${pf.americanKitchen ? 'Cocina americana' : ''}</Cocina_comentario>\n`;
    // Comedor
    xml += `      <Comedor_tiene></Comedor_tiene>\n`;
    xml += `      <Comedor_comentario></Comedor_comentario>\n`;
    // Lavadero
    xml += `      <Lavadero_tiene></Lavadero_tiene>\n`;
    xml += `      <Lavadero_comentario></Lavadero_comentario>\n`;
    // Trastero
    xml += `      <Trastero_tiene>${pf.storageRoom ? '1' : '0'}</Trastero_tiene>\n`;
    xml += `      <Trastero_comentario></Trastero_comentario>\n`;
    // Garaje
    xml += `      <Garaje_tiene>${(p.has_garage || pf.privateGarage > 0) ? '1' : '0'}</Garaje_tiene>\n`;
    xml += `      <Garaje_comentario>${pf.privateGarage > 1 ? pf.privateGarage + ' plazas' : ''}</Garaje_comentario>\n`;
    // Ascensor
    xml += `      <Ascensor_tiene>${p.has_elevator ? '1' : '0'}</Ascensor_tiene>\n`;
    xml += `      <Ascensor_comentario></Ascensor_comentario>\n`;
    // Balcón
    xml += `      <Balcon_tiene></Balcon_tiene>\n`;
    xml += `      <Balcon_comentario></Balcon_comentario>\n`;
    // Terraza
    xml += `      <Terraza_tiene>${p.has_terrace ? '1' : '0'}</Terraza_tiene>\n`;
    xml += `      <Terraza_comentario></Terraza_comentario>\n`;
    // Jardín
    xml += `      <Jardin_tiene>${(p.has_garden || pf.communityGarden) ? '1' : '0'}</Jardin_tiene>\n`;
    xml += `      <Jardin_comentario></Jardin_comentario>\n`;
    // Piscina
    xml += `      <Piscina_tiene>${(p.has_pool || pf.communityPool) ? '1' : '0'}</Piscina_tiene>\n`;
    xml += `      <Piscina_comentario>${pf.communityPool ? 'Comunitaria' : ''}</Piscina_comentario>\n`;
    // Armarios empotrados
    xml += `      <ArmariosEmpotrados_tiene>${pf.builtInWardrobes ? '1' : '0'}</ArmariosEmpotrados_tiene>\n`;
    xml += `      <ArmariosEmpotrados_comentario></ArmariosEmpotrados_comentario>\n`;
    // Calefacción
    xml += `      <Calefaccion_tiene>${pf.heating ? '1' : '0'}</Calefaccion_tiene>\n`;
    xml += `      <Calefaccion_comentario></Calefaccion_comentario>\n`;
    // Aire acondicionado
    xml += `      <AireAcondicionado_tiene>${pf.airConditioning ? '1' : '0'}</AireAcondicionado_tiene>\n`;
    xml += `      <AireAcondicionado_comentario></AireAcondicionado_comentario>\n`;
    // Amueblado
    xml += `      <Amueblado_tiene>${pf.furnished ? '1' : '0'}</Amueblado_tiene>\n`;
    xml += `      <Amueblado_comentario></Amueblado_comentario>\n`;
    // Puerta blindada
    xml += `      <PuertaBlindada_tiene>${pf.armouredDoor ? '1' : '0'}</PuertaBlindada_tiene>\n`;
    xml += `      <PuertaBlindada_comentario></PuertaBlindada_comentario>\n`;
    // Portero automático
    xml += `      <PorteroAutomatico_tiene></PorteroAutomatico_tiene>\n`;
    xml += `      <PorteroAutomatico_comentario></PorteroAutomatico_comentario>\n`;
    // Sistema de seguridad
    xml += `      <SistemaSeguridad_tiene>${pf.alarm ? '1' : '0'}</SistemaSeguridad_tiene>\n`;
    xml += `      <SistemaSeguridad_comentario></SistemaSeguridad_comentario>\n`;
    // Vidrios dobles
    xml += `      <VidriosDobles_tiene></VidriosDobles_tiene>\n`;
    xml += `      <VidriosDobles_comentario></VidriosDobles_comentario>\n`;
    // Chimenea
    xml += `      <Chimenea_tiene></Chimenea_tiene>\n`;
    xml += `      <Chimenea_comentario></Chimenea_comentario>\n`;
    // Suelo
    xml += `      <Suelo_tiene></Suelo_tiene>\n`;
    xml += `      <Suelo_comentario></Suelo_comentario>\n`;
    // Carpintería interior
    xml += `      <CarpinteriaInterior_tiene></CarpinteriaInterior_tiene>\n`;
    xml += `      <CarpinteriaInterior_comentario></CarpinteriaInterior_comentario>\n`;
    // Carpintería exterior
    xml += `      <CarpinteriaExterior_tiene></CarpinteriaExterior_tiene>\n`;
    xml += `      <CarpinteriaExterior_comentario></CarpinteriaExterior_comentario>\n`;
    // Exterior/Interior
    xml += `      <Exterior_tiene>${pf.exterior ? '1' : ''}</Exterior_tiene>\n`;
    xml += `      <Exterior_comentario></Exterior_comentario>\n`;
    xml += `      <Interior_tiene>${!pf.exterior ? '1' : ''}</Interior_tiene>\n`;
    xml += `      <Interior_comentario></Interior_comentario>\n`;
    // Orientación
    {
      const orientEs: Record<string, string> = { north: 'Norte', south: 'Sur', east: 'Este', west: 'Oeste' };
      xml += `      <Orientacion_tiene>${pf.orientation ? '1' : ''}</Orientacion_tiene>\n`;
      xml += `      <Orientacion_comentario>${pf.orientation ? (orientEs[pf.orientation] || '') : ''}</Orientacion_comentario>\n`;
    }
    // Soleado
    xml += `      <Soleado_tiene></Soleado_tiene>\n`;
    xml += `      <Soleado_comentario></Soleado_comentario>\n`;
    // Año construcción
    xml += `      <AnoConstruccion_tiene>${p.year_built ? '1' : ''}</AnoConstruccion_tiene>\n`;
    xml += `      <AnoConstruccion_comentario>${p.year_built || ''}</AnoConstruccion_comentario>\n`;
    // Gastos comunidad
    xml += `      <GastosComunidad_tiene></GastosComunidad_tiene>\n`;
    xml += `      <GastosComunidad_comentario></GastosComunidad_comentario>\n`;
    // Suministros
    xml += `      <SuministroAgua_tiene></SuministroAgua_tiene>\n`;
    xml += `      <SuministroAgua_comentario></SuministroAgua_comentario>\n`;
    xml += `      <SuministroElectrico_tiene></SuministroElectrico_tiene>\n`;

    // ── Images (Pisos.com uses <Fotos> block with <Url> + <Etiqueta>) ──
    if (imgs.length > 0) {
      xml += `      <Fotos>\n`;
      for (let i = 0; i < imgs.length; i++) {
        xml += `        <Foto>\n`;
        xml += `          <Url>${esc(imgs[i])}</Url>\n`;
        xml += `          <Etiqueta>${i + 1}</Etiqueta>\n`;
        xml += `        </Foto>\n`;
      }
      xml += `      </Fotos>\n`;
    }

    // ── Videos ──────────────────────────────────────────────
    const videoUrls: string[] = Array.isArray(p.videos) ? p.videos : [];
    if (videoUrls.length > 0) {
      xml += `      <VideosExternos>\n`;
      for (const v of videoUrls) {
        xml += `        <Video>${esc(v)}</Video>\n`;
      }
      xml += `      </VideosExternos>\n`;
    }

    // ── Virtual tours ───────────────────────────────────────
    if (p.virtual_tour_url) {
      xml += `      <ToursVirtuales>\n`;
      xml += `        <TourVirtual>${esc(p.virtual_tour_url)}</TourVirtual>\n`;
      xml += `      </ToursVirtuales>\n`;
    }

    xml += `    </Inmueble>\n`;
  }

  xml += `  </Table>\n`;
  xml += `</Publicacion>`;
  return xml;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing ?token= parameter', { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Find portal feed by token
    const { data: feed, error: feedErr } = await supabase
      .from('portal_feeds')
      .select('*')
      .eq('feed_token', token)
      .single();

    if (feedErr || !feed) {
      return new Response('Feed not found', { status: 404, headers: corsHeaders });
    }

    if (!feed.is_active) {
      return new Response('Feed is disabled', { status: 403, headers: corsHeaders });
    }

    // Get excluded property IDs
    const { data: exclusions } = await supabase
      .from('portal_property_exclusions')
      .select('property_id')
      .eq('portal_feed_id', feed.id);
    const excludedIds = new Set((exclusions || []).map((e: any) => e.property_id));

    // Fetch ALL useful fields for maximum portal quality
    const FIELDS = `id, crm_reference, title, description, property_type, secondary_property_type, operation, price,
      surface_area, built_area, bedrooms, bathrooms, floor_number,
      floor, staircase, door, country,
      city, province, address, zip_code, zone,
      energy_cert, energy_consumption_value, energy_emissions_value, has_elevator, has_garage, has_pool, has_terrace, has_garden,
      features, images, image_order, videos, virtual_tour_url,
      latitude, longitude, status, updated_at, is_featured, floor_plans, tags, xml_id, year_built`;

    const { data: properties, error: propErr } = await supabase
      .from('properties')
      .select(FIELDS)
      .eq('status', 'disponible')
      .order('updated_at', { ascending: false });

    if (propErr) throw propErr;

    // Filter out excluded properties, 'otro' type, and international properties
    let filtered = (properties || []).filter((p: any) =>
      !excludedIds.has(p.id) &&
      p.property_type !== 'otro' &&
      (!p.country || p.country === 'España')
    );

    const format = feed.format || 'kyero';

    // ── Apply feed-level filters ────────────────────────────────────────────
    const filters = feed.filters as Record<string, any> | null;
    if (filters?.min_price) {
      filtered = filtered.filter((p: any) => (p.price || 0) >= filters.min_price);
    }
    if (filters?.min_images) {
      filtered = filtered.filter((p: any) => resolvePortalImageUrls(p).length >= filters.min_images);
    }

    // Auto-tag: add tag to properties that pass filters but don't have it yet
    if (filters?.auto_tag) {
      const tag = filters.auto_tag as string;
      const idsToTag = filtered
        .filter((p: any) => !(p.tags || []).includes(tag))
        .map((p: any) => p.id);
      if (idsToTag.length > 0) {
        for (const pid of idsToTag) {
          const prop = filtered.find((p: any) => p.id === pid);
          const currentTags = prop?.tags || [];
          await supabase
            .from('properties')
            .update({ tags: [...currentTags, tag] })
            .eq('id', pid);
        }
      }
    }
    // ── Duplicate entries for properties with secondary_property_type ───────
    // Each duplicate gets a suffixed id/ref and the secondary type as primary
    const extras: any[] = [];
    for (const p of filtered) {
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
    filtered = [...filtered, ...extras];

    const activeIds = new Set(filtered.map((p: any) => p.id));

    // ── Tracking: detect deleted properties ─────────────────────────────────
    // Get all properties previously sent to this portal
    const { data: tracking } = await supabase
      .from('portal_feed_properties')
      .select('property_id, removed_at')
      .eq('portal_feed_id', feed.id);

    // Properties that were sent before but are no longer active
    const newlyRemoved: string[] = [];
    const alreadyRemoved: { property_id: string; removed_at: string }[] = [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const t of (tracking || [])) {
      if (activeIds.has(t.property_id)) continue; // still active, skip
      if (!t.removed_at) {
        newlyRemoved.push(t.property_id);
      } else if (t.removed_at > thirtyDaysAgo) {
        alreadyRemoved.push(t);
      }
    }

    // Get crm_reference for deleted properties (we need it for the XML)
    const deletedIds = [...newlyRemoved, ...alreadyRemoved.map(r => r.property_id)];
    let deletedRefs: Record<string, string> = {};
    if (deletedIds.length > 0) {
      const { data: delProps } = await supabase
        .from('properties')
        .select('id, crm_reference')
        .in('id', deletedIds);
      for (const dp of (delProps || [])) {
        deletedRefs[dp.id] = dp.crm_reference || dp.id;
      }
    }

    let translations: Translations = {};
    if (format === 'kyero') {
      translations = await translatePremiumProperties(filtered);
    }

    // Generate output based on format
    let output: string;
    let contentType: string;
    const sUrl = Deno.env.get('SUPABASE_URL')!;
    const deletedRefList = deletedIds.map(id => deletedRefs[id] || id);

    if (format === 'fotocasa') {
      output = toFotocasaXml(filtered, sUrl);
      if (deletedRefList.length > 0) {
        const deletedXml = deletedRefList.map(ref =>
          `  <ad>\n    <id>${esc(ref)}</id>\n    <status>deleted</status>\n  </ad>`
        ).join('\n');
        output = output.replace('</feed>', deletedXml + '\n</feed>');
      }
      contentType = 'application/xml; charset=utf-8';
    } else if (format === 'pisos' || format === 'todopisos') {
      output = toPisosXml(filtered, sUrl);
      contentType = 'application/xml; charset=utf-8';
    } else {
      output = toKyeroXml(filtered, feed.portal_name, sUrl, translations);
      if (deletedRefList.length > 0) {
        const deletedXml = deletedRefList.map(ref =>
          `  <property>\n    <id>${esc(ref)}</id>\n    <deleted>1</deleted>\n  </property>`
        ).join('\n');
        output = output.replace('</root>', deletedXml + '\n</root>');
      }
      contentType = 'application/xml; charset=utf-8';
    }

    // ── Update tracking (fire-and-forget) ───────────────────────────────────
    const now = new Date().toISOString();

    // Upsert active properties
    // Filter out duplicated -T2 entries (non-UUID) for tracking
    const trackableProperties = filtered.filter((p: any) => !p.id.includes('-T2'));
    if (trackableProperties.length > 0) {
      const upsertRows = trackableProperties.map((p: any) => ({
        portal_feed_id: feed.id,
        property_id: p.id,
        first_sent_at: now,
        last_sent_at: now,
        removed_at: null,
      }));
      supabase
        .from('portal_feed_properties')
        .upsert(upsertRows, { onConflict: 'portal_feed_id,property_id' })
        .then(({ error }) => {
          if (error) console.warn('[portal-xml-feed] upsert tracking error:', error.message);
        });
    }

    // Mark newly removed
    if (newlyRemoved.length > 0) {
      supabase
        .from('portal_feed_properties')
        .update({ removed_at: now })
        .eq('portal_feed_id', feed.id)
        .in('property_id', newlyRemoved)
        .then(({ error }) => {
          if (error) console.warn('[portal-xml-feed] mark removed error:', error.message);
        });
    }

    // Purge old removals (>30 days)
    supabase
      .from('portal_feed_properties')
      .delete()
      .eq('portal_feed_id', feed.id)
      .lt('removed_at', thirtyDaysAgo)
      .then(({ error }) => {
        if (error) console.warn('[portal-xml-feed] purge error:', error.message);
      });

    // Update last_accessed_at and properties_count (fire-and-forget)
    supabase
      .from('portal_feeds')
      .update({
        last_accessed_at: now,
        properties_count: filtered.length,
      })
      .eq('id', feed.id)
      .then(({ error }) => {
        if (error) console.warn('[portal-xml-feed] update error:', error.message);
      });

    return new Response(output, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=900',
      },
    });
  } catch (err) {
    console.error('[portal-xml-feed] error:', err);
    return new Response(`Error: ${err}`, { status: 500, headers: corsHeaders });
  }
});
