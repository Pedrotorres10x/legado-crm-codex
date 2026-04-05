import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';

const STATEFOX_BASE_URL = 'https://statefox.com/public/aapi/props';
const DEFAULT_ITEMS = 50;
const MAX_ITEMS = 500;
const MAX_RANGE_DAYS = 31;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type QueryMode = 'search' | 'search_day' | 'search_range' | 'lookup_ids' | 'import';

type StatefoxSearchBody = {
  action?: QueryMode;
  source?: 'idealista' | 'fotocasa' | 'pisoscom' | 'habitaclia';
  type?: 'sale' | 'rent';
  housing?: string;
  insert?: string;
  startDate?: string;
  endDate?: string;
  items?: number;
  advertiserType?: 'all' | 'private' | 'professional';
  ids?: string[];
  listings?: NormalizedListing[];
};

type StatefoxProperty = {
  _id?: string;
  pType?: string;
  pStatus?: string;
  pHousing?: string;
  pDesc?: string;
  pDescription?: string;
  pAdvert?: {
    type?: string;
    name?: string;
  };
  pPrivate?: {
    name?: string;
  };
  pPrice?: number;
  pRooms?: number;
  pBaths?: number;
  pAddress?: string;
  pMeters?: {
    built?: number;
    usable?: number;
  };
  pPhones?: string[];
  pPricePerMeter?: number;
  pLink?: string;
  propertyMainImage?: string;
  pImages?: Record<string, { src?: string }> | string[];
  pDate?: {
    insert?: string;
    seen?: string;
  };
  pCity?: {
    cityName?: string;
    cityRegion?: string;
  } | string;
  pZone?: {
    name?: string;
  } | string;
  pRef?: string;
};

type NormalizedListing = {
  listingId: string;
  source: string;
  type: string;
  housing: string;
  status: string;
  advertiserName: string;
  advertiserType: string;
  price: number | null;
  rooms: number | null;
  baths: number | null;
  address: string;
  city: string;
  region: string;
  zone: string;
  builtArea: number | null;
  usableArea: number | null;
  pricePerMeter: number | null;
  phones: string[];
  insertDate: string | null;
  link: string;
  description: string;
  imageUrl: string;
};

type SearchError = {
  date?: string | null;
  message: string;
};

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPhone(value: string): string {
  return value.replace(/[^\d+]/g, '').trim();
}

function clipText(value: string, max = 800): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizePhoneForMatch(value: string | null | undefined): string {
  const digits = (value || '').replace(/\D/g, '');
  return digits.replace(/^(34|0034)/, '');
}

function ensureIsoDate(value: string | null | undefined): string | null {
  const text = (value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : text;
}

function getDateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return Array.from({ length: Math.max(days, 0) }, (_, index) => {
    const next = new Date(start.getTime() + (index * MS_PER_DAY));
    return next.toISOString().slice(0, 10);
  });
}

function normalizeItems(value: number | undefined): number {
  return Math.min(Math.max(Number(value || DEFAULT_ITEMS), 1), MAX_ITEMS);
}

function getImageUrl(property: StatefoxProperty): string {
  if (typeof property.propertyMainImage === 'string' && property.propertyMainImage.trim()) {
    return property.propertyMainImage.trim();
  }

  if (Array.isArray(property.pImages)) {
    return (property.pImages.find((image) => typeof image === 'string' && image.trim()) as string | undefined) || '';
  }

  if (property.pImages && typeof property.pImages === 'object') {
    for (const value of Object.values(property.pImages)) {
      if (value?.src) return value.src;
    }
  }

  return '';
}

