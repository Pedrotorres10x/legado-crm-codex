import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const { full_name, email, phone, message, property_id, gdpr_consent } = body
    const rawMetadata = body?.metadata ?? null

    // RGPD: require explicit consent from web leads
    if (gdpr_consent !== true) {
      return new Response(JSON.stringify({ error: 'Debes aceptar la política de privacidad para enviar tu consulta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate required fields
    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Nombre obligatorio (mín. 2 caracteres)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!email && !phone) {
      return new Response(JSON.stringify({ error: 'Email o teléfono obligatorio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Email inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate phone format if provided
    if (phone && !/^[+\d\s\-()\u00B7.]{6,25}$/.test(String(phone))) {
      return new Response(JSON.stringify({ error: 'Teléfono inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Team exclusion filter ─────────────────────────────────────────────────
    // If the email matches a known internal exclusion, silently skip (return success)
    if (email) {
      const { data: exclusions } = await supabase
        .from('analytics_exclusions')
        .select('value')
        .eq('type', 'email')
        .ilike('value', email.trim())
        .limit(1)
      if (exclusions && exclusions.length > 0) {
        console.log(`[public-lead] Excluded email detected: ${email} — skipping lead creation`)
        return new Response(JSON.stringify({ success: true, message: 'Gracias por tu interés. Te contactaremos pronto.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Also check IP exclusion
    const forwarded = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')
    const visitorIP = forwarded ? forwarded.split(',')[0].trim() : null
    if (visitorIP) {
      const { data: ipExclusions } = await supabase
        .from('analytics_exclusions')
        .select('value')
        .eq('type', 'ip')
        .eq('value', visitorIP)
        .limit(1)
      if (ipExclusions && ipExclusions.length > 0) {
        console.log(`[public-lead] Excluded IP detected: ${visitorIP} — skipping lead creation`)
        return new Response(JSON.stringify({ success: true, message: 'Gracias por tu interés. Te contactaremos pronto.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const normalizedPropertyId =
      typeof property_id === 'string' && property_id.trim().length > 0
        ? property_id.trim()
        : null

    // If provided, property_id must be a valid UUID
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (normalizedPropertyId && !UUID_RE.test(normalizedPropertyId)) {
      return new Response(JSON.stringify({ error: 'La propiedad indicada no es válida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let prop: {
      id: string
      title: string | null
      price: number | null
      city: string | null
      province: string | null
      property_type: string | null
      operation: string | null
      bedrooms: number | null
      bathrooms: number | null
      surface_area: number | null
      agent_id: string | null
    } | null = null

    if (normalizedPropertyId) {
      const { data: propertyData, error: propError } = await supabase
        .from('properties')
        .select('id, title, price, city, province, property_type, operation, bedrooms, bathrooms, surface_area, agent_id')
        .eq('id', normalizedPropertyId)
        .single()

      if (propError || !propertyData) {
        return new Response(JSON.stringify({ error: 'Propiedad no encontrada' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      prop = propertyData
    }

    // Normalize optional intent metadata (do not fail if missing)
    const safeMetadata = rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
      ? {
          score: Number.isFinite(rawMetadata.score) ? Math.round(Number(rawMetadata.score)) : null,
          stage: typeof rawMetadata.stage === 'string' ? rawMetadata.stage.slice(0, 32) : null,
          topAreaSlug: typeof rawMetadata.topAreaSlug === 'string' ? rawMetadata.topAreaSlug.slice(0, 128) : null,
          topTopic: typeof rawMetadata.topTopic === 'string' ? rawMetadata.topTopic.slice(0, 128) : null,
          topCities: Array.isArray(rawMetadata.topCities)
            ? rawMetadata.topCities.filter((c: unknown): c is string => typeof c === 'string').map((c) => c.slice(0, 64)).slice(0, 10)
            : null,
          recentPropertyIds: Array.isArray(rawMetadata.recentPropertyIds)
            ? rawMetadata.recentPropertyIds.filter((id: unknown): id is string => typeof id === 'string').map((id) => id.slice(0, 64)).slice(0, 10)
            : null,
        }
      : null

    // Build notes from message and property interest (strip HTML tags for safety)
    const safeMessage = message
      ? String(message).replace(/<[^>]*>/g, '').trim().substring(0, 1000)
      : null
    const notesParts: string[] = []
    if (safeMessage) notesParts.push(`Mensaje: ${safeMessage}`)
    if (prop) {
      notesParts.push(`Propiedad de interés: ${prop.title} (${prop.id})`)
      if (prop.price) notesParts.push(`Precio: ${prop.price.toLocaleString('es-ES')} €`)
      if (prop.city) notesParts.push(`Ciudad: ${prop.city}`)
    } else {
      notesParts.push('Consulta general desde Legado Colección')
    }
    notesParts.push(`Origen: Legado Colección`)
    notesParts.push(`Fecha: ${new Date().toISOString()}`)

    // Create contact with GDPR consent data
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        full_name: full_name.trim().substring(0, 100),
        email: email ? email.trim().substring(0, 255) : null,
        phone: phone ? String(phone).trim().substring(0, 20) : null,
        contact_type: 'comprador',
        status: 'nuevo',
        pipeline_stage: 'nuevo',
        notes: notesParts.join('\n'),
        tags: prop ? ['web-lead', 'legadocoleccion'] : ['web-lead', 'legadocoleccion', 'general-web-lead'],
        agent_id: prop?.agent_id || null,
        // Buyer intent metadata (optional)
        buyer_intent: safeMetadata,
        intent_score: safeMetadata?.score ?? null,
        intent_stage: safeMetadata?.stage ?? null,
        intent_top_area_slug: safeMetadata?.topAreaSlug ?? null,
        intent_top_topic: safeMetadata?.topTopic ?? null,
        // RGPD fields
        gdpr_consent: true,
        gdpr_consent_at: new Date().toISOString(),
        gdpr_consent_ip: visitorIP,
        gdpr_legal_basis: 'explicit_consent',
      })
      .select('id')
      .single()

    if (contactError) {
      console.error('Contact creation error:', contactError)
      throw contactError
    }

    const interactionDescription = prop
      ? safeMessage
        ? `Interesado en: ${prop.title}. Mensaje: ${safeMessage.substring(0, 500)}`
        : `Interesado en: ${prop.title}`
      : safeMessage
        ? `Lead general desde web. Mensaje: ${safeMessage.substring(0, 500)}`
        : 'Lead general desde web'

    await supabase.from('interactions').insert({
      contact_id: contact.id,
      property_id: prop?.id || null,
      agent_id: prop?.agent_id || null,
      interaction_type: 'nota',
      subject: prop ? 'Lead desde web' : 'Lead general desde web',
      description: interactionDescription,
    })

    if (prop) {
      const minPrice = prop.price ? Math.round(prop.price * 0.75) : null
      const maxPrice = prop.price ? Math.round(prop.price * 1.25) : null
      const cities = prop.city ? [prop.city] : []

      await supabase.from('demands').insert({
        contact_id: contact.id,
        property_type: prop.property_type || null,
        operation: prop.operation || 'venta',
        min_price: minPrice,
        max_price: maxPrice,
        cities,
        min_bedrooms: prop.bedrooms && prop.bedrooms > 0 ? Math.max(prop.bedrooms - 1, 1) : null,
        min_bathrooms: prop.bathrooms && prop.bathrooms > 0 ? prop.bathrooms : null,
        min_surface: prop.surface_area ? Math.round(prop.surface_area * 0.8) : null,
        notes: `Demanda auto-generada desde lead web (legadocoleccion). Interesado en: ${prop.title}, ${prop.city || 'zona no especificada'}, ${prop.price ? prop.price.toLocaleString('es-ES') + ' €' : 'precio no indicado'}`,
        auto_match: true,
        is_active: true,
      })
    }

    console.log(
      prop
        ? `Lead created: contact ${contact.id} → property ${normalizedPropertyId} (${prop.title})`
        : `General lead created: contact ${contact.id}`
    )

    // Send push notification to the assigned agent
    if (prop?.agent_id) {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            agent_id: prop.agent_id,
            title: '🔔 Nuevo lead desde web',
            body: `${full_name.trim()} está interesado en ${prop.title}`,
            data: { table: 'contacts', id: contact.id, property_id: prop.id },
          }),
        })
      } catch (pushErr) {
        console.warn('[Push] Failed to send push notification:', pushErr)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Gracias por tu interés. Te contactaremos pronto.',
      contact_id: contact?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Lead error:', err)
    return new Response(JSON.stringify({ error: 'Error al procesar tu solicitud. Inténtalo de nuevo.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
