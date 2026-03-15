import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: property, error } = await supabase
      .from('properties')
      .select('id, title, description, property_type, operation, price, surface_area, bedrooms, bathrooms, city, province, images, image_order, status, updated_at')
      .eq('id', id)
      .single()

    if (error || !property) {
      return new Response(JSON.stringify({ error: 'Property not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Build OG metadata (NO agency branding) ──────────────────────────
    const typeMap: Record<string, string> = {
      piso: 'Piso', casa: 'Casa', chalet: 'Chalet', adosado: 'Adosado',
      atico: 'Ático', duplex: 'Dúplex', estudio: 'Estudio', local: 'Local',
      oficina: 'Oficina', nave: 'Nave', terreno: 'Terreno', garaje: 'Garaje',
      trastero: 'Trastero', otro: 'Propiedad',
    }
    const opMap: Record<string, string> = {
      venta: 'en venta', alquiler: 'en alquiler', ambas: 'en venta/alquiler',
    }

    const typeLabel = typeMap[property.property_type] || 'Propiedad'
    const opLabel = opMap[property.operation] || ''
    const cityLabel = property.city || property.province || ''

    const titleParts: string[] = []
    if (property.bedrooms) titleParts.push(`${property.bedrooms} hab`)
    if (property.surface_area) titleParts.push(`${property.surface_area} m²`)
    if (property.price) titleParts.push(`${Number(property.price).toLocaleString('es-ES')} €`)

    const ogTitle = [
      `${typeLabel} ${opLabel}${cityLabel ? ` en ${cityLabel}` : ''}`,
      ...titleParts,
    ].join(' · ')

    const descParts: string[] = []
    if (property.bedrooms) descParts.push(`${property.bedrooms} habitaciones`)
    if (property.bathrooms) descParts.push(`${property.bathrooms} baños`)
    if (property.surface_area) descParts.push(`${property.surface_area} m²`)
    if (property.price) descParts.push(`${Number(property.price).toLocaleString('es-ES')} €`)

    const rawDesc = property.description
      ? property.description
          .replace(/<[^>]*>/g, ' ')
          .replace(/&[a-z#0-9]+;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : `${typeLabel} ${opLabel}${cityLabel ? ` en ${cityLabel}` : ''}. ${descParts.join(', ')}.`

    const fullDesc = rawDesc || `${typeLabel} ${opLabel}.`
    const ogDescription = fullDesc.length > 160
      ? fullDesc.substring(0, 157).trimEnd() + '...'
      : fullDesc

    // Cover image (same logic as og-property)
    let ogImage = ''
    if (property.images && property.images.length > 0) {
      ogImage = property.images[0]
      if (property.image_order && Array.isArray(property.image_order) && property.image_order.length > 0) {
        const entry = property.image_order[0]
        const name = typeof entry === 'string' ? entry : entry?.name
        if (typeof name === 'string' && name.startsWith('xml_')) {
          const idx = parseInt(name.replace('xml_', ''), 10)
          if (!isNaN(idx) && idx < property.images.length) ogImage = property.images[idx]
        } else if (typeof name === 'string') {
          const found = property.images.find((u: string) => u.includes(name))
          if (found) ogImage = found
        }
      }
    }

    const blindFnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/og-blind?id=${property.id}`
    const canonicalUrl = blindFnUrl
    // Redirect to the CRM app where /ficha-ciega/:id route exists
    const appUrl = `https://legadocrm.lovable.app/ficha-ciega/${property.id}`

    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

    const imageType = ogImage.match(/\.png/i) ? 'image/png' : 'image/jpeg'

    // NOTE: No og:site_name, no agency references
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(ogTitle)}</title>
  <meta name="description" content="${esc(ogDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(appUrl)}">
  <meta property="og:title" content="${esc(ogTitle)}">
  <meta property="og:description" content="${esc(ogDescription)}">
  ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="${imageType}">` : ''}
  <meta property="og:locale" content="es_ES">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(ogTitle)}">
  <meta name="twitter:description" content="${esc(ogDescription)}">
  ${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ''}
  <meta http-equiv="refresh" content="0;url=${esc(appUrl)}">
</head>
<body>
  <p>Redirigiendo...</p>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('og-blind error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})