function normalizeListing(source: string, propertyId: string, property: StatefoxProperty): NormalizedListing {
  const zone = typeof property.pZone === 'string'
    ? property.pZone
    : property.pZone?.name || '';

  const cityName = typeof property.pCity === 'string'
    ? property.pCity
    : property.pCity?.cityName || '';

  const region = typeof property.pCity === 'string'
    ? ''
    : property.pCity?.cityRegion || '';

  return {
    listingId: property._id || property.pRef || propertyId,
    source,
    type: property.pType || '',
    housing: property.pHousing || '',
    status: property.pStatus || '',
    advertiserName: property.pAdvert?.name || property.pPrivate?.name || '',
    advertiserType: property.pAdvert?.type || '',
    price: Number.isFinite(property.pPrice) ? Number(property.pPrice) : null,
    rooms: Number.isFinite(property.pRooms) ? Number(property.pRooms) : null,
    baths: Number.isFinite(property.pBaths) ? Number(property.pBaths) : null,
    address: property.pAddress || '',
    city: cityName,
    region,
    zone,
    builtArea: Number.isFinite(property.pMeters?.built) ? Number(property.pMeters?.built) : null,
    usableArea: Number.isFinite(property.pMeters?.usable) ? Number(property.pMeters?.usable) : null,
    pricePerMeter: Number.isFinite(property.pPricePerMeter) ? Number(property.pPricePerMeter) : null,
    phones: Array.isArray(property.pPhones)
      ? property.pPhones.map(cleanPhone).filter(Boolean)
      : [],
    insertDate: property.pDate?.insert || null,
    link: property.pLink || '',
    description: clipText(property.pDesc || property.pDescription || ''),
    imageUrl: getImageUrl(property),
  };
}

function normalizePropertiesPayload(payload: unknown): Record<string, StatefoxProperty> {
  if (!payload || typeof payload !== 'object') return {};
  const record = payload as Record<string, unknown>;
  const properties = record.properties;
  const result = record.result;

  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    return properties as Record<string, StatefoxProperty>;
  }

  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return result as Record<string, StatefoxProperty>;
  }

  return {};
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

async function fetchStatefoxJson(path: string, params: URLSearchParams) {
  const token = Deno.env.get('STATEFOX_TOKEN');
  if (!token) {
    return { ok: false as const, status: 500, error: 'STATEFOX_TOKEN not configured', payload: null };
  }

  const response = await fetch(`${STATEFOX_BASE_URL}${path}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Statefox HTTP ${response.status}`;
    return { ok: false as const, status: response.status, error: message, payload };
  }

  return { ok: true as const, status: response.status, payload };
}

function applyAdvertiserFilter(listings: NormalizedListing[], advertiserType: StatefoxSearchBody['advertiserType']) {
  if (!advertiserType || advertiserType === 'all') return listings;
  return listings.filter((listing) => normalizeText(listing.advertiserType) === advertiserType);
}

async function searchDay(body: StatefoxSearchBody) {
  const source = body.source || 'idealista';
  const type = body.type || 'sale';
  const housing = body.housing || 'flat';
  const items = normalizeItems(body.items);
  const insert = ensureIsoDate(body.insert) || ensureIsoDate(body.startDate);

  if (!insert) {
    return json({ error: 'Fecha de alta obligatoria en formato Y-m-d' }, 400);
  }

  const params = new URLSearchParams({
    source,
    type,
    housing,
    items: String(items),
    insert,
    page: '1',
  });

  const response = await fetchStatefoxJson('/properties', params);
  if (!response.ok) {
    return json({ error: response.error }, response.status);
  }

  const properties = normalizePropertiesPayload(response.payload);
  const listings = applyAdvertiserFilter(
    Object.entries(properties).map(([propertyId, property]) => normalizeListing(source, propertyId, property)),
    body.advertiserType,
  );

  const rawMeta = response.payload && typeof response.payload === 'object'
    ? (response.payload as Record<string, unknown>).meta as Record<string, unknown> | undefined
    : undefined;

  return json({
    listings,
    meta: {
      mode: 'day',
      source,
      type,
      housing,
      insert,
      advertiserType: body.advertiserType || 'all',
      items,
      pagesFetched: 1,
      datesProcessed: [insert],
      totalFound: Number(rawMeta?.total || Object.keys(properties).length || 0),
      totalNormalized: listings.length,
      errors: [],
    },
  });
}

