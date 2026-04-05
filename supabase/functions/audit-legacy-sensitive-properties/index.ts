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

const DEFAULT_REFS = [
  'LGD-5281',
  'LGD-3177',
  'LGD-2470',
  'LGD-2373',
  'LGD-2372',
  'LGD-2172',
  'LGD-2169',
  'LGD-2074',
  'LGD-1884',
  'LGD-1668',
  'LGD-1448',
  'LGD-1447',
]

type PropertyRow = {
  id: string
  title: string
  crm_reference: string | null
  reference: string | null
  status: string
  property_type: string
  operation: string
  price: number | null
  city: string | null
  source: string | null
  source_feed_name: string | null
  images: string[] | null
  image_order: unknown
  videos: string[] | null
  virtual_tour_url: string | null
  created_at: string
  updated_at: string
}

type AuditPropertyRow = {
  crm_reference: string
  exists: boolean
  id?: string
  title?: string
  status?: string
  property_type?: string
  operation?: string
  price?: number | null
  city?: string | null
  source?: string | null
  source_feed_name?: string | null
  image_count?: number
  has_images?: boolean
  old_storage_images?: number
  has_videos?: boolean
  video_count?: number
  has_virtual_tour?: boolean
  created_at?: string
  updated_at?: string
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

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const refs = Array.isArray(body?.refs) && body.refs.length > 0 ? body.refs : DEFAULT_REFS

    const { data, error } = await supabase
      .from('properties')
      .select(`
        id, title, crm_reference, reference, status, property_type, operation, price, city,
        source, source_feed_name, images, image_order, videos, virtual_tour_url, created_at, updated_at
      `)
      .in('crm_reference', refs)
      .order('crm_reference', { ascending: true })

    if (error) {
      return json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []) as PropertyRow[]
    const byRef = new Map(rows.map((row) => [row.crm_reference, row]))

    const audit = refs.map((ref) => {
      const row = byRef.get(ref) ?? null
      if (!row) {
        return { crm_reference: ref, exists: false }
      }

      const images = row.images ?? []
      const videos = row.videos ?? []

      return {
        crm_reference: ref,
        exists: true,
        id: row.id,
        title: row.title,
        status: row.status,
        property_type: row.property_type,
        operation: row.operation,
        price: row.price,
        city: row.city,
        source: row.source,
        source_feed_name: row.source_feed_name,
        image_count: images.length,
        has_images: images.length > 0,
        old_storage_images: images.filter((url) => url.includes('srhkvthmzusfrbqtijlw')).length,
        has_videos: videos.length > 0,
        video_count: videos.length,
        has_virtual_tour: Boolean(row.virtual_tour_url),
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    })

    const typedAudit = audit as AuditPropertyRow[]
    const summary = {
      requested: refs.length,
      found: typedAudit.filter((row) => row.exists).length,
      missing: typedAudit.filter((row) => !row.exists).length,
      reserved: typedAudit.filter((row) => row.exists && row.status === 'reservado').length,
      sold: typedAudit.filter((row) => row.exists && row.status === 'vendido').length,
      available: typedAudit.filter((row) => row.exists && row.status === 'disponible').length,
      with_images: typedAudit.filter((row) => row.exists && row.has_images).length,
      with_old_storage_images: typedAudit.filter((row) => row.exists && (row.old_storage_images ?? 0) > 0).length,
      with_videos: typedAudit.filter((row) => row.exists && row.has_videos).length,
      with_virtual_tour: typedAudit.filter((row) => row.exists && row.has_virtual_tour).length,
    }

    return json({ ok: true, summary, properties: audit })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
})
