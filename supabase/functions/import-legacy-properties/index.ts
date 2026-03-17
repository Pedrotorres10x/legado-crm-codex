import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CURRENT_SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const CURRENT_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LEGACY_SUPABASE_URL = Deno.env.get('LEGACY_CRM_SUPABASE_URL') ?? ''
const LEGACY_SUPABASE_ANON_KEY = Deno.env.get('LEGACY_CRM_SUPABASE_ANON_KEY') ?? ''
const LEGACY_PROJECT_ID = 'srhkvthmzusfrbqtijlw'

type LegacyProperty = Record<string, any>
type CurrentPropertyRef = {
  id: string
  crm_reference: string | null
  portal_token: string | null
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

function sanitizeSource(source: unknown): string {
  if (typeof source === 'string' && source.trim().length > 0) return source.trim()
  return 'legacy-crm'
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return Array.from(
    new Set(
      values
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  )
}

function sanitizeProperty(record: LegacyProperty) {
  const fallbackXmlId =
    record.xml_id ??
    (record.crm_reference ? `legacy-${record.crm_reference}` : null) ??
    (record.portal_token ? `legacy-${record.portal_token}` : null)

  const {
    id: legacyId,
    owner_id: legacyOwnerId,
    agent_id: legacyAgentId,
    search_vector: _searchVector,
    is_international: _isInternational,
    source_metadata: legacySourceMetadata,
    source_raw_xml: legacySourceRawXml,
    created_at,
    updated_at,
    ...rest
  } = record

  return {
    ...rest,
    created_at,
    updated_at,
    agent_id: null,
    owner_id: null,
    key_location: 'oficina',
    source: sanitizeSource(record.source),
    xml_id: fallbackXmlId,
    images: uniqueStrings(record.images),
    videos: uniqueStrings(record.videos),
    floor_plans: uniqueStrings(record.floor_plans),
    source_metadata: {
      ...(legacySourceMetadata && typeof legacySourceMetadata === 'object' ? legacySourceMetadata : {}),
      legacy_origin: {
        project_id: LEGACY_PROJECT_ID,
        legacy_property_id: legacyId,
        crm_reference: record.crm_reference ?? null,
        portal_token: record.portal_token ?? null,
        legacy_source: record.source ?? null,
        legacy_owner_id: legacyOwnerId ?? null,
        legacy_agent_id: legacyAgentId ?? null,
        imported_at: new Date().toISOString(),
      },
    },
    source_raw_xml: legacySourceRawXml ?? null,
  }
}

async function fetchLegacyPage(offset: number, limit: number): Promise<LegacyProperty[]> {
  const url = new URL(`${LEGACY_SUPABASE_URL}/rest/v1/properties`)
  url.searchParams.set('select', '*')
  url.searchParams.set('or', '(source.is.null,source.neq.habihub)')
  url.searchParams.set('order', 'updated_at.desc.nullslast')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))

  const response = await fetch(url.toString(), {
    headers: {
      apikey: LEGACY_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${LEGACY_SUPABASE_ANON_KEY}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Legacy fetch failed (${response.status}): ${text}`)
  }

  return (await response.json()) as LegacyProperty[]
}

async function loadAllLegacyProperties(): Promise<LegacyProperty[]> {
  const pageSize = 500
  let offset = 0
  const results: LegacyProperty[] = []

  while (true) {
    const page = await fetchLegacyPage(offset, pageSize)
    results.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return results
}

async function loadCurrentReferences(supabase: ReturnType<typeof createClient>) {
  const crmReferenceMap = new Map<string, CurrentPropertyRef>()
  const portalTokenMap = new Map<string, CurrentPropertyRef>()
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('properties')
      .select('id, crm_reference, portal_token')
      .range(from, from + pageSize - 1)

    if (error) throw error
    const page = data ?? []

    for (const row of page as CurrentPropertyRef[]) {
      if (row.crm_reference) crmReferenceMap.set(row.crm_reference, row)
      if (row.portal_token) portalTokenMap.set(row.portal_token, row)
    }

    if (page.length < pageSize) break
    from += pageSize
  }

  return { crmReferenceMap, portalTokenMap }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!CURRENT_SUPABASE_URL || !CURRENT_SERVICE_ROLE_KEY) {
      throw new Error('Current Supabase env vars are missing')
    }
    if (!LEGACY_SUPABASE_URL || !LEGACY_SUPABASE_ANON_KEY) {
      throw new Error('Legacy CRM env vars are missing')
    }

    const supabase = createClient(CURRENT_SUPABASE_URL, CURRENT_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const internalToken = CURRENT_SERVICE_ROLE_KEY

    if (token && token !== internalToken) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token)

      if (authError || !user) {
        return json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: hasAdminRole, error: roleError } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin',
      })

      const { data: hasCoordRole, error: coordError } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'coordinadora',
      })

      if (roleError || coordError) {
        return json({ error: 'Could not verify permissions' }, { status: 500 })
      }

      if (!hasAdminRole && !hasCoordRole) {
        return json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const legacyProperties = await loadAllLegacyProperties()
    const { crmReferenceMap, portalTokenMap } = await loadCurrentReferences(supabase)

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const legacyProperty of legacyProperties) {
      const crmReference = legacyProperty.crm_reference ?? null
      const portalToken = legacyProperty.portal_token ?? null
      const existing =
        (crmReference ? crmReferenceMap.get(crmReference) : null) ??
        (portalToken ? portalTokenMap.get(portalToken) : null) ??
        null

      const payload = sanitizeProperty(legacyProperty)

      let resultError: { message: string } | null = null

      if (existing) {
        const { error } = await supabase
          .from('properties')
          .update(payload)
          .eq('id', existing.id)

        resultError = error
        if (!error) updated += 1
      } else if (!crmReference && !portalToken) {
        skipped += 1
      } else {
        const { error, data } = await supabase
          .from('properties')
          .insert(payload, { defaultToNull: false })
          .select('id, crm_reference, portal_token')
          .single()

        resultError = error
        if (!error) {
          inserted += 1
          if (data?.crm_reference) crmReferenceMap.set(data.crm_reference, data as CurrentPropertyRef)
          if (data?.portal_token) portalTokenMap.set(data.portal_token, data as CurrentPropertyRef)
        }
      }

      if (resultError) {
        errors.push(`${crmReference ?? portalToken ?? legacyProperty.id}: ${resultError.message}`)
      }
    }

    return json({
      success: true,
      project_id: LEGACY_PROJECT_ID,
      scanned: legacyProperties.length,
      inserted,
      updated,
      skipped,
      errors,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: message }, { status: 500 })
  }
})