async function searchRange(body: StatefoxSearchBody) {
  const source = body.source || 'idealista';
  const type = body.type || 'sale';
  const housing = body.housing || 'flat';
  const items = normalizeItems(body.items);
  const startDate = ensureIsoDate(body.startDate) || ensureIsoDate(body.insert);
  const endDate = ensureIsoDate(body.endDate) || startDate;

  if (!startDate || !endDate) {
    return json({ error: 'Debes indicar fecha de inicio y fin en formato Y-m-d' }, 400);
  }

  if (endDate < startDate) {
    return json({ error: 'La fecha fin no puede ser menor que la fecha inicio' }, 400);
  }

  const dates = getDateRange(startDate, endDate);
  if (dates.length > MAX_RANGE_DAYS) {
    return json({ error: `El rango maximo permitido es de ${MAX_RANGE_DAYS} dias por consulta` }, 400);
  }

  const deduped = new Map<string, NormalizedListing>();
  const errors: SearchError[] = [];
  let pagesFetched = 0;
  let totalFound = 0;

  for (const date of dates) {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const params = new URLSearchParams({
        source,
        type,
        housing,
        items: String(items),
        insert: date,
        page: String(page),
      });

      const response = await fetchStatefoxJson('/properties', params);
      if (!response.ok) {
        errors.push({ date, message: response.error });
        break;
      }

      pagesFetched += 1;
      const properties = normalizePropertiesPayload(response.payload);
      const normalized = applyAdvertiserFilter(
        Object.entries(properties).map(([propertyId, property]) => normalizeListing(source, propertyId, property)),
        body.advertiserType,
      );

      for (const listing of normalized) {
        deduped.set(listing.listingId, listing);
      }

      const rawMeta = response.payload && typeof response.payload === 'object'
        ? (response.payload as Record<string, unknown>).meta as Record<string, unknown> | undefined
        : undefined;

      const total = Number(rawMeta?.total || Object.keys(properties).length || 0);
      const perPage = Number(rawMeta?.items || items || 1);
      totalFound += Number(rawMeta?.items || Object.keys(properties).length || 0);
      totalPages = Math.max(Math.ceil(total / Math.max(perPage, 1)), 1);
      page += 1;
    }
  }

  return json({
    listings: Array.from(deduped.values()),
    meta: {
      mode: 'range',
      source,
      type,
      housing,
      advertiserType: body.advertiserType || 'all',
      startDate,
      endDate,
      items,
      pagesFetched,
      datesProcessed: dates,
      totalFound,
      totalNormalized: deduped.size,
      errors,
    },
  });
}

async function lookupIds(body: StatefoxSearchBody) {
  const ids = Array.from(new Set((Array.isArray(body.ids) ? body.ids : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)));

  if (ids.length === 0) {
    return json({ error: 'Debes indicar al menos un ID de Statefox' }, 400);
  }

  const params = new URLSearchParams({
    ids: ids.join(','),
  });

  const response = await fetchStatefoxJson('/ids', params);
  if (!response.ok) {
    return json({ error: response.error }, response.status);
  }

  const properties = normalizePropertiesPayload(response.payload);
  const inferredSource = body.source || 'idealista';
  const listings = applyAdvertiserFilter(
    Object.entries(properties).map(([propertyId, property]) => normalizeListing(inferredSource, propertyId, property)),
    body.advertiserType,
  );

  return json({
    listings,
    meta: {
      mode: 'ids',
      source: body.source || null,
      advertiserType: body.advertiserType || 'all',
      ids,
      items: ids.length,
      pagesFetched: 1,
      datesProcessed: [],
      totalFound: Object.keys(properties).length,
      totalNormalized: listings.length,
      errors: [],
    },
  });
}

function buildContactName(listing: NormalizedListing): string {
  if (listing.advertiserName.trim()) return listing.advertiserName.trim();
  if (listing.address.trim()) return `Propietario ${listing.address.trim()}`;
  return `Propietario ${listing.city || listing.listingId}`;
}

