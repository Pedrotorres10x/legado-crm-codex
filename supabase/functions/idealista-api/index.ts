import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const DEFAULT_BASE_URL = "https://partners-sandbox.idealista.com";

function getBaseUrl(): string {
  return Deno.env.get("IDEALISTA_API_BASE_URL") || DEFAULT_BASE_URL;
}

function getFeedKey(): string {
  const key = Deno.env.get("IDEALISTA_FEED_KEY");
  if (!key) throw new Error("Missing IDEALISTA_FEED_KEY");
  return key;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(scope: string = "write"): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30000) {
    return cachedToken.token;
  }

  const clientId = Deno.env.get("IDEALISTA_API_CLIENT_ID");
  const clientSecret = Deno.env.get("IDEALISTA_API_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Missing IDEALISTA_API_CLIENT_ID or IDEALISTA_API_CLIENT_SECRET");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&scope=${scope}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 300) * 1000,
  };
  return data.access_token;
}

async function apiCall(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const token = await getAccessToken();
  const baseUrl = getBaseUrl();
  const feedKey = getFeedKey();
  const cleanBase = baseUrl.replace(/\/+$/, "");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    feedKey,
    "Content-Type": "application/json",
  };

  const fullUrl = `${cleanBase}${path}`;
  console.log(`[idealista-api] ${method} ${fullUrl}`);

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await res.text();
  console.log(`[idealista-api] ${method} ${path} → ${res.status}`, rawText.substring(0, 300));
  let data: unknown;
  try { data = JSON.parse(rawText); } catch { data = rawText; }
  return { status: res.status, data };
}

// ── Throttle helper ──────────────────────────────────────────────────
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Property type mapping ────────────────────────────────────────────
const TYPE_MAP: Record<string, string> = {
  piso: "flat", casa: "house", chalet: "house", adosado: "house",
  atico: "flat", duplex: "flat", estudio: "flat",
  local: "commercial", oficina: "office", garaje: "garage",
  terreno: "land", trastero: "storage", edificio: "building",
  habitacion: "room", finca: "countryhouse",
};

// House subtype mapping (required by Idealista for type=house)
const HOUSE_SUBTYPE_MAP: Record<string, string> = {
  chalet: "independent", casa: "independent", adosado: "terraced",
  finca: "independent",
};

const ENERGY_MAP: Record<string, string> = {
  A: "A", B: "B", C: "C", D: "D", E: "E", F: "F", G: "G",
  exento: "exempt", "en trámite": "pending",
};

// ── Validate mandatory fields before publishing ─────────────────────
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validatePropertyForIdealista(prop: any): ValidationResult {
  const errors: string[] = [];

  // Exclude obra nueva
  if (prop.is_new_construction || prop.property_subtype === 'obra_nueva') {
    errors.push("Obra nueva no está soportada por la API de Idealista");
  }

  // Exclude tipo 'otro'
  if (prop.property_type === 'otro') {
    errors.push("Tipo 'otro' no es válido para Idealista");
  }

  // Mandatory: price
  if (!prop.price || prop.price <= 0) {
    errors.push("Precio obligatorio y debe ser > 0");
  }

  // Mandatory: location (coords or address)
  if (!prop.latitude || !prop.longitude) {
    if (!prop.address || !prop.zip_code) {
      errors.push("Se requiere coordenadas GPS o dirección + código postal");
    }
  }

  // Mandatory: surface area
  if (!prop.surface_area && !prop.built_area) {
    errors.push("Superficie obligatoria (útil o construida)");
  }

  // Mandatory: property type must map
  if (!prop.property_type || !TYPE_MAP[prop.property_type]) {
    errors.push(`Tipo de inmueble no válido: ${prop.property_type || '(vacío)'}`);
  }

  // Mandatory: description
  if (!prop.description || prop.description.trim().length < 30) {
    errors.push("Descripción obligatoria (mínimo 30 caracteres)");
  }

  // Mandatory: at least 1 image
  if (!prop.images || !Array.isArray(prop.images) || prop.images.length === 0) {
    errors.push("Se requiere al menos 1 imagen");
  }

  // Energy certificate required for residential
  const residential = ['piso', 'casa', 'chalet', 'adosado', 'atico', 'duplex', 'estudio'];
  if (residential.includes(prop.property_type) && !prop.energy_cert) {
    errors.push("Certificado energético obligatorio para residencial");
  }

  return { valid: errors.length === 0, errors };
}

