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

async function fetchTextWithTimeout(url: string, timeoutMs = 120000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    const body = await response.text()
    return { response, body }
  } finally {
    clearTimeout(timeoutId)
  }
}

type PortalFeed = {
  id: string
  portal_name: string
  display_name: string
  format: string
  is_active: boolean
  feed_token: string
}

async function callFotocasaSync(supabaseUrl: string, serviceRoleKey: string, body: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/functions/v1/fotocasa-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Missing Supabase runtime secrets' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data, error } = await supabase
      .from('portal_feeds')
      .select('id, portal_name, display_name, format, is_active, feed_token')
      .in('portal_name', ['fotocasa', 'pisos', 'todopisos', '1001portales', 'kyero', 'thinkspain'])
      .order('display_name')

    if (error) {
      return json({ error: error.message }, { status: 500 })
    }

    const feeds = (data ?? []) as PortalFeed[]
    const xmlResults = await Promise.all(
      feeds
        .filter((item) => item.portal_name !== 'fotocasa' && item.is_active)
        .map(async (feed) => {
          const url = `${supabaseUrl}/functions/v1/portal-xml-feed?token=${encodeURIComponent(feed.feed_token)}`
          try {
            const { response, body } = await fetchTextWithTimeout(url)
            return {
              portal_name: feed.portal_name,
              display_name: feed.display_name,
              ok: response.ok,
              status: response.status,
              bytes: body.length,
            }
          } catch (err) {
            const errorMessage = err instanceof DOMException && err.name === 'AbortError'
              ? 'timeout'
              : String(err)
            return {
              portal_name: feed.portal_name,
              display_name: feed.display_name,
              ok: false,
              status: errorMessage === 'timeout' ? 504 : 0,
              error: errorMessage,
            }
          }
        }),
    )

    const fotocasaFeed = feeds.find((item) => item.portal_name === 'fotocasa' && item.is_active)
    const fotocasaResult = fotocasaFeed
      ? await (async () => {
          try {
            const watchdog = await callFotocasaSync(supabaseUrl, serviceRoleKey, {
              action: 'watchdog',
              batch_size: 10,
            })

            const sync = await callFotocasaSync(supabaseUrl, serviceRoleKey, {
              action: 'sync_all',
              batch_size: 10,
              offset: 0,
            })

            return {
              watchdog,
              sync,
            }
          } catch (err) {
            return {
              ok: false,
              status: 0,
              error: String(err),
            }
          }
        })()
      : null

    return json({
      ok: true,
      activated_feeds: feeds.map((feed) => ({
        portal_name: feed.portal_name,
        display_name: feed.display_name,
        is_active: feed.is_active,
        format: feed.format,
        url: `${supabaseUrl}/functions/v1/portal-xml-feed?token=${feed.feed_token}`,
      })),
      xml_results: xmlResults,
      fotocasa_result: fotocasaResult,
    })
  } catch (err) {
    return json({ error: String(err) }, { status: 500 })
  }
})
