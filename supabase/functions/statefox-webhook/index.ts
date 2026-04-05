import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCors, json } from '../_shared/cors.ts';

type AnyRecord = Record<string, unknown>;

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizePhone(value: unknown): string {
  return String(value ?? '').replace(/[^\d+]/g, '').trim();
}

function normalizePhoneForMatch(value: unknown): string {
  return normalizePhone(value).replace(/\D/g, '').replace(/^(34|0034)/, '');
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function collectPhones(payload: AnyRecord, advert: AnyRecord | null): string[] {
  const phoneCandidates = [
    payload.phone,
    payload.phone1,
    payload.phone2,
    payload.mobile,
    payload.telephone,
    advert?.phone,
    advert?.mobile,
    ...asArray(payload.phones),
    ...asArray(advert?.phones),
  ];

  return Array.from(new Set(
    phoneCandidates
      .map(normalizePhone)
      .filter(Boolean),
  ));
}

function clipText(value: string, max = 1200) {
  return value.slice(0, max);
}

function getPropertyEntries(payload: AnyRecord): Array<{ propertyIdHint: string; property: AnyRecord }> {
  const propertiesMap = asRecord(payload.properties) || asRecord(payload.result);
  if (propertiesMap) {
    return Object.entries(propertiesMap)
      .map(([propertyIdHint, value]) => ({ propertyIdHint, property: asRecord(value) }))
      .filter((entry): entry is { propertyIdHint: string; property: AnyRecord } => Boolean(entry.property));
  }

  return [{ propertyIdHint: '', property: payload }];
}

function extractListing(payload: AnyRecord, propertyIdHint = '') {
  const nestedPayloadEntry = Object.values(payload)
    .map((value) => asRecord(value))
    .find((value) => Boolean(value && (value.id || value.link || value.desc)));

  const property =
    asRecord(payload.property) ||
    asRecord(payload.listing) ||
    nestedPayloadEntry ||
    payload;
  const advert =
    asRecord(property.pAdvert) ||
    asRecord(property.advert) ||
    asRecord(property.advertiser) ||
    asRecord(payload.advert) ||
    asRecord(payload.advertiser);
  const city = asRecord(property.pCity) || asRecord(payload.city_info);
  const zone = asRecord(property.pZone) || asRecord(payload.zone_info);

  const phones = collectPhones(property, advert);
  const listingId = firstString(
    property._id,
    property.id,
    property.ref,
    property.propertyId,
    property.listingId,
    propertyIdHint,
    payload._id,
    payload.id,
  );

  const source = firstString(property.source, payload.source, payload.portal, 'statefox');
  const advertiserName = firstString(
    advert?.name,
    property.contact_name,
    payload.contact_name,
    payload.owner_name,
  );
  const advertiserType = firstString(
    advert?.type,
    property.advertiser_type,
    payload.advertiser_type,
    typeof property.private === 'boolean' ? (property.private ? 'private' : 'professional') : '',
    'private',
  );

  const address = firstString(property.pAddress, property.address, payload.address);
  const cityName = firstString(city?.cityName, property.city, payload.city);
  const region = firstString(city?.cityRegion, property.region, payload.region, payload.province);
  const zoneName = typeof zone === 'string' ? zone : firstString(zone?.name, property.zone, payload.zone);
  const link = firstString(property.pLink, property.link, payload.link, payload.url);
  const description = clipText(firstString(property.pDesc, property.description, property.desc, payload.description, payload.desc));
  const operation = firstString(property.pType, property.type, payload.type, payload.operation);
  const housing = firstString(property.pHousing, property.housing, payload.housing, payload.property_type);

  return {
    listingId,
    source,
    advertiserName,
    advertiserType,
    address,
    cityName,
    region,
    zoneName,
    link,
    description,
    operation,
    housing,
    price: firstNumber(property.pPrice, property.price, payload.price),
    rooms: firstNumber(property.pRooms, property.rooms, payload.rooms),
    baths: firstNumber(property.pBaths, property.baths, payload.baths),
    builtArea: firstNumber(
      asRecord(property.pMeters)?.built,
      asRecord(property.meters)?.built,
      property.built_area,
      payload.built_area,
      payload.surface_area,
    ),
    insertDate: firstString(
      asRecord(property.pDate)?.insert,
      property.insert_date,
      payload.insert_date,
      payload.date,
    ),
    phones,
    raw: property,
  };
}

function looksLikeStatefoxTestPayload(payload: AnyRecord) {
  const queue: unknown[] = [payload];

  while (queue.length > 0) {
    const current = queue.shift();
    const item = asRecord(current);
    if (!item) continue;

    const hasTestShape =
      typeof item.id === 'string' &&
      typeof item.type === 'string' &&
      typeof item.link === 'string' &&
      typeof item.housing === 'string' &&
      (typeof item.desc === 'string' || typeof item.description === 'string');

    if (hasTestShape) return true;

    for (const value of Object.values(item)) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  const serialized = JSON.stringify(payload).toLowerCase();
  return (
    serialized.includes('statefox.com/test') &&
    serialized.includes('property description')
  );
}

function buildNotes(listing: ReturnType<typeof extractListing>) {
  return [
    '[Statefox Push] Prospecto importado automáticamente',
    'Objetivo: llamar y validar si acepta visita de captación.',
    `Portal: ${listing.source || 'statefox'}`,
    `Tipo anunciante: ${listing.advertiserType || 'n/d'}`,
    listing.operation ? `Operación: ${listing.operation}` : null,
    listing.housing ? `Tipo inmueble: ${listing.housing}` : null,
    listing.price ? `Precio publicado: ${listing.price.toLocaleString('es-ES')} €` : null,
    listing.rooms ? `Habitaciones: ${listing.rooms}` : null,
    listing.baths ? `Baños: ${listing.baths}` : null,
    listing.builtArea ? `m² construidos: ${listing.builtArea}` : null,
    listing.address ? `Dirección: ${listing.address}` : null,
    listing.cityName ? `Ciudad: ${listing.cityName}` : null,
    listing.region ? `Provincia/Región: ${listing.region}` : null,
    listing.zoneName ? `Zona: ${listing.zoneName}` : null,
    listing.link ? `Enlace anuncio: ${listing.link}` : null,
    listing.description ? `Descripción: ${listing.description}` : null,
  ].filter(Boolean).join('\n');
}

function buildTaskDescription(listing: ReturnType<typeof extractListing>) {
  return [
    `Primer toque a prospecto captado desde Statefox Push (${listing.source || 'statefox'}).`,
    listing.address ? `Dirección: ${listing.address}` : null,
    listing.cityName ? `Ciudad: ${listing.cityName}` : null,
    listing.price ? `Precio publicado: ${listing.price.toLocaleString('es-ES')} €` : null,
    listing.phones[0] ? `Teléfono principal: ${listing.phones[0]}` : 'No hay teléfono visible; revisar payload.',
    listing.link ? `Anuncio: ${listing.link}` : null,
    'Objetivo: confirmar titularidad, validar timing de venta y buscar visita de captación.',
  ].filter(Boolean).join('\n');
}

async function processListing(
  supabase: ReturnType<typeof createClient>,
  listing: ReturnType<typeof extractListing>,
  payload: AnyRecord,
) {
  const sourceRef = listing.listingId ? `statefox:${listing.listingId}` : null;
  const normalizedPhones = listing.phones.map(normalizePhoneForMatch).filter(Boolean);
  const existing = new Map<string, string>();

  if (sourceRef) {
    const { data } = await supabase.from('contacts').select('id, source_ref').eq('source_ref', sourceRef);
    for (const row of data || []) existing.set(`ref:${row.source_ref}`, row.id);
  }

  if (listing.link) {
    const { data } = await supabase.from('contacts').select('id, source_url').eq('source_url', listing.link);
    for (const row of data || []) existing.set(`url:${row.source_url}`, row.id);
  }

  if (normalizedPhones.length > 0) {
    const { data } = await supabase.from('contacts').select('id, phone, phone2');
    for (const row of data || []) {
      const phone = normalizePhoneForMatch((row as AnyRecord).phone);
      const phone2 = normalizePhoneForMatch((row as AnyRecord).phone2);
      if (phone && normalizedPhones.includes(phone)) existing.set(`phone:${phone}`, row.id);
      if (phone2 && normalizedPhones.includes(phone2)) existing.set(`phone:${phone2}`, row.id);
    }
  }

  const duplicateId =
    (sourceRef ? existing.get(`ref:${sourceRef}`) : undefined) ||
    (listing.link ? existing.get(`url:${listing.link}`) : undefined) ||
    normalizedPhones.map((phone) => existing.get(`phone:${phone}`)).find(Boolean);

  if (duplicateId) {
    await supabase.from('portal_leads').insert({
      portal_name: 'statefox',
      contact_id: duplicateId,
      raw_email_subject: `Statefox duplicate ${listing.listingId || listing.link || ''}`.trim(),
      raw_email_from: 'statefox-webhook',
      extracted_data: payload,
      status: 'duplicado',
    } as never);

    return { ok: true, duplicate: true, contact_id: duplicateId, listing_id: listing.listingId || null };
  }

  const fullName =
    listing.advertiserName ||
    (listing.address ? `Propietario ${listing.address}` : '') ||
    `Propietario ${listing.cityName || listing.listingId || 'Statefox'}`;

  const tags = Array.from(new Set([
    'Statefox',
    'Captacion',
    listing.source || 'statefox',
    listing.operation === 'rent' ? 'Alquiler' : 'Venta',
    listing.advertiserType === 'professional' ? 'Profesional' : 'Particular',
  ]));

  const { data: contact, error } = await supabase.from('contacts').insert({
    full_name: fullName,
    phone: listing.phones[0] || null,
    phone2: listing.phones[1] || null,
    city: listing.cityName || null,
    contact_type: 'prospecto',
    status: 'nuevo',
    pipeline_stage: 'prospecto',
    notes: buildNotes(listing),
    tags,
    source_ref: sourceRef,
    source_url: listing.link || null,
  } as never).select('id, full_name').single();

  if (error || !contact) {
    return { ok: false, error: error?.message || 'contact_insert_failed', listing_id: listing.listingId || null };
  }

  await supabase.from('interactions').insert({
    contact_id: contact.id,
    interaction_type: 'nota',
    subject: 'Captación importada desde Statefox Push',
    description: `Lead push recibido desde ${listing.source || 'statefox'}. ${listing.link || listing.address || listing.listingId || ''}`.trim(),
  } as never);

  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + 24);
  const { data: assigneeRows } = await supabase.from('profiles').select('user_id').limit(1);
  const assigneeId = assigneeRows?.[0]?.user_id || null;

  if (assigneeId) {
    await supabase.from('tasks').insert({
      agent_id: assigneeId,
      contact_id: contact.id,
      title: `Primer contacto Statefox: ${fullName}`,
      description: buildTaskDescription(listing),
      due_date: dueDate.toISOString(),
      priority: 'alta',
      task_type: 'seguimiento',
      source: 'statefox',
      completed: false,
    } as never);
  }

  await supabase.from('portal_leads').insert({
    portal_name: 'statefox',
    contact_id: contact.id,
    raw_email_subject: `Statefox ${listing.listingId || listing.link || ''}`.trim(),
    raw_email_from: 'statefox-webhook',
    extracted_data: payload,
    status: 'nuevo',
  } as never);

  return { ok: true, created: true, contact_id: contact.id, listing_id: listing.listingId || null };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const payload = asRecord(body);
  if (!payload) return json({ ok: false, error: 'invalid_payload' }, 400);

  const expectedSecret = Deno.env.get('STATEFOX_WEBHOOK_SECRET') || '';
  const apiKey =
    req.headers.get('x-api-key') ||
    req.headers.get('x-webhook-secret') ||
    req.headers.get('apikey') ||
    '';
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

  if (!apiKey && !bearerToken && looksLikeStatefoxTestPayload(payload)) {
    return json({
      ok: true,
      test: true,
      received: true,
      message: 'Statefox test payload received without auth header; no contact created.',
    });
  }

  if (!expectedSecret || (apiKey !== expectedSecret && bearerToken !== expectedSecret)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const eventType = firstString(payload.event).toLowerCase();
  if (eventType === 'propdown' || eventType === 'propmatch') {
    return json({ ok: true, skipped: true, reason: eventType }, 200);
  }

  const listings = getPropertyEntries(payload).map(({ propertyIdHint, property }) => extractListing(property, propertyIdHint));
  const actionableListings = listings.filter((listing) => listing.listingId || listing.link || listing.phones.length > 0);

  if (actionableListings.length === 0) {
    if (looksLikeStatefoxTestPayload(payload)) {
      return json({
        ok: true,
        test: true,
        received: true,
        message: 'Statefox test payload received; no contact created.',
      });
    }
    return json({ ok: false, error: 'missing_identifiers' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const results = [];
  for (const listing of actionableListings) {
    const result = await processListing(supabase, listing, payload);
    if (!result.ok) {
      return json({ ok: false, error: result.error || 'statefox_processing_failed', listing_id: result.listing_id || null }, 500);
    }
    results.push(result);
  }

  return json({
    ok: true,
    event: eventType || null,
    received: actionableListings.length,
    created: results.filter((item) => item.created).length,
    duplicates: results.filter((item) => item.duplicate).length,
    results,
  });
});