// ── Build idealista property payload from CRM property ───────────────
// Conservation mapping from CRM to Idealista enum
const CONSERVATION_MAP: Record<string, string> = {
  "nuevo": "newdevelopment",
  "buen estado": "good",
  "reformado": "renew",
  "a reformar": "torenew",
  "en construcción": "newdevelopment",
};

function buildPropertyPayload(prop: any, contactId: number) {
  const idealistaType = TYPE_MAP[prop.property_type] || "flat";
  const opType = prop.operation === "alquiler" ? "rent" : "sale";

  // Address: Idealista uses latitude/longitude/country/visibility/precision or streetName/postalCode/country/visibility
  const address: any = { country: "Spain", visibility: "hidden" };
  if (prop.latitude && prop.longitude) {
    address.latitude = prop.latitude;
    address.longitude = prop.longitude;
    address.precision = "exact";
  }
  if (prop.address) address.streetName = prop.address;
  if (prop.floor_number) address.floor = prop.floor_number;
  if (prop.door) address.door = prop.door;
  if (prop.staircase) address.staircase = prop.staircase;
  if (prop.zip_code) address.postalCode = prop.zip_code;
  if (prop.city) address.town = prop.city.toUpperCase();

  const features: any = {};
  if (prop.surface_area) features.areaUsable = prop.surface_area;
  if (prop.built_area) features.areaConstructed = prop.built_area;
  else if (prop.surface_area) features.areaConstructed = prop.surface_area;
  if (prop.bedrooms != null) features.rooms = prop.bedrooms;
  if (prop.bathrooms != null) features.bathroomNumber = prop.bathrooms;
  if (prop.year_built) features.builtYear = prop.year_built;
  if (prop.has_elevator != null) features.liftAvailable = prop.has_elevator;
  if (prop.has_pool != null) features.pool = prop.has_pool;
  if (prop.has_garage != null) features.parkingAvailable = prop.has_garage;
  if (prop.has_terrace != null) features.terrace = prop.has_terrace;
  if (prop.has_garden != null) features.garden = prop.has_garden;

  // Conservation is mandatory
  const conservation = CONSERVATION_MAP[prop.condition || ""] || "good";
  features.conservation = conservation;

  // House subtype is mandatory for type=house
  if (idealistaType === "house") {
    features.type = HOUSE_SUBTYPE_MAP[prop.property_type] || "independent";
  }

  const cert = prop.energy_cert ? ENERGY_MAP[prop.energy_cert] : undefined;
  if (cert && cert !== "exempt" && cert !== "pending") {
    features.energyCertificateRating = cert;
    if (prop.energy_consumption_value) features.energyCertificatePerformance = prop.energy_consumption_value;
    if (prop.energy_emissions_value) features.energyCertificateEmissionsValue = prop.energy_emissions_value;
  }

  const featureFlags = prop.features || [];
  if (featureFlags.includes("aire acondicionado")) features.conditionedAir = true;
  if (featureFlags.includes("armarios empotrados")) features.wardrobes = true;
  if (featureFlags.includes("trastero")) features.storage = true;

  const payload: any = {
    type: idealistaType, address, contactId, features,
    operation: { price: prop.price, type: opType },
  };

  if (prop.crm_reference) payload.reference = prop.crm_reference;
  if (prop.description) {
    payload.descriptions = [{ text: prop.description, language: "es" }];
  }
  if (prop.virtual_tour_url) {
    payload.additionalLink = prop.virtual_tour_url;
  }

  return payload;
}

