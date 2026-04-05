import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function uniqueTags(tags: string[] | null | undefined, additions: string[] = []) {
  const all = [...(tags ?? []), ...additions]
    .map((tag) => tag?.trim())
    .filter((tag): tag is string => Boolean(tag))

  return all.length > 0 ? Array.from(new Set(all)) : null
}

type ContactRow = {
  id: string
  contact_type: string
  status: string
  tags: string[] | null
  notes: string | null
}

function normalizeContact(row: ContactRow) {
  const notes = (row.notes ?? '').toLowerCase()
  const updates: {
    contact_type: string
    status: string
    tags?: string[] | null
  } = {}

  switch (row.contact_type) {
    case 'comprador_cerrado':
      updates.contact_type = 'comprador'
      updates.status = 'cerrado'
      updates.tags = uniqueTags(row.tags, ['comprador-cerrado'])
      break
    case 'vendedor_cerrado':
      updates.contact_type = 'propietario'
      updates.status = 'cerrado'
      updates.tags = uniqueTags(row.tags, ['vendedor-cerrado', 'captacion'])
      break
    case 'statefox':
      updates.contact_type = 'prospecto'
      updates.tags = uniqueTags(row.tags, ['captacion', 'statefox'])
      break
    case 'prospecto':
      updates.tags = uniqueTags(
        row.tags,
        notes.includes('captador') || notes.includes('vende') ? ['captacion'] : [],
      )
      break
    default:
      return null
  }

  updates.contact_type = updates.contact_type ?? row.contact_type
  updates.status = updates.status ?? row.status

  return {
    id: row.id,
    ...updates,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data, error } = await supabase
      .from('contacts')
      .select('id, contact_type, status, tags, notes')
      .in('contact_type', ['comprador_cerrado', 'vendedor_cerrado', 'statefox', 'prospecto'])

    if (error) {
      return json({ error: error.message }, { status: 500 })
    }

    const normalized = (data ?? [])
      .map((row) => normalizeContact(row as ContactRow))
      .filter((row): row is NonNullable<ReturnType<typeof normalizeContact>> => Boolean(row))

    if (normalized.length === 0) {
      return json({ ok: true, updated: 0, counts: {} })
    }

    const counts = normalized.reduce<Record<string, number>>((acc, row) => {
      const contactType = row.contact_type ?? 'unchanged'
      acc[contactType] = (acc[contactType] ?? 0) + 1
      return acc
    }, {})

    for (const row of normalized) {
      const { id, ...updates } = row
      const { error: updateError } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)

      if (updateError) {
        return json({ error: updateError.message, failed_id: id }, { status: 500 })
      }
    }

    return json({
      ok: true,
      updated: normalized.length,
      counts,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
})
