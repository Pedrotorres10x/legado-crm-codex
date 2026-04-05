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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function scoreMediaReadiness(args: {
  imageCount: number
  videoCount: number
  floorPlanCount: number
  hasVirtualTour: boolean
}) {
  const { imageCount, videoCount, floorPlanCount, hasVirtualTour } = args
  let score = 0
  score += Math.min(imageCount, 10) * 5
  if (videoCount > 0) score += 20
  if (hasVirtualTour) score += 20
  if (floorPlanCount > 0) score += 10
  return Math.min(score, 100)
}

interface AuditPortalPayload {
  limit?: number
  only_available?: boolean
}

interface PortalPropertyRow {
  id: string
  crm_reference: string | null
  title: string | null
  city: string | null
  province: string | null
  price: number | null
  status: string | null
  is_featured: boolean | null
  tags: unknown
  images: unknown
  image_order: unknown
  videos: unknown
  virtual_tour_url: string | null
  floor_plans: unknown
  source: string | null
  source_feed_name: string | null
  updated_at: string | null
}

interface PortalReadinessRow {
  id: string
  crm_reference: string | null
  title: string | null
  city: string | null
  province: string | null
  price: number | null
  status: string | null
  is_featured: boolean
  cohort_kyero: boolean
  source: string | null
  source_feed_name: string | null
  image_count: number
  video_count: number
  floor_plan_count: number
  has_virtual_tour: boolean
  media_score: number
  missing_core_media: string[]
  portal_readiness: Record<string, unknown>
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

    const payload = req.method === 'POST' ? await req.json().catch(() => ({} as AuditPortalPayload)) : {} as AuditPortalPayload
    const limit = Math.max(1, Math.min(Number(payload?.limit) || 250, 1000))
    const onlyAvailable = payload?.only_available !== false

    let query = supabase
      .from('properties')
      .select(`
        id, crm_reference, title, city, province, price, status, is_featured, tags,
        images, image_order, videos, virtual_tour_url, floor_plans, source, source_feed_name, updated_at
      `)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (onlyAvailable) {
      query = query.eq('status', 'disponible')
    }

    const { data, error } = await query
    if (error) return json({ ok: false, error: error.message }, { status: 500 })

    const properties: PortalReadinessRow[] = ((data ?? []) as PortalPropertyRow[]).map((row) => {
      const tags = toStringArray(row.tags)
      const images = toStringArray(row.images)
      const videos = toStringArray(row.videos)
      const floorPlans = toStringArray(row.floor_plans)
      const hasVirtualTour = Boolean(row.virtual_tour_url)
      const imageCount = images.length
      const videoCount = videos.length
      const floorPlanCount = floorPlans.length
      const mediaScore = scoreMediaReadiness({ imageCount, videoCount, floorPlanCount, hasVirtualTour })
      const cohortKyero = tags.includes('portal_cohort_alicante_50')

      const missingCoreMedia: string[] = []
      if (imageCount < 6) missingCoreMedia.push('photos')
      if (videoCount === 0) missingCoreMedia.push('video')
      if (!hasVirtualTour) missingCoreMedia.push('virtual_tour')
      if (floorPlanCount === 0) missingCoreMedia.push('floor_plan')

      return {
        id: row.id,
        crm_reference: row.crm_reference,
        title: row.title,
        city: row.city,
        province: row.province,
        price: row.price,
        status: row.status,
        is_featured: Boolean(row.is_featured),
        cohort_kyero: cohortKyero,
        source: row.source,
        source_feed_name: row.source_feed_name,
        image_count: imageCount,
        video_count: videoCount,
        floor_plan_count: floorPlanCount,
        has_virtual_tour: hasVirtualTour,
        media_score: mediaScore,
        missing_core_media: missingCoreMedia,
        portal_readiness: {
          kyero_1001: {
            supports: ['photos', 'video', 'virtual_tour', 'floorplan_as_image'],
            has_min_photos: imageCount >= 6,
            has_video: videoCount > 0,
            has_virtual_tour: hasVirtualTour,
            has_floor_plan: floorPlanCount > 0,
          },
          fotocasa: {
            supports: ['photos', 'plans', 'videos', 'virtual_tour'],
            has_min_photos: imageCount >= 6,
            has_video: videoCount > 0,
            has_virtual_tour: hasVirtualTour,
            has_floor_plan: floorPlanCount > 0,
          },
          pisos_todopisos: {
            supports: ['photos', 'videos', 'virtual_tour'],
            has_min_photos: imageCount >= 6,
            has_video: videoCount > 0,
            has_virtual_tour: hasVirtualTour,
          },
          thinkspain: {
            supports: ['photos', 'media.video', 'media.virtualtour', 'media.floorplan'],
            has_min_photos: imageCount >= 6,
            has_video: videoCount > 0,
            has_virtual_tour: hasVirtualTour,
            has_floor_plan: floorPlanCount > 0,
          },
        },
      }
    })

    const summary = {
      total: properties.length,
      available: properties.filter((row) => row.status === 'disponible').length,
      featured: properties.filter((row) => row.is_featured).length,
      cohort_kyero: properties.filter((row) => row.cohort_kyero).length,
      with_6_plus_photos: properties.filter((row) => row.image_count >= 6).length,
      with_video: properties.filter((row) => row.video_count > 0).length,
      with_virtual_tour: properties.filter((row) => row.has_virtual_tour).length,
      with_floor_plan: properties.filter((row) => row.floor_plan_count > 0).length,
      media_rich: properties.filter((row) => row.media_score >= 70).length,
      missing_video: properties.filter((row) => row.video_count === 0).length,
      missing_virtual_tour: properties.filter((row) => !row.has_virtual_tour).length,
      missing_floor_plan: properties.filter((row) => row.floor_plan_count === 0).length,
      missing_photos: properties.filter((row) => row.image_count < 6).length,
    }

    const priority = [...properties]
      .filter((row) => row.is_featured || row.cohort_kyero || row.media_score < 70)
      .sort((a, b) => {
        const aWeight = (a.is_featured ? 100 : 0) + (a.cohort_kyero ? 50 : 0) - a.media_score
        const bWeight = (b.is_featured ? 100 : 0) + (b.cohort_kyero ? 50 : 0) - b.media_score
        return bWeight - aWeight
      })
      .slice(0, 50)

    return json({ ok: true, summary, priority, properties })
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
})
