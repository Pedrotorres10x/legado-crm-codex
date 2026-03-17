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

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function uniqueUrlList(values: Array<unknown>): string[] {
  return Array.from(
    new Set(
      values
        .map(normalizeUrl)
        .filter((value): value is string => Boolean(value)),
    ),
  )
}

function isVideoFileName(value: string): boolean {
  const normalized = value.toLowerCase()
  return (
    normalized.endsWith('.mp4') ||
    normalized.endsWith('.mov') ||
    normalized.endsWith('.webm') ||
    normalized.endsWith('.m4v')
  )
}

function extractLegacyMedia(record: LegacyProperty) {
  const images = uniqueStrings(record.images)
  const directVideos = uniqueStrings(record.videos)
  const floorPlans = uniqueStrings(record.floor_plans)
  const virtualTourUrl =
    normalizeUrl(record.virtual_tour_url) ??
    normalizeUrl(record.virtual_tour) ??
    normalizeUrl(record.tour_url)

  const storageCandidates = Array.isArray(record.image_order) ? record.image_order : []
  const imageBaseUrl =
    typeof images[0] === 'string' && images[0].includes('/property-media/')
      ? images[0].slice(0, images[0].lastIndexOf('/') + 1)
      : `${LEGACY_SUPABASE_URL}/storage/v1/object/public/property-media/${record.id}/`

  const imageOrderVideos = storageCandidates.flatMap((item: any) => {
    const maybeUrl =
      normalizeUrl(item?.url) ??
      normalizeUrl(item?.src) ??
      normalizeUrl(item?.path) ??
      normalizeUrl(item?.name)

    if (!maybeUrl) return []
    if (/^https?:\/\//i.test(maybeUrl) && isVideoFileName(maybeUrl)) {
      return [maybeUrl]
    }
    if (item?.source === 'storage' && isVideoFileName(maybeUrl)) {
      return [`${imageBaseUrl}${maybeUrl}`]
    }
    return []
  })

  return {
    images,
    videos: uniqueUrlList([...directVideos, ...imageOrderVideos]),
    floorPlans,
    virtualTourUrl,
  }
}

function sanitizeProperty(record: LegacyProperty) {
  const fallbackXmlId =
    record.xml_id ??
    (record.crm_reference ? `legacy-${record.crm_reference}` : null) ??
    (record.portal_token ? `legacy-${record.portal_token}` : null)
  const media = extractLegacyMedia(record)

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
    images: media.images,
    videos: media.videos,
    floor_plans: media.floorPlans,
    virtual_tour_url: media.virtualTourUrl,
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
        detected_media: {
          images: media.images.length,
          videos: media.videos.length,
          floor_plans: media.floorPlans.length,
          virtual_tour_url: media.virtualTourUrl,
        },
        imported_at: new Date().toISOString(),
      },
    },
    source_raw_xml: legacySourceRawXml ?? null,
  }
}

function summarizeMedia(record: LegacyProperty) {
  const direct = {
    images: Array.isArray(record.images) ? record.images.length : 0,
    videos: Array.isArray(record.videos) ? record.videos.length : 0,
    floor_plans: Array.isArray(record.floor_plans) ? record.floor_plans.length : 0,
    virtual_tour_url:
      typeof record.virtual_tour_url === 'string' ? record.virtual_tour_url : null,
    virtual_tour:
      typeof record.virtual_tour === 'string' ? record.virtual_tour : null,
    video_url: typeof record.video_url === 'string' ? record.video_url : null,
    tour_url: typeof record.tour_url === 'string' ? record.tour_url : null,
  }

  const candidateKeys = Object.keys(record).filter((key) =>
    /image|photo|video|tour|plan|media|gallery/i.test(key),
  )

  const candidateValues = candidateKeys.reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = record[key]
    return acc
  }, {})

  return {
    id: record.id ?? null,
    crm_reference: record.crm_reference ?? null,
    source: record.source ?? null,
    title: record.title ?? null,
    direct,
    candidateKeys,
    candidateValues,
    source_metadata: record.source_metadata ?? null,
    source_raw_xml_preview:
      typeof record.source_raw_xml === 'string' ? record.source_raw_xml.slice(0, 4000) : null,
  }
}

function summarizeMediaStats(records: LegacyProperty[]) {
  const withDirectVideos = records.filter(
    (record) => Array.isArray(record.videos) && record.videos.length > 0,
  )
  const withVideoInImageOrder = records.filter((record) =>
    Array.isArray(record.image_order) &&
    record.image_order.some((item: any) => {
      const name = typeof item?.name === 'string' ? item.name.toLowerCase() : ''
      const label = typeof item?.label === 'string' ? item.label.toLowerCase() : ''
      return (
        name.endsWith('.mp4') ||
        name.endsWith('.mov') ||
        name.endsWith('.webm') ||
        label.includes('video')
      )
    }),
  )
  const withVirtualTour = records.filter(
    (record) =>
      (typeof record.virtual_tour_url === 'string' && record.virtual_tour_url.trim()) ||
      (typeof record.virtual_tour === 'string' && record.virtual_tour.trim()) ||
      (typeof record.tour_url === 'string' && record.tour_url.trim()),
  )
  const withFloorPlans = records.filter(
    (record) => Array.isArray(record.floor_plans) && record.floor_plans.length > 0,
  )

  const candidateCounts = new Map<string, number>()
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (/image|photo|video|tour|plan|media|gallery/i.test(key)) {
        candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1)
      }
    }
  }

  return {
    scanned: records.length,
    withDirectVideos: withDirectVideos.length,
    withVideoInImageOrder: withVideoInImageOrder.length,
    withVirtualTour: withVirtualTour.length,
    withFloorPlans: withFloorPlans.length,
    candidateKeyCounts: Object.fromEntries(
      Array.from(candidateCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    ),
    examples: {
      directVideos: withDirectVideos.slice(0, 5).map(summarizeMedia),
      videoInImageOrder: withVideoInImageOrder.slice(0, 5).map(summarizeMedia),
      virtualTour: withVirtualTour.slice(0, 5).map(summarizeMedia),
      floorPlans: withFloorPlans.slice(0, 5).map(summarizeMedia),
    },
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
    const url = new URL(req.url)

    if (url.searchParams.get('debug') === 'media') {
      const sample = await fetchLegacyPage(0, 10)
      return json({
        success: true,
        project_id: LEGACY_PROJECT_ID,
        sample_size: sample.length,
        sample: sample.map(summarizeMedia),
      })
    }
    if (url.searchParams.get('debug') === 'media-stats') {
      const records = await loadAllLegacyProperties()
      return json({
        success: true,
        project_id: LEGACY_PROJECT_ID,
        ...summarizeMediaStats(records),
      })
    }

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
