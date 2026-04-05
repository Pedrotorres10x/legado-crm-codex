import { supabase } from '@/integrations/supabase/client';

type ContactDocData = {
  document_type?: string;
  full_name?: string;
  id_number?: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
  nationality?: string;
  birth_date?: string;
};

type PropertyDocData = {
  document_type?: string;
  property_address?: string;
  property_city?: string;
  property_province?: string;
  property_zip_code?: string;
  property_type?: string;
  cadastral_reference?: string;
  surface_area?: number;
  built_area?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: string;
  energy_cert?: string;
  property_description?: string;
  summary?: string;
  titulares?: Array<{ name?: string; id_number?: string; percentage?: string }>;
};

const normalizeId = (value?: string | null) =>
  (value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const normalizeName = (value?: string | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const tokenizeName = (value?: string | null) =>
  normalizeName(value)
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 2);

const escapeLike = (value: string) => value.replace(/[%_,]/g, ' ').trim();

const scoreContactMatch = (
  contact: { full_name?: string | null; id_number?: string | null },
  fullName: string,
  idNumber?: string,
) => {
  const normalizedTargetName = normalizeName(fullName);
  const normalizedContactName = normalizeName(contact.full_name);
  const normalizedTargetId = normalizeId(idNumber);
  const normalizedContactId = normalizeId(contact.id_number);
  const targetTokens = tokenizeName(fullName);
  const contactTokens = tokenizeName(contact.full_name);
  const overlappingTokens = targetTokens.filter(token => contactTokens.includes(token));
  const targetSurnames = targetTokens.slice(-2);
  const matchedSurnames = targetSurnames.filter(token => contactTokens.includes(token));

  let score = 0;
  let reason = 'Coincidencia parcial';

  if (normalizedTargetId && normalizedContactId) {
    if (normalizedTargetId === normalizedContactId) {
      return { score: 1000, reason: 'DNI/NIF exacto' };
    }

    if (
      normalizedTargetId.length >= 4 &&
      normalizedContactId.length >= 4 &&
      (normalizedContactId.includes(normalizedTargetId.slice(-4)) ||
        normalizedTargetId.includes(normalizedContactId.slice(-4)))
    ) {
      score += 240;
      reason = 'DNI/NIF parcial';
    }
  }

  if (!normalizedContactName || !normalizedTargetName) {
    return { score, reason };
  }

  if (normalizedContactName === normalizedTargetName) {
    return { score: score + 600, reason: normalizedTargetId ? reason : 'Nombre exacto' };
  }

  if (
    normalizedContactName.startsWith(normalizedTargetName) ||
    normalizedTargetName.startsWith(normalizedContactName)
  ) {
    score += 220;
    reason = 'Nombre casi exacto';
  }

  if (matchedSurnames.length === targetSurnames.length && targetSurnames.length > 0) {
    score += 180;
    reason = 'Apellidos coinciden';
  } else if (matchedSurnames.length > 0) {
    score += 90;
    reason = 'Apellido coincidente';
  }

  if (overlappingTokens.length > 0) {
    score += overlappingTokens.length * 45;
  }

  if (targetTokens.length > 0) {
    const coverage = overlappingTokens.length / targetTokens.length;
    score += Math.round(coverage * 100);
  }

  return { score, reason };
};

const buildPropertyTitle = (data: PropertyDocData) => {
  const type = data.property_type ? `${data.property_type.charAt(0).toUpperCase()}${data.property_type.slice(1)}` : 'Inmueble';
  if (data.property_city) return `${type} en ${data.property_city}`;
  if (data.property_address) return `${type} ${data.property_address}`;
  return type;
};

export const ensureContactFromDocument = async (data: ContactDocData, agentId?: string) => {
  const normalizedId = normalizeId(data.id_number);
  if (!data.full_name?.trim() && !normalizedId) {
    throw new Error('El documento no tiene suficiente informacion para dar de alta el contacto');
  }

  if (normalizedId) {
    const { data: existingById } = await supabase
      .from('contacts')
      .select('id, full_name')
      .eq('id_number', normalizedId)
      .maybeSingle();

    if (existingById) {
      return { contactId: existingById.id, created: false, matchedBy: 'id_number' as const };
    }
  }

  if (data.email?.trim()) {
    const { data: existingByEmail } = await supabase
      .from('contacts')
      .select('id, full_name')
      .eq('email', data.email.trim().toLowerCase())
      .maybeSingle();

    if (existingByEmail) {
      return { contactId: existingByEmail.id, created: false, matchedBy: 'email' as const };
    }
  }

  const { data: inserted, error } = await supabase
    .from('contacts')
    .insert({
      full_name: data.full_name?.trim() || normalizedId,
      id_number: normalizedId || null,
      email: data.email?.trim().toLowerCase() || null,
      phone: data.phone?.trim() || null,
      city: data.city?.trim() || null,
      address: data.address?.trim() || null,
      nationality: data.nationality?.trim() || null,
      birth_date: data.birth_date || null,
      contact_type: 'contacto',
      pipeline_stage: 'nuevo',
      agent_id: agentId || null,
      notes: `[Alta automatica por documento] ${data.document_type || 'documento'}`,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    throw error || new Error('No se pudo crear el contacto');
  }

  return { contactId: inserted.id, created: true, matchedBy: 'created' as const };
};

export const ensurePropertyFromDocument = async (data: PropertyDocData, agentId?: string) => {
  const normalizedReference = normalizeId(data.cadastral_reference);
  if (!data.property_address?.trim() && !normalizedReference) {
    throw new Error('La nota simple no tiene suficiente informacion para dar de alta el inmueble');
  }

  if (normalizedReference) {
    const { data: existingByReference } = await supabase
      .from('properties')
      .select('id, title')
      .eq('reference', normalizedReference)
      .maybeSingle();

    if (existingByReference) {
      const ownerReconciliation = await reconcilePropertyOwnersFromDocument({
        propertyId: existingByReference.id,
        titulares: data.titulares,
      });
      return { propertyId: existingByReference.id, created: false, matchedBy: 'reference' as const, ownerReconciliation };
    }
  }

  const { data: inserted, error } = await supabase
    .from('properties')
    .insert({
      title: buildPropertyTitle(data),
      property_type: data.property_type || 'otro',
      operation: 'venta',
      status: 'disponible',
      address: data.property_address?.trim() || null,
      city: data.property_city?.trim() || null,
      province: data.property_province?.trim() || null,
      zip_code: data.property_zip_code?.trim() || null,
      reference: normalizedReference || null,
      surface_area: data.surface_area || null,
      built_area: data.built_area || null,
      bedrooms: data.bedrooms || 0,
      bathrooms: data.bathrooms || 0,
      floor_number: data.floor?.trim() || null,
      energy_cert: data.energy_cert?.trim() || null,
      description: data.property_description?.trim() || data.summary?.trim() || null,
      agent_id: agentId || null,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    throw error || new Error('No se pudo crear el inmueble');
  }

  const ownerReconciliation = await reconcilePropertyOwnersFromDocument({
    propertyId: inserted.id,
    titulares: data.titulares,
  });

  return { propertyId: inserted.id, created: true, matchedBy: 'created' as const, ownerReconciliation };
};

export const reconcilePropertyOwnersFromDocument = async ({
  propertyId,
  titulares,
}: {
  propertyId: string;
  titulares?: Array<{ name?: string; id_number?: string; percentage?: string }>;
}) => {
  const matched: Array<{ contactId: string; label: string }> = [];
  const missing: string[] = [];

  for (const holder of titulares || []) {
    const normalizedId = normalizeId(holder.id_number);
    const normalizedHolderName = normalizeName(holder.name);
    let contact: { id: string; full_name: string } | null = null;

    if (normalizedId) {
      const { data } = await supabase
        .from('contacts')
        .select('id, full_name')
        .eq('id_number', normalizedId)
        .maybeSingle();
      contact = data;
    }

    if (!contact && normalizedHolderName) {
      const { data } = await supabase
        .from('contacts')
        .select('id, full_name')
        .ilike('full_name', `%${holder.name}%`)
        .limit(10);

      contact = (data || []).find((candidate) => normalizeName(candidate.full_name) === normalizedHolderName) || null;
    }

    if (!contact) {
      missing.push(holder.name || holder.id_number || 'Titular sin identificar');
      continue;
    }

    await supabase
      .from('property_owners')
      .upsert({
        property_id: propertyId,
        contact_id: contact.id,
        role: 'propietario',
        ownership_pct: holder.percentage ? Number(holder.percentage.replace(',', '.').replace('%', '').trim()) || null : null,
        notes: '[Detectado automaticamente desde nota simple/escritura]',
      }, { onConflict: 'property_id,contact_id' });

    matched.push({ contactId: contact.id, label: contact.full_name });
  }

  return { matched, missing };
};

export const createContactStubForPropertyHolder = async ({
  fullName,
  propertyId,
  agentId,
}: {
  fullName: string;
  propertyId: string;
  agentId?: string;
}) => {
  const trimmedName = fullName.trim();
  if (!trimmedName) throw new Error('Nombre de titular no valido');

  const { data: existingContacts } = await supabase
    .from('contacts')
    .select('id, full_name')
    .ilike('full_name', trimmedName)
    .limit(10);

  const exact = (existingContacts || []).find((contact) => normalizeName(contact.full_name) === normalizeName(trimmedName));

  let contactId = exact?.id;

  if (!contactId) {
    const { data: inserted, error } = await supabase
      .from('contacts')
      .insert({
        full_name: trimmedName,
        contact_type: 'propietario',
        pipeline_stage: 'captado',
        agent_id: agentId || null,
        notes: `[Alta automatica desde titular detectado en documento] ${propertyId}`,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      throw error || new Error('No se pudo crear el contacto del titular');
    }

    contactId = inserted.id;
  }

  const { error: ownerError } = await supabase
    .from('property_owners')
    .upsert({
      property_id: propertyId,
      contact_id: contactId,
      role: 'propietario',
      notes: '[Vinculado desde checklist inteligente]',
    }, { onConflict: 'property_id,contact_id' });

  if (ownerError) throw ownerError;

  return { contactId, created: !exact };
};

export const findExistingContactsForHolder = async (fullName: string, idNumber?: string) => {
  const trimmedName = fullName.trim();
  if (!trimmedName) return [];

  const normalizedId = normalizeId(idNumber);
  const searchTokens = Array.from(new Set(tokenizeName(trimmedName)))
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);

  const orClauses = [
    `full_name.ilike.%${escapeLike(trimmedName)}%`,
    ...searchTokens.map(token => `full_name.ilike.%${escapeLike(token)}%`),
    ...(normalizedId ? [`id_number.ilike.%${normalizedId}%`] : []),
  ];

  const { data } = await supabase
    .from('contacts')
    .select('id, full_name, email, phone, id_number, contact_type')
    .or(orClauses.join(','))
    .limit(20);

  return (data || [])
    .map((contact) => {
      const match = scoreContactMatch(contact, trimmedName, normalizedId);
      return {
        ...contact,
        match_score: match.score,
        match_reason: match.reason,
      };
    })
    .filter((contact) => contact.match_score > 0)
    .sort((a, b) => {
      if (b.match_score !== a.match_score) return b.match_score - a.match_score;
      return (a.full_name || '').localeCompare(b.full_name || '', 'es');
    })
    .slice(0, 8);
};

export const linkExistingContactAsPropertyOwner = async ({
  contactId,
  propertyId,
}: {
  contactId: string;
  propertyId: string;
}) => {
  const { error } = await supabase
    .from('property_owners')
    .upsert({
      property_id: propertyId,
      contact_id: contactId,
      role: 'propietario',
      notes: '[Vinculado desde checklist inteligente]',
    }, { onConflict: 'property_id,contact_id' });

  if (error) throw error;
};
