import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveAssignedAgentId } from '../_shared/agent-assignment.ts'
import { sendPropertyInterestOpener } from '../_shared/match-whatsapp.ts'
import { resolveContactLanguage } from '../_shared/contact-language.ts'
import {
  buildPublicLeadNotes,
  buildPublicLeadTags,
  resolvePublicLeadContactSemantics,
  resolvePublicLeadKind,
  resolvePublicLeadSource,
} from '../_shared/public-lead.ts'

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
    const sourceKeyRaw = typeof body?.source_key === 'string' ? body.source_key.trim().toLowerCase() : ''
    const sourceLabelRaw = typeof body?.source_label === 'string' ? body.source_label.trim() : ''
    const leadKindRaw = typeof body?.lead_kind === 'string' ? body.lead_kind.trim().toLowerCase() : ''
    const requestedContactType = typeof body?.contact_type === 'string' ? body.contact_type.trim().toLowerCase() : ''
    const leadContract = body?.lead_contract && typeof body.lead_contract === 'object' && !Array.isArray(body.lead_contract)
      ? body.lead_contract
      : null
    const sellerContext = body?.seller_context && typeof body.seller_context === 'object' && !Array.isArray(body.seller_context)
      ? body.seller_context
      : null

    const leadContractSourceRaw = typeof leadContract?.source_site === 'string'
      ? leadContract.source_site.trim().toLowerCase()
      : ''
    const { sourceTag, sourceLabel } = resolvePublicLeadSource(sourceKeyRaw, leadContractSourceRaw, sourceLabelRaw)
    const leadKind = resolvePublicLeadKind(leadKindRaw, Boolean(property_id))
    const { contactType, defaultPipelineStage } = resolvePublicLeadContactSemantics(requestedContactType, leadKind)

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
    const safeSellerContext = sellerContext
      ? {
          ownerProfile: typeof sellerContext.owner_profile === 'string' ? sellerContext.owner_profile.slice(0, 64) : null,
          propertyLocation: typeof sellerContext.property_location === 'string' ? sellerContext.property_location.slice(0, 255) : null,
          propertyType: typeof sellerContext.property_type === 'string' ? sellerContext.property_type.slice(0, 64) : null,
          sourceSection: typeof sellerContext.source_section === 'string' ? sellerContext.source_section.slice(0, 64) : null,
        }
      : null
    const safeLeadContract = leadContract
      ? {
          source_site: typeof leadContract.source_site === 'string' ? leadContract.source_site.slice(0, 64) : null,
          source_type: typeof leadContract.source_type === 'string' ? leadContract.source_type.slice(0, 32) : null,
          source_page: typeof leadContract.source_page === 'string' ? leadContract.source_page.slice(0, 128) : null,
          source_url: typeof leadContract.source_url === 'string' ? leadContract.source_url.slice(0, 500) : null,
          target_asset: typeof leadContract.target_asset === 'string' ? leadContract.target_asset.slice(0, 64) : null,
          journey: typeof leadContract.journey === 'string' ? leadContract.journey.slice(0, 32) : null,
          lead_intent: typeof leadContract.lead_intent === 'string' ? leadContract.lead_intent.slice(0, 32) : null,
          persona: typeof leadContract.persona === 'string' ? leadContract.persona.slice(0, 32) : null,
          language: typeof leadContract.language === 'string' ? leadContract.language.slice(0, 8) : null,
          municipality: typeof leadContract.municipality === 'string' ? leadContract.municipality.slice(0, 64) : null,
          region: typeof leadContract.region === 'string' ? leadContract.region.slice(0, 64) : null,
          referrer: typeof leadContract.referrer === 'string' ? leadContract.referrer.slice(0, 500) : null,
          utm_source: typeof leadContract.utm_source === 'string' ? leadContract.utm_source.slice(0, 128) : null,
          utm_medium: typeof leadContract.utm_medium === 'string' ? leadContract.utm_medium.slice(0, 128) : null,
          utm_campaign: typeof leadContract.utm_campaign === 'string' ? leadContract.utm_campaign.slice(0, 128) : null,
          utm_content: typeof leadContract.utm_content === 'string' ? leadContract.utm_content.slice(0, 128) : null,
          utm_term: typeof leadContract.utm_term === 'string' ? leadContract.utm_term.slice(0, 128) : null,
          content_cluster: typeof leadContract.content_cluster === 'string' ? leadContract.content_cluster.slice(0, 128) : null,
          entry_topic: typeof leadContract.entry_topic === 'string' ? leadContract.entry_topic.slice(0, 128) : null,
          cross_interest: typeof leadContract.cross_interest === 'string' ? leadContract.cross_interest.slice(0, 128) : null,
        }
      : null
    const notesParts = buildPublicLeadNotes({
      safeMessage,
      property: prop
        ? {
            id: prop.id,
            title: prop.title,
            price: prop.price,
            city: prop.city,
          }
        : null,
      leadKind,
      sourceLabel,
      leadContract: safeLeadContract,
      sellerContext: safeSellerContext,
      nowIso: new Date().toISOString(),
    })
    const preferredLanguage = resolveContactLanguage(
      safeLeadContract?.language || null,
      safeMessage,
      sourceLabel,
      prop?.title || null,
      notesParts.join(' ')
    )

    const baseTags = buildPublicLeadTags({
      sourceTag,
      leadKind,
      leadContract: safeLeadContract,
      sellerContext: safeSellerContext,
      hasProperty: Boolean(prop),
    })

    const assignedAgentId = await resolveAssignedAgentId(supabase, prop?.agent_id || null)

    // Create contact with GDPR consent data
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        full_name: full_name.trim().substring(0, 100),
        email: email ? email.trim().substring(0, 255) : null,
        phone: phone ? String(phone).trim().substring(0, 20) : null,
        contact_type: contactType,
        status: 'nuevo',
        pipeline_stage: defaultPipelineStage,
        city: safeLeadContract?.municipality || null,
        preferred_language: preferredLanguage,
        notes: notesParts.join('\n'),
        tags: baseTags,
        agent_id: assignedAgentId,
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
        source_ref: safeLeadContract?.source_page || safeSellerContext?.sourceSection || sourceLabel,
        source_url: safeLeadContract?.source_url || null,
      })
      .select('id, full_name, phone')
      .single()

    if (contactError) {
      console.error('Contact creation error:', contactError)
      throw contactError
    }

    const interactionDescription = prop
      ? safeMessage
        ? `Interesado en: ${prop.title}. Mensaje: ${safeMessage.substring(0, 500)}`
        : `Interesado en: ${prop.title}`
      : leadKind === 'seller-inquiry'
        ? safeMessage
          ? `Captación de propietario desde web. Mensaje: ${safeMessage.substring(0, 500)}`
          : 'Captación de propietario desde web'
      : safeMessage
        ? `Lead general desde web. Mensaje: ${safeMessage.substring(0, 500)}`
        : 'Lead general desde web'

    await supabase.from('interactions').insert({
      contact_id: contact.id,
      property_id: prop?.id || null,
      agent_id: assignedAgentId,
      interaction_type: 'nota',
      subject: prop ? 'Lead desde web' : leadKind === 'seller-inquiry' ? 'Captación vendedor desde web' : 'Lead general desde web',
      description: interactionDescription,
    })

    let demandId: string | null = null

    if (prop) {
      const minPrice = prop.price ? Math.round(prop.price * 0.75) : null
      const maxPrice = prop.price ? Math.round(prop.price * 1.25) : null
      const cities = prop.city ? [prop.city] : []

      const { data: insertedDemand, error: demandError } = await supabase.from('demands').insert({
        contact_id: contact.id,
        property_type: prop.property_type || null,
        operation: prop.operation || 'venta',
        min_price: minPrice,
        max_price: maxPrice,
        cities,
        min_bedrooms: prop.bedrooms && prop.bedrooms > 0 ? Math.max(prop.bedrooms - 1, 1) : null,
        min_bathrooms: prop.bathrooms && prop.bathrooms > 0 ? prop.bathrooms : null,
        min_surface: prop.surface_area ? Math.round(prop.surface_area * 0.8) : null,
        notes: `Demanda auto-generada desde lead web (${sourceTag}). Interesado en: ${prop.title}, ${prop.city || 'zona no especificada'}, ${prop.price ? prop.price.toLocaleString('es-ES') + ' €' : 'precio no indicado'}`,
        auto_match: true,
        is_active: true,
      }).select('id').single()
      if (demandError) throw demandError
      demandId = insertedDemand.id

      await sendPropertyInterestOpener({
        supabase,
        contact: {
          id: contact.id,
          full_name: contact.full_name,
          phone: contact.phone,
          agent_id: assignedAgentId,
          gdpr_consent: true,
        },
        property: prop,
        demandId,
        source: 'public-lead',
        preferredLanguage: safeLeadContract?.language || null,
        languageSamples: [safeMessage, sourceLabel, prop.title, notesParts.join(' ')],
      })
    }

    console.log(
      prop
        ? `Lead created: contact ${contact.id} → property ${normalizedPropertyId} (${prop.title})`
        : `General lead created: contact ${contact.id}`
    )

    // Send push notification to the assigned agent
    if (assignedAgentId) {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            agent_id: assignedAgentId,
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
      demand_id: demandId,
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