// ── Paginate all items from Idealista ────────────────────────────────
async function paginateAll(basePath: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  const size = 100;
  while (true) {
    const r = await apiCall("GET", `${basePath}${basePath.includes("?") ? "&" : "?"}page=${page}&size=${size}`);
    const d = r.data as any;
    const items = d?.elements || d?.content || (Array.isArray(d) ? d : []);
    if (items.length === 0) break;
    all.push(...items);
    const totalPages = d?.totalPages || Math.ceil((d?.total || items.length) / size);
    if (page >= totalPages) break;
    page++;
    await delay(500); // Throttle between pages
  }
  return all;
}

// ── sync_existing: findall + cross-reference ─────────────────────────
async function syncExisting() {
  const sb = getSupabaseAdmin();

  const [idealistaProps, idealistaContacts] = await Promise.all([
    paginateAll("/v1/properties"),
    paginateAll("/v1/contacts"),
  ]);

  const { data: crmProps } = await sb
    .from("properties")
    .select("id, crm_reference, title, owner_id")
    .eq("status", "disponible")
    .not("crm_reference", "is", null);

  const { data: existingMappings } = await sb.from("idealista_mappings").select("property_id, idealista_property_code");
  const mappedPropertyIds = new Set((existingMappings || []).map((m: any) => m.property_id));
  const mappedCodes = new Set((existingMappings || []).map((m: any) => m.idealista_property_code).filter(Boolean));

  let propsMatched = 0;
  let propsUnmatched = 0;
  const newPropertyMappings: any[] = [];

  for (const iProp of idealistaProps) {
    const ref = iProp.reference || iProp.customerReference;
    if (!ref) { propsUnmatched++; continue; }

    const crmProp = (crmProps || []).find((p: any) => p.crm_reference === ref);
    if (!crmProp) { propsUnmatched++; continue; }
    if (mappedPropertyIds.has(crmProp.id)) { propsMatched++; continue; }

    const propertyCode = iProp.propertyCode || iProp.id?.toString();
    if (mappedCodes.has(propertyCode)) { propsMatched++; continue; }

    newPropertyMappings.push({
      property_id: crmProp.id,
      idealista_property_code: propertyCode,
      idealista_ad_id: iProp.adId?.toString() || null,
      status: "synced",
      last_synced_at: new Date().toISOString(),
      idealista_response: iProp,
    });
    propsMatched++;
  }

  if (newPropertyMappings.length > 0) {
    await sb.from("idealista_mappings").upsert(newPropertyMappings, { onConflict: "property_id" });
  }

  // Cross-reference contacts
  const { data: profiles } = await sb.from("profiles").select("user_id, full_name, email:user_id");
  const { data: existingContactMappings } = await sb.from("idealista_contact_mappings").select("profile_id");
  const mappedProfiles = new Set((existingContactMappings || []).map((m: any) => m.profile_id));

  let contactsMatched = 0;
  const newContactMappings: any[] = [];

  for (const iContact of idealistaContacts) {
    const contactName = iContact.name || iContact.contactName || "";
    const contactEmail = iContact.email || "";
    const contactId = iContact.contactId || iContact.id;
    if (!contactId) continue;

    const profile = (profiles || []).find((p: any) =>
      (contactEmail && p.email === contactEmail) ||
      (contactName && p.full_name && p.full_name.toLowerCase() === contactName.toLowerCase())
    );

    if (profile && !mappedProfiles.has(profile.user_id)) {
      newContactMappings.push({
        profile_id: profile.user_id,
        idealista_contact_id: Number(contactId),
        idealista_contact_name: contactName,
      });
      mappedProfiles.add(profile.user_id);
      contactsMatched++;
    }
  }

  if (newContactMappings.length > 0) {
    await sb.from("idealista_contact_mappings").upsert(newContactMappings, { onConflict: "profile_id" });
  }

  return {
    ok: true,
    idealista_properties: idealistaProps.length,
    idealista_contacts: idealistaContacts.length,
    properties_matched: propsMatched,
    properties_new_mappings: newPropertyMappings.length,
    properties_unmatched: propsUnmatched,
    contacts_matched: contactsMatched,
    contacts_new_mappings: newContactMappings.length,
  };
}

