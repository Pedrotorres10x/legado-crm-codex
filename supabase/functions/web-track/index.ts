import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Bot / crawler / spam patterns ────────────────────────────────────────────
const BOT_UA_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /scraper/i,
  /headless/i, /phantom/i, /selenium/i, /puppeteer/i, /playwright/i,
  /googlebot/i, /bingbot/i, /yandex/i, /baiduspider/i, /duckduckbot/i,
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /applebot/i, /curl/i, /wget/i, /python-requests/i,
  /go-http-client/i, /libwww/i, /httpunit/i,
  /dataprovider/i, /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i,
  /rogerbot/i, /exabot/i, /gigabot/i, /ia_archiver/i,
]

const BOT_SESSION_PATTERNS = [/^bot/i, /^spider/i, /^crawler/i]

function isBot(ua: string, sessionId: string): boolean {
  if (!ua || ua.trim().length < 10) return true
  // UA starts with [FBAN/ without Mozilla = Facebook link previewer, not a real browser
  if (ua.startsWith('[FBAN/')) return true
  if (BOT_UA_PATTERNS.some(p => p.test(ua))) return true
  if (BOT_SESSION_PATTERNS.some(p => p.test(sessionId))) return true
  // Very old Chrome (< 100) — almost certainly a bot in 2025+
  const chromeVer = ua.match(/Chrome\/(\d+)\./)
  if (chromeVer && parseInt(chromeVer[1]) < 100 && !/FB_IAB|Instagram|Edg\//.test(ua)) return true
  // Heuristic: Future iOS versions (>= 26 as of Feb 2026)
  const iosMatch = ua.match(/CPU iPhone OS (\d+)_/)
  if (iosMatch && parseInt(iosMatch[1]) >= 26) return true
  // Heuristic: Safari Version/26+ doesn't exist yet
  if (/Version\/2[6-9]\./.test(ua) && /Safari/.test(ua)) return true
  // Heuristic: Non-existent iOS subversions (18_7+ doesn't exist, current max ~18.3)
  if (iosMatch && parseInt(iosMatch[1]) === 18) {
    const subMatch = ua.match(/iPhone OS 18_(\d+)/)
    if (subMatch && parseInt(subMatch[1]) >= 7) return true
  }
  return false
}

// ── Internal / editor traffic filter ─────────────────────────────────────────
const INTERNAL_INDICATORS = [
  '__lovable_token',
  'forceHideBadge',
  'lovable.app',
  'lovable.dev',
  'lovableproject.com',
  'adsmanager.facebook.com',  // ← tráfico propio desde Meta Ads Manager
]

function isInternalTraffic(page: string, referrer: string | null): boolean {
  return INTERNAL_INDICATORS.some(
    ind => page.includes(ind) || (referrer ?? '').includes(ind)
  )
}

// ── Load exclusions from DB (emails, IPs, session prefixes) ──────────────────
async function loadExclusions(supabase: any): Promise<{ emails: Set<string>; ips: Set<string>; sessionPrefixes: string[] }> {
  const { data } = await supabase
    .from('analytics_exclusions')
    .select('type, value')
  const emails = new Set<string>()
  const ips = new Set<string>()
  const sessionPrefixes: string[] = []
  for (const row of (data ?? [])) {
    const v = (row.value ?? '').trim().toLowerCase()
    if (row.type === 'email') emails.add(v)
    else if (row.type === 'ip') ips.add(v)
    else if (row.type === 'session_prefix') sessionPrefixes.push(v)
  }
  return { emails, ips, sessionPrefixes }
}

// ── Extract real IP from request headers ─────────────────────────────────────
function extractIP(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')
  return forwarded ? forwarded.split(',')[0].trim() : null
}

// ── URL cleaning: extract real path from garbled Facebook Ads URLs ────────────
function extractCleanPath(rawPage: string): string {
  try {
    // Case 1: the whole raw value is itself an encoded URL (e.g. "https%3A%2F%2F...")
    const decoded = decodeURIComponent(rawPage)
    if (decoded.startsWith('http')) {
      return new URL(decoded).pathname || '/'
    }

    // Case 2: path has a full URL embedded after the "?" 
    // e.g. "/?https%3A%2F%2Flegadocoleccion.lovable.app%2Fpropiedades%3Futm_source=..."
    if (rawPage.includes('?http')) {
      const inner = rawPage.split('?')[1]
      const innerDecoded = decodeURIComponent(inner)
      if (innerDecoded.startsWith('http')) {
        return new URL(innerDecoded).pathname || '/'
      }
    }

    // Case 3: normal path — strip query string
    return rawPage.split('?')[0] || '/'
  } catch {
    return rawPage.substring(0, 500)
  }
}

// ── UTM extraction (from original raw URL before cleaning) ───────────────────
// Also accepts referrer to apply fallback attribution when UTMs are stripped
// by Facebook's in-app browser (FB_IAB).
function extractUTMs(rawUrl: string, referrer?: string | null): {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
} {
  let result = {
    utm_source: null as string | null,
    utm_medium: null as string | null,
    utm_campaign: null as string | null,
    utm_content: null as string | null,
    utm_term: null as string | null,
  }

  try {
    // Handle the case where the real URL is embedded in the query string
    let urlToParse = rawUrl

    if (rawUrl.includes('?http')) {
      const inner = rawUrl.split('?')[1]
      const innerDecoded = decodeURIComponent(inner)
      if (innerDecoded.startsWith('http')) {
        urlToParse = innerDecoded
      }
    }

    const fullUrl = urlToParse.startsWith('http')
      ? urlToParse
      : `https://legadocoleccion.es${urlToParse}`

    const url = new URL(fullUrl)
    result = {
      utm_source: url.searchParams.get('utm_source'),
      utm_medium: url.searchParams.get('utm_medium'),
      utm_campaign: url.searchParams.get('utm_campaign'),
      utm_content: url.searchParams.get('utm_content'),
      utm_term: url.searchParams.get('utm_term'),
    }

    // ── Facebook fbclid fallback: UTMs vacíos pero fbclid presente → inferir ──
    if (!result.utm_source && url.searchParams.get('fbclid')) {
      result.utm_source = 'facebook'
      result.utm_medium = 'paid'
    }
  } catch {
    // fall through to referrer fallback
  }

  // ── Referrer fallback: FB_IAB elimina UTMs pero el referrer delata el origen ─
  if (!result.utm_source) {
    const ref = (referrer ?? '').toLowerCase()
    if (
      ref.includes('facebook.com') ||
      ref.includes('fb.com') ||
      ref.includes('m.facebook') ||
      ref.includes('l.facebook')
    ) {
      result.utm_source = 'facebook'
      result.utm_medium = result.utm_medium ?? 'social'
    } else if (ref.includes('instagram.com')) {
      result.utm_source = 'instagram'
      result.utm_medium = result.utm_medium ?? 'social'
    }
  }

  return result
}

// ── Country detection ─────────────────────────────────────────────────────────
async function detectCountry(req: Request): Promise<string | null> {
  // 1. Cloudflare header
  const cfCountry = req.headers.get('cf-ipcountry')
  if (cfCountry && cfCountry !== 'XX' && /^[A-Z]{2}$/.test(cfCountry)) {
    return cfCountry
  }

  // 2. Extract real IP
  const forwarded = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')
  const ip = forwarded ? forwarded.split(',')[0].trim() : null

  if (!ip || ip === '127.0.0.1' || ip === '::1') return null

  // 3. ipapi.co
  try {
    const geoRes = await fetch(`https://ipapi.co/${ip}/country/`, {
      headers: { 'User-Agent': 'legadocrm-tracker/1.0' },
      signal: AbortSignal.timeout(2500),
    })
    if (geoRes.ok) {
      const code = (await geoRes.text()).trim()
      if (/^[A-Z]{2}$/.test(code)) return code
    }
  } catch {
    // fall through
  }

  // 4. Fallback: ip-api.com
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      headers: { 'User-Agent': 'legadocrm-tracker/1.0' },
      signal: AbortSignal.timeout(2500),
    })
    if (geoRes.ok) {
      const json = await geoRes.json()
      const code = json?.countryCode
      if (code && /^[A-Z]{2}$/.test(code)) return code
    }
  } catch {
    // also failed
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { session_id, page: rawPage, referrer } = body

    if (!session_id || typeof session_id !== 'string') {
      return new Response(JSON.stringify({ error: 'session_id requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ua = req.headers.get('user-agent') ?? ''

    // ── Bot filter ────────────────────────────────────────────────────────────
    if (isBot(ua, session_id)) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawPageStr: string = rawPage ?? '/'

    // ── Internal / editor traffic filter ─────────────────────────────────────
    if (isInternalTraffic(rawPageStr, referrer ?? null)) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Team exclusions filter (emails, IPs, session prefixes) ────────────────
    const exclusions = await loadExclusions(supabase)
    const visitorIP = extractIP(req)

    // Check IP exclusion
    if (visitorIP && exclusions.ips.has(visitorIP.toLowerCase())) {
      return new Response(JSON.stringify({ ok: true, excluded: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check email exclusion (email may be sent by the tracker if visitor submits a form)
    const visitorEmail = (body.email ?? '').trim().toLowerCase()
    if (visitorEmail && exclusions.emails.has(visitorEmail)) {
      return new Response(JSON.stringify({ ok: true, excluded: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check session_id prefix exclusion
    const sidLower = session_id.toLowerCase()
    if (exclusions.sessionPrefixes.some(prefix => sidLower.startsWith(prefix))) {
      return new Response(JSON.stringify({ ok: true, excluded: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Extract UTMs (con fallback por referrer Facebook/Instagram) ───────────
    const utms = extractUTMs(rawPageStr, referrer ?? null)

    // ── Clean the page path ───────────────────────────────────────────────────
    const page = extractCleanPath(rawPageStr)

    let device = 'desktop'
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) device = 'mobile'
    else if (/iPad|Tablet/i.test(ua)) device = 'tablet'

    // ── Country detection ─────────────────────────────────────────────────────
    const country = await detectCountry(req)

    // ── Deduplication: reject same session+page within 3 seconds ──────────────
    const { data: recentHit } = await supabase
      .from('web_pageviews')
      .select('id')
      .eq('session_id', session_id.substring(0, 64))
      .eq('page', page.substring(0, 500))
      .gte('created_at', new Date(Date.now() - 3000).toISOString())
      .limit(1)
    if (recentHit && recentHit.length > 0) {
      return new Response(JSON.stringify({ ok: true, dedup: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('web_pageviews').insert({
      session_id: session_id.substring(0, 64),
      page: page.substring(0, 500),
      referrer: referrer ? referrer.substring(0, 500) : null,
      user_agent: ua.substring(0, 300),
      country,
      device,
      ...utms,
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Track error:', err)
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