function buildNotes(listing: NormalizedListing): string {
  const parts = [
    '[Statefox] Captación desde portal',
    'Objetivo: llamar y validar si acepta visita de captación',
    `Portal: ${listing.source}`,
    `Tipo anunciante: ${listing.advertiserType || 'n/d'}`,
    `Operación: ${listing.type || 'n/d'}`,
    `Tipo inmueble: ${listing.housing || 'n/d'}`,
    listing.price ? `Precio publicado: ${listing.price.toLocaleString('es-ES')} €` : null,
    listing.rooms ? `Habitaciones: ${listing.rooms}` : null,
    listing.baths ? `Baños: ${listing.baths}` : null,
    listing.builtArea ? `m² construidos: ${listing.builtArea}` : null,
    listing.address ? `Dirección: ${listing.address}` : null,
    listing.city ? `Ciudad: ${listing.city}` : null,
    listing.region ? `Provincia/Región: ${listing.region}` : null,
    listing.zone ? `Zona: ${listing.zone}` : null,
    listing.link ? `Enlace anuncio: ${listing.link}` : null,
    listing.description ? `Descripción: ${listing.description}` : null,
  ];

  return parts.filter(Boolean).join('\n');
}

function buildTaskDescription(listing: NormalizedListing): string {
  const parts = [
    `Primer toque a prospecto captado desde Statefox (${listing.source}).`,
    listing.address ? `Dirección: ${listing.address}` : null,
    listing.city ? `Ciudad: ${listing.city}` : null,
    listing.price ? `Precio publicado: ${listing.price.toLocaleString('es-ES')} €` : null,
    listing.phones[0] ? `Teléfono principal: ${listing.phones[0]}` : 'No hay teléfono visible; revisar anuncio.',
    listing.link ? `Anuncio: ${listing.link}` : null,
    'Objetivo: confirmar titularidad, validar timing de venta y buscar visita de captación.',
  ];

  return parts.filter(Boolean).join('\n');
}