// ── publish_from_crm: publish a CRM property to Idealista ────────────
async function publishFromCrm(propertyId: string) {
  const sb = getSupabaseAdmin();

  // Check if already mapped
  const { data: existing } = await sb
    .from("idealista_mappings")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existing?.idealista_property_code) {
    return updateFromCrm(propertyId);
  }

  // Fetch CRM property
  const { data: prop, error: propErr } = await sb
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (propErr || !prop) throw new Error("Property not found: " + propertyId);

  // Validate before publishing
  const validation = validatePropertyForIdealista(prop);
  if (!validation.valid) {
    await sb.from("idealista_mappings").upsert({
      property_id: propertyId,
      status: "error",
      last_error: "Validación: " + validation.errors.join("; "),
      updated_at: new Date().toISOString(),
    }, { onConflict: "property_id" });
    throw new Error("Validación fallida: " + validation.errors.join("; "));
  }

  // Get or create Idealista contact for the owner
  const contactId = await resolveIdealistaContact(sb, prop);

  // Build and create property
  const payload = buildPropertyPayload(prop, contactId);
  const r = await apiCall("POST", "/v1/properties", payload);

  if (r.status >= 400) {
    await sb.from("idealista_mappings").upsert({
      property_id: propertyId,
      status: "error",
      last_error: JSON.stringify(r.data),
      updated_at: new Date().toISOString(),
    }, { onConflict: "property_id" });
    throw new Error(`Idealista create failed [${r.status}]: ${JSON.stringify(r.data)}`);
  }

  const result = r.data as any;
  const propertyCode = result.propertyCode || result.id?.toString();

  await sb.from("idealista_mappings").upsert({
    property_id: propertyId,
    idealista_property_code: propertyCode,
    idealista_ad_id: result.adId?.toString() || null,
    status: "synced",
    last_synced_at: new Date().toISOString(),
    last_error: null,
    idealista_response: result,
  }, { onConflict: "property_id" });

  // Sync images
  await syncPropertyImages(sb, propertyId, propertyCode, prop);

  return { ok: true, action: "created", propertyCode, result };
}

// ── update_from_crm: update an existing Idealista property ───────────
async function updateFromCrm(propertyId: string) {
  const sb = getSupabaseAdmin();

  const { data: mapping } = await sb
    .from("idealista_mappings")
    .select("*")
    .eq("property_id", propertyId)
    .single();

  if (!mapping?.idealista_property_code) {
    return publishFromCrm(propertyId);
  }

  const { data: prop } = await sb
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (!prop) throw new Error("Property not found");

  // Validate before updating
  const validation = validatePropertyForIdealista(prop);
  if (!validation.valid) {
    await sb.from("idealista_mappings").update({
      status: "error",
      last_error: "Validación: " + validation.errors.join("; "),
      updated_at: new Date().toISOString(),
    }).eq("property_id", propertyId);
    throw new Error("Validación fallida: " + validation.errors.join("; "));
  }

  const contactId = await resolveIdealistaContact(sb, prop);
  const payload = buildPropertyPayload(prop, contactId);
  const r = await apiCall("PUT", `/v1/properties/${mapping.idealista_property_code}`, payload);

  if (r.status >= 400) {
    await sb.from("idealista_mappings").update({
      status: "error",
      last_error: JSON.stringify(r.data),
      updated_at: new Date().toISOString(),
    }).eq("property_id", propertyId);
    throw new Error(`Idealista update failed [${r.status}]: ${JSON.stringify(r.data)}`);
  }

  await sb.from("idealista_mappings").update({
    status: "synced",
    last_synced_at: new Date().toISOString(),
    last_error: null,
    idealista_response: r.data as any,
    updated_at: new Date().toISOString(),
  }).eq("property_id", propertyId);

  await syncPropertyImages(sb, propertyId, mapping.idealista_property_code, prop);

  return { ok: true, action: "updated", propertyCode: mapping.idealista_property_code };
}

