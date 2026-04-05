import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type CsvContactRow = {
  id?: string
  full_name?: string
  phone?: string
  phone2?: string
  email?: string
  contact_type?: string
  pipeline_stage?: string
  status?: string
  city?: string
  address?: string
  notes?: string
  tags?: string | string[]
  agent_id?: string
  birth_date?: string
  nationality?: string
  id_number?: string
  source_ref?: string
  created_at?: string
  updated_at?: string
}

type NormalizedTaxonomy = {
  contact_type: string
  status: string
  tags: string[] | null
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  })
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseTags(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const parsed = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
    return parsed.length > 0 ? Array.from(new Set(parsed)) : null
  }

  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const inner = trimmed.startsWith('{') && trimmed.endsWith('}')
    ? trimmed.slice(1, -1)
    : trimmed

  const parts: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i]
    if (char === '"') {
      if (inQuotes && inner[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      const token = current.trim()
      if (token) parts.push(token)
      current = ''
      continue
    }
    current += char
  }
  const last = current.trim()
  if (last) parts.push(last)

  const normalized = parts
    .map((item) => item.trim())
    .filter(Boolean)

  return normalized.length > 0 ? Array.from(new Set(normalized)) : null
}

function uniqueTags(tags: string[] | null | undefined, additions: string[] = []) {
  const normalized = [...(tags ?? []), ...additions]
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter(Boolean)

  return normalized.length > 0 ? Array.from(new Set(normalized)) : null
}

function normalizeContactTaxonomy(input: {
  contactType: string | null
  status: string | null
  tags: string[] | null
  notes: string | null
}): NormalizedTaxonomy {
  const contactType = input.contactType ?? 'contacto'
  const status = input.status ?? 'nuevo'
  const notes = (input.notes ?? '').toLowerCase()

  switch (contactType) {
    case 'comprador_cerrado':
      return {
        contact_type: 'comprador',
        status: 'cerrado',
        tags: uniqueTags(input.tags, ['comprador-cerrado']),
      }
    case 'vendedor_cerrado':
      return {
        contact_type: 'propietario',
        status: 'cerrado',
        tags: uniqueTags(input.tags, ['vendedor-cerrado', 'captacion']),
      }
    case 'statefox':
      return {
        contact_type: 'prospecto',
        status,
        tags: uniqueTags(input.tags, ['captacion', 'statefox']),
      }
    case 'prospecto':
      return {
        contact_type: 'prospecto',
        status,
        tags: uniqueTags(
          input.tags,
          notes.includes('captador') || notes.includes('vende') ? ['captacion'] : [],
        ),
      }
    default:
      return {
        contact_type: contactType,
        status,
        tags: input.tags,
      }
  }
}

function normalizeRow(row: CsvContactRow) {
  const id = toNullableString(row.id)
  const fullName = toNullableString(row.full_name)
  if (!id || !fullName) return null

  const notes = toNullableString(row.notes)
  const taxonomy = normalizeContactTaxonomy({
    contactType: toNullableString(row.contact_type) ?? 'contacto',
    status: toNullableString(row.status) ?? 'nuevo',
    tags: parseTags(row.tags),
    notes,
  })

  return {
    id,
    full_name: fullName,
    phone: toNullableString(row.phone),
    phone2: toNullableString(row.phone2),
    email: toNullableString(row.email)?.toLowerCase() ?? null,
    contact_type: taxonomy.contact_type,
    pipeline_stage: toNullableString(row.pipeline_stage) ?? 'nuevo',
    status: taxonomy.status,
    city: toNullableString(row.city),
    address: toNullableString(row.address),
    notes,
    tags: taxonomy.tags,
    agent_id: toNullableString(row.agent_id),
    birth_date: toNullableString(row.birth_date),
    nationality: toNullableString(row.nationality),
    id_number: toNullableString(row.id_number),
    source_ref: toNullableString(row.source_ref),
    created_at: toNullableString(row.created_at) ?? new Date().toISOString(),
    updated_at: toNullableString(row.updated_at) ?? new Date().toISOString(),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const deleteIds = Array.isArray(body?.delete_ids)
      ? body.delete_ids.map((value: unknown) => toNullableString(value)).filter(Boolean) as string[]
      : []

    if (deleteIds.length > 0) {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', deleteIds)

      if (error) return json({ error: error.message }, { status: 500 })
      return json({ ok: true, deleted: deleteIds.length })
    }

    const rows = Array.isArray(body?.rows) ? body.rows as CsvContactRow[] : []
    if (rows.length === 0) {
      return json({ error: 'rows required' }, { status: 400 })
    }

    const normalized = rows
      .map(normalizeRow)
      .filter((row): row is NonNullable<ReturnType<typeof normalizeRow>> => Boolean(row))

    if (normalized.length === 0) {
      return json({ error: 'no valid rows' }, { status: 400 })
    }

    const ids = normalized.map((row) => row.id)
    const existingIds = new Set<string>()
    const lookupChunkSize = 100
    for (let index = 0; index < ids.length; index += lookupChunkSize) {
      const chunkIds = ids.slice(index, index + lookupChunkSize)
      const { data: existingRows, error: existingError } = await supabase
        .from('contacts')
        .select('id')
        .in('id', chunkIds)

      if (existingError) {
        return json({ error: existingError.message }, { status: 500 })
      }

      for (const row of existingRows ?? []) {
        existingIds.add(row.id)
      }
    }

    const sanitizedRows = normalized.map((row) => ({
      ...row,
      agent_id: null,
    }))
    const inserted = sanitizedRows.filter((row) => !existingIds.has(row.id)).length
    const updated = sanitizedRows.length - inserted

    const { error } = await supabase
      .from('contacts')
      .upsert(sanitizedRows, { onConflict: 'id' })

    if (error) {
      return json({ error: error.message }, { status: 500 })
    }

    return json({
      ok: true,
      processed: sanitizedRows.length,
      inserted,
      updated,
      skipped: rows.length - sanitizedRows.length,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
})