async function importListings(req: Request, body: StatefoxSearchBody) {
  const user = await requireUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const listings = Array.isArray(body.listings) ? body.listings : [];
  if (listings.length === 0) {
    return json({ error: 'No listings provided' }, 400);
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const refs = listings.map((listing) => `statefox:${listing.listingId}`);
  const urls = listings.map((listing) => listing.link).filter(Boolean);
  const phones = listings.flatMap((listing) => listing.phones).filter(Boolean);
  const existing = new Map<string, string>();
  const normalizedPhones = Array.from(new Set(phones.map(normalizePhoneForMatch).filter(Boolean)));

  if (refs.length > 0) {
    const { data } = await service.from('contacts').select('id, source_ref').in('source_ref', refs);
    for (const row of data || []) existing.set(`ref:${row.source_ref}`, row.id);
  }

  if (urls.length > 0) {
    const { data } = await service.from('contacts').select('id, source_url').in('source_url', urls);
    for (const row of data || []) existing.set(`url:${row.source_url}`, row.id);
  }

  if (phones.length > 0) {
    const uniquePhones = Array.from(new Set(phones));
    const { data } = await service.from('contacts').select('id, phone, phone2').or(
      uniquePhones.map((phone) => `phone.eq.${phone},phone2.eq.${phone}`).join(','),
    );
    for (const row of data || []) {
      if ((row as { phone?: string }).phone) existing.set(`phone:${(row as { phone?: string }).phone}`, row.id);
      if ((row as { phone2?: string }).phone2) existing.set(`phone:${(row as { phone2?: string }).phone2}`, row.id);
    }
  }

  if (normalizedPhones.length > 0) {
    const { data } = await service.from('contacts').select('id, phone, phone2');
    for (const row of data || []) {
      const phone = normalizePhoneForMatch((row as { phone?: string }).phone);
      const phone2 = normalizePhoneForMatch((row as { phone2?: string }).phone2);
      if (phone && normalizedPhones.includes(phone)) existing.set(`phone-normalized:${phone}`, row.id);
      if (phone2 && normalizedPhones.includes(phone2)) existing.set(`phone-normalized:${phone2}`, row.id);
    }
  }

  const imported: Array<{ listingId: string; contactId: string; fullName: string }> = [];
  const skipped: Array<{ listingId: string; reason: string; contactId?: string }> = [];

  for (const listing of listings) {
    const refKey = `ref:statefox:${listing.listingId}`;
    const urlKey = listing.link ? `url:${listing.link}` : '';
    const duplicateId =
      existing.get(refKey) ||
      (urlKey ? existing.get(urlKey) : undefined) ||
      listing.phones
        .map((phone) => existing.get(`phone:${phone}`) || existing.get(`phone-normalized:${normalizePhoneForMatch(phone)}`))
        .find(Boolean);

    if (duplicateId) {
      skipped.push({ listingId: listing.listingId, reason: 'duplicate', contactId: duplicateId });
      await service.from('portal_leads').insert({
        portal_name: 'statefox',
        contact_id: duplicateId,
        raw_email_subject: `Statefox duplicate ${listing.listingId}`,
        raw_email_from: 'statefox-prospecting',
        extracted_data: listing,
        status: 'duplicado',
      } as never);
      continue;
    }

    const tags = Array.from(new Set([
      'Statefox',
      'Captacion',
      listing.source || 'portal',
      listing.type === 'rent' ? 'Alquiler' : 'Venta',
      listing.advertiserType === 'private' ? 'Particular' : 'Profesional',
    ]));

    const fullName = buildContactName(listing);
    const phone = listing.phones[0] || null;
    const phone2 = listing.phones[1] || null;
    const sourceRef = `statefox:${listing.listingId}`;

    const { data: contact, error } = await service
      .from('contacts')
      .insert({
        full_name: fullName,
        phone,
        phone2,
        city: listing.city || null,
        contact_type: 'prospecto',
        status: 'nuevo',
        pipeline_stage: 'prospecto',
        notes: buildNotes(listing),
        tags,
        agent_id: user.id,
        source_ref: sourceRef,
        source_url: listing.link || null,
      } as never)
      .select('id, full_name')
      .single();

    if (error || !contact) {
      skipped.push({ listingId: listing.listingId, reason: error?.message || 'insert_failed' });
      continue;
    }

    await service.from('interactions').insert({
      contact_id: contact.id,
      agent_id: user.id,
      interaction_type: 'nota',
      subject: 'Captación importada desde Statefox',
      description: `Lead de captación importado desde ${listing.source}. ${listing.link || listing.address || listing.listingId}`,
    } as never);

    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 24);

    await service.from('tasks').insert({
      agent_id: user.id,
      contact_id: contact.id,
      title: `Primer contacto Statefox: ${fullName}`,
      description: buildTaskDescription(listing),
      due_date: dueDate.toISOString(),
      priority: 'alta',
      task_type: 'seguimiento',
      source: 'statefox',
      completed: false,
    } as never);

    await service.from('portal_leads').insert({
      portal_name: 'statefox',
      contact_id: contact.id,
      raw_email_subject: `Statefox ${listing.listingId}`,
      raw_email_from: 'statefox-prospecting',
      extracted_data: listing,
      status: 'nuevo',
    } as never);

    imported.push({
      listingId: listing.listingId,
      contactId: contact.id,
      fullName: contact.full_name,
    });

    existing.set(refKey, contact.id);
    if (urlKey) existing.set(urlKey, contact.id);
    for (const listingPhone of listing.phones) {
      existing.set(`phone:${listingPhone}`, contact.id);
      const normalizedPhone = normalizePhoneForMatch(listingPhone);
      if (normalizedPhone) existing.set(`phone-normalized:${normalizedPhone}`, contact.id);
    }
  }

  return json({
    imported,
    skipped,
    summary: {
      requested: listings.length,
      imported: imported.length,
      skipped: skipped.length,
    },
  });
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const user = await requireUser(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  let body: StatefoxSearchBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (body.action === 'import') {
    return importListings(req, body);
  }

  if (body.action === 'lookup_ids') {
    return lookupIds(body);
  }

  if (body.action === 'search_range') {
    return searchRange(body);
  }

  return searchDay(body);
});