// ── Resolve or create Idealista contact for property owner ───────────
async function resolveIdealistaContact(sb: any, prop: any): Promise<number> {
  if (prop.owner_id) {
    const { data: contactMapping } = await sb
      .from("idealista_contact_mappings")
      .select("idealista_contact_id")
      .eq("profile_id", prop.owner_id)
      .maybeSingle();

    if (contactMapping?.idealista_contact_id) {
      return contactMapping.idealista_contact_id;
    }
  }

  const { data: ownerContact } = prop.owner_id
    ? await sb.from("contacts").select("full_name, phone, email").eq("id", prop.owner_id).maybeSingle()
    : { data: null };

  const contactPayload: any = {
    name: ownerContact?.full_name || "Propietario CRM",
  };
  if (ownerContact?.phone) {
    // Clean phone: remove prefix if present
    const cleanPhone = ownerContact.phone.replace(/^\+34\s*/, '').replace(/\s/g, '');
    contactPayload.primaryPhonePrefix = "34";
    contactPayload.primaryPhoneNumber = cleanPhone;
  }
  if (ownerContact?.email) contactPayload.email = ownerContact.email;

  const r = await apiCall("POST", "/v1/contacts", contactPayload);
  if (r.status >= 400) {
    const listR = await apiCall("GET", "/v1/contacts?page=1&size=1");
    const contacts = ((listR.data as any)?.elements || []);
    if (contacts.length > 0) return contacts[0].contactId || contacts[0].id;
    throw new Error("Cannot create or find Idealista contact");
  }

  const created = r.data as any;
  const idealistaContactId = created.contactId || created.id;

  if (prop.owner_id && idealistaContactId) {
    await sb.from("idealista_contact_mappings").upsert({
      profile_id: prop.owner_id,
      idealista_contact_id: Number(idealistaContactId),
      idealista_contact_name: contactPayload.name,
    }, { onConflict: "profile_id" }).then(() => {});
  }

  return Number(idealistaContactId);
}

// ── Sync images with checksum tracking ───────────────────────────────
async function syncPropertyImages(sb: any, propertyId: string, propertyCode: string, prop: any) {
  if (!prop.images || !Array.isArray(prop.images) || prop.images.length === 0) return;

  const { data: mapping } = await sb
    .from("idealista_mappings")
    .select("image_checksums")
    .eq("property_id", propertyId)
    .single();

  const oldChecksums = (mapping?.image_checksums as Record<string, string>) || {};
  const newChecksums: Record<string, string> = {};

  const images = prop.images.map((url: string, i: number) => {
    newChecksums[`img_${i}`] = url;
    return { url, order: i + 1 };
  });

  const changed = JSON.stringify(oldChecksums) !== JSON.stringify(newChecksums);
  if (!changed) return;

  await apiCall("PUT", `/v1/properties/${propertyCode}/images`, { images });

  await sb.from("idealista_mappings").update({
    image_checksums: newChecksums,
    updated_at: new Date().toISOString(),
  }).eq("property_id", propertyId);
}

// ── Delete ad from Idealista (full removal) ─────────────────────────
async function deleteFromIdealista(propertyId: string) {
  const sb = getSupabaseAdmin();
  const { data: mapping } = await sb
    .from("idealista_mappings")
    .select("idealista_property_code")
    .eq("property_id", propertyId)
    .single();

  if (!mapping?.idealista_property_code) throw new Error("No mapping found for property");

  // First delete all images
  const imgR = await apiCall("GET", `/v1/properties/${mapping.idealista_property_code}/images`);
  const existingImages = (imgR.data as any)?.elements || (imgR.data as any)?.images || [];
  for (const img of existingImages) {
    const imgId = img.imageId || img.id;
    if (imgId) {
      await apiCall("DELETE", `/v1/properties/${mapping.idealista_property_code}/images/${imgId}`);
      await delay(300);
    }
  }

  // Deactivate the property
  const r = await apiCall("POST", `/v1/properties/${mapping.idealista_property_code}/deactivate`);

  // Remove mapping from DB
  await sb.from("idealista_mappings").delete().eq("property_id", propertyId);

  return { ok: true, action: "deleted", propertyCode: mapping.idealista_property_code, result: r.data };
}

// ── Deactivate property on Idealista (keep mapping) ─────────────────
async function deactivateFromCrm(propertyId: string) {
  const sb = getSupabaseAdmin();
  const { data: mapping } = await sb
    .from("idealista_mappings")
    .select("idealista_property_code")
    .eq("property_id", propertyId)
    .single();

  if (!mapping?.idealista_property_code) throw new Error("No mapping found");

  const r = await apiCall("POST", `/v1/properties/${mapping.idealista_property_code}/deactivate`);

  await sb.from("idealista_mappings").update({
    status: "deactivated",
    updated_at: new Date().toISOString(),
  }).eq("property_id", propertyId);

  return { ok: true, action: "deactivated", result: r.data };
}

// ── Reactivate property on Idealista ────────────────────────────────
async function reactivateFromCrm(propertyId: string) {
  const sb = getSupabaseAdmin();
  const { data: mapping } = await sb
    .from("idealista_mappings")
    .select("idealista_property_code")
    .eq("property_id", propertyId)
    .single();

  if (!mapping?.idealista_property_code) throw new Error("No mapping found");

  const r = await apiCall("POST", `/v1/properties/${mapping.idealista_property_code}/reactivate`);

  if (r.status >= 400) {
    throw new Error(`Reactivate failed [${r.status}]: ${JSON.stringify(r.data)}`);
  }

  await sb.from("idealista_mappings").update({
    status: "synced",
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("property_id", propertyId);

  return { ok: true, action: "reactivated", result: r.data };
}

// ── Manage individual image ─────────────────────────────────────────
async function addImage(propertyCode: string, imageUrl: string, order: number) {
  const r = await apiCall("POST", `/v1/properties/${propertyCode}/images`, {
    images: [{ url: imageUrl, order }],
  });
  return { ok: r.status < 400, result: r.data };
}

async function deleteImage(propertyCode: string, imageId: string) {
  const r = await apiCall("DELETE", `/v1/properties/${propertyCode}/images/${imageId}`);
  return { ok: r.status < 400, result: r.data };
}

// ── Validate a property without publishing ──────────────────────────
async function validateProperty(propertyId: string) {
  const sb = getSupabaseAdmin();
  const { data: prop } = await sb
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (!prop) throw new Error("Property not found");

  const validation = validatePropertyForIdealista(prop);
  return { ok: true, property_id: propertyId, ...validation };
}

// ── Validate all pending properties ─────────────────────────────────
async function validateAllPending() {
  const sb = getSupabaseAdmin();
  const { data: props } = await sb
    .from("properties")
    .select("id, title, crm_reference, property_type, price, surface_area, built_area, latitude, longitude, address, zip_code, description, images, energy_cert, is_new_construction, features")
    .eq("send_to_idealista", true)
    .eq("status", "disponible");

  const results = {
    total: (props || []).length,
    valid: 0,
    invalid: 0,
    details: [] as any[],
  };

  for (const prop of (props || [])) {
    const v = validatePropertyForIdealista(prop);
    if (v.valid) results.valid++;
    else {
      results.invalid++;
      results.details.push({
        id: prop.id,
        ref: prop.crm_reference,
        title: prop.title,
        errors: v.errors,
      });
    }
  }

  return { ok: true, ...results };
}

// ── Update contact in Idealista from CRM ────────────────────────────
async function syncContactFromCrm(profileId: string) {
  const sb = getSupabaseAdmin();

  const { data: mapping } = await sb
    .from("idealista_contact_mappings")
    .select("idealista_contact_id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!mapping?.idealista_contact_id) {
    throw new Error("No Idealista contact mapping found for this profile");
  }

  // Get contact info from CRM
  const { data: contact } = await sb
    .from("contacts")
    .select("full_name, phone, email")
    .eq("id", profileId)
    .maybeSingle();

  if (!contact) throw new Error("Contact not found in CRM");

  const payload: any = { name: contact.full_name };
  if (contact.phone) payload.phone1 = contact.phone;
  if (contact.email) payload.email = contact.email;

  const r = await apiCall("PUT", `/v1/contacts/${mapping.idealista_contact_id}`, payload);

  if (r.status >= 400) {
    throw new Error(`Update contact failed [${r.status}]: ${JSON.stringify(r.data)}`);
  }

  return { ok: true, action: "contact_updated", contactId: mapping.idealista_contact_id, result: r.data };
}

// ── Main handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    // ── Auth test ─────────────────────────────────────────────────────
    if (action === "test_auth") {
      const token = await getAccessToken("read");
      return json({ ok: true, message: "Auth OK", token_length: token.length });
    }

    // ── Sync existing (findall) ──────────────────────────────────────
    if (action === "sync_existing") {
      const result = await syncExisting();
      return json(result);
    }

    // ── Publish from CRM ─────────────────────────────────────────────
    if (action === "publish_from_crm") {
      const result = await publishFromCrm(params.property_id);
      return json(result);
    }

    // ── Update from CRM ──────────────────────────────────────────────
    if (action === "update_from_crm") {
      const result = await updateFromCrm(params.property_id);
      return json(result);
    }

    // ── Deactivate from CRM ──────────────────────────────────────────
    if (action === "deactivate_from_crm") {
      const result = await deactivateFromCrm(params.property_id);
      return json(result);
    }

    // ── Reactivate from CRM ──────────────────────────────────────────
    if (action === "reactivate_from_crm") {
      const result = await reactivateFromCrm(params.property_id);
      return json(result);
    }

    // ── Delete from Idealista (full removal) ─────────────────────────
    if (action === "delete_from_idealista") {
      const result = await deleteFromIdealista(params.property_id);
      return json(result);
    }

    // ── Validate single property ─────────────────────────────────────
    if (action === "validate_property") {
      const result = await validateProperty(params.property_id);
      return json(result);
    }

    // ── Validate all pending ─────────────────────────────────────────
    if (action === "validate_pending") {
      const result = await validateAllPending();
      return json(result);
    }

    // ── Sync contact from CRM ────────────────────────────────────────
    if (action === "sync_contact") {
      const result = await syncContactFromCrm(params.profile_id);
      return json(result);
    }

    // ── Publish all pending (with throttling) ────────────────────────
    if (action === "publish_pending") {
      const sb = getSupabaseAdmin();
      const { data: props } = await sb
        .from("properties")
        .select("id, property_type, is_new_construction")
        .eq("send_to_idealista", true)
        .eq("status", "disponible");

      const { data: mappings } = await sb
        .from("idealista_mappings")
        .select("property_id")
        .in("status", ["synced", "error"]);

      const mappedIds = new Set((mappings || []).map((m: any) => m.property_id));

      // Filter: exclude already mapped, obra nueva, and tipo 'otro'
      const pending = (props || []).filter((p: any) =>
        !mappedIds.has(p.id) &&
        p.property_type !== 'otro' &&
        !p.is_new_construction
      );

      const results = { total: pending.length, ok: 0, errors: 0, skipped: 0, details: [] as any[] };

      for (const p of pending) {
        try {
          const r = await publishFromCrm(p.id);
          results.ok++;
          results.details.push({ id: p.id, ...r });
        } catch (err: any) {
          results.errors++;
          results.details.push({ id: p.id, error: err.message });
        }
        // Throttle: 1.5s between each publish to avoid being treated as batch
        if (pending.indexOf(p) < pending.length - 1) {
          await delay(1500);
        }
      }

      return json({ ok: true, ...results });
    }

    // ── Mapping stats ────────────────────────────────────────────────
    if (action === "mapping_stats") {
      const sb = getSupabaseAdmin();
      const [
        { count: totalSendToIdealista },
        { count: totalMapped },
        { count: totalSynced },
        { count: totalError },
        { count: totalDeactivated },
        { count: totalContactMappings },
      ] = await Promise.all([
        sb.from("properties").select("*", { count: "exact", head: true }).eq("send_to_idealista", true).eq("status", "disponible"),
        sb.from("idealista_mappings").select("*", { count: "exact", head: true }),
        sb.from("idealista_mappings").select("*", { count: "exact", head: true }).eq("status", "synced"),
        sb.from("idealista_mappings").select("*", { count: "exact", head: true }).eq("status", "error"),
        sb.from("idealista_mappings").select("*", { count: "exact", head: true }).eq("status", "deactivated"),
        sb.from("idealista_contact_mappings").select("*", { count: "exact", head: true }),
      ]);

      return json({
        ok: true,
        total_send_to_idealista: totalSendToIdealista || 0,
        total_mapped: totalMapped || 0,
        total_synced: totalSynced || 0,
        total_error: totalError || 0,
        total_deactivated: totalDeactivated || 0,
        total_contact_mappings: totalContactMappings || 0,
        pending: (totalSendToIdealista || 0) - (totalSynced || 0),
      });
    }

    // ── Manage individual images ─────────────────────────────────────
    if (action === "add_image") {
      const result = await addImage(params.propertyCode, params.imageUrl, params.order || 1);
      return json(result);
    }
    if (action === "delete_image") {
      const result = await deleteImage(params.propertyCode, params.imageId);
      return json(result);
    }

    // ── Direct API calls (existing) ──────────────────────────────────
    if (action === "list_contacts") {
      const r = await apiCall("GET", `/v1/contacts?page=${params.page || 1}&size=${params.size || 100}`);
      return json(r);
    }
    if (action === "create_contact") {
      const r = await apiCall("POST", "/v1/contacts", params.contact);
      return json(r);
    }
    if (action === "update_contact") {
      const r = await apiCall("PUT", `/v1/contacts/${params.contactId}`, params.contact);
      return json(r);
    }
    if (action === "get_contact") {
      const r = await apiCall("GET", `/v1/contacts/${params.contactId}`);
      return json(r);
    }
    if (action === "delete_contact") {
      const r = await apiCall("DELETE", `/v1/contacts/${params.contactId}`);
      return json(r);
    }
    if (action === "list_properties") {
      const state = params.state ? `&state=${params.state}` : "";
      const r = await apiCall("GET", `/v1/properties?page=${params.page || 1}&size=${params.size || 100}${state}`);
      return json(r);
    }
    if (action === "get_property") {
      const r = await apiCall("GET", `/v1/properties/${params.propertyId}`);
      return json(r);
    }
    if (action === "create_property") {
      const payload = params.payload || buildPropertyPayload(params.property, params.contactId);
      const r = await apiCall("POST", "/v1/properties", payload);
      return json(r);
    }
    if (action === "update_property") {
      const payload = params.payload || buildPropertyPayload(params.property, params.contactId);
      const r = await apiCall("PUT", `/v1/properties/${params.propertyId}`, payload);
      return json(r);
    }
    if (action === "deactivate_property") {
      const r = await apiCall("POST", `/v1/properties/${params.propertyId}/deactivate`);
      return json(r);
    }
    if (action === "reactivate_property") {
      const r = await apiCall("POST", `/v1/properties/${params.propertyId}/reactivate`);
      return json(r);
    }
    if (action === "list_images") {
      const r = await apiCall("GET", `/v1/properties/${params.propertyId}/images`);
      return json(r);
    }
    if (action === "sync_images") {
      const r = await apiCall("PUT", `/v1/properties/${params.propertyId}/images`, { images: params.images });
      return json(r);
    }
    if (action === "publish_info") {
      const r = await apiCall("GET", "/v1/customer/publishinfo");
      return json(r);
    }
    if (action === "raw") {
      const r = await apiCall(params.method || "GET", params.path, params.body);
      return json(r);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("idealista-api error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
