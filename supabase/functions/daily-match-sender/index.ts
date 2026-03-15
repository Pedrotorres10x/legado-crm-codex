import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { expandCityRadius, normalizeCityName } from '../_shared/geo-coords.ts'
import { sendMessage } from '../_shared/send-message.ts'

// ─── WhatsApp compliance: rate limits & messaging rules ───
const WA_MAX_PER_DAY = 12
const WA_DELAY_MIN_MS = 120_000  // 2 minutes minimum
const WA_DELAY_MAX_MS = 300_000  // 5 minutes maximum
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const randomDelay = () => WA_DELAY_MIN_MS + Math.random() * (WA_DELAY_MAX_MS - WA_DELAY_MIN_MS)

// ─── Alicia: amiga experta, cero comercial, cercana y natural ───
function buildWhatsAppOpener(contactName: string, prop: any, price: string): string {
  const name = contactName ? ` ${contactName}` : ''
  const city = prop.city || prop.province || 'tu zona'
  const type = prop.property_type || 'vivienda'

  const templates = [
    `Hola${name} 👋 Soy Alicia, de Legado Inmobiliaria. He visto un ${type} en ${city} por ${price} y me ha recordado a lo que buscas. ¿Te cuento un poco más? Sin compromiso 🙂`,

    `Hola${name}! Te escribo porque ha salido un ${type} en ${city} (${price}) que creo que te puede encajar. Si te apetece que te pase los detalles, me dices. Sin agobios 😊`,

    `Buenas${name} 🙂 Soy Alicia. Ha aparecido un ${type} interesante en ${city} a ${price} y he pensado en ti. ¿Quieres que te cuente? Solo si te viene bien, claro.`,

    `Hola${name}, soy Alicia de Legado. Me ha llegado un ${type} en ${city} por ${price} que encaja bastante con lo que buscas. ¿Te apetece que te dé más info o prefieres que no te moleste? 🙂`,

    `Hola${name} 👋 Ha salido algo en ${city} que creo que merece la pena que veas — un ${type} a ${price}. ¿Te paso los detalles por aquí? Soy Alicia, de Legado 🙂`,
  ]

  return templates[Math.floor(Math.random() * templates.length)]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  const log = {
    demands_total: 0,
    contacts_processed: 0,
    contacts_skipped: 0,
    emails_sent: 0,
    emails_failed: 0,
    whatsapp_sent: 0,
    whatsapp_failed: 0,
    matches_created: 0,
    matches_skipped_already_sent: 0,
    errors: [] as string[],
    duration_ms: 0,
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ─── Kill switch: check if engine is enabled ───
    const { data: enabledRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'match_sender_enabled')
      .maybeSingle()
    const isEnabled = enabledRow?.value === true || enabledRow?.value === 'true'
    if (!isEnabled) {
      console.log('Motor de cruces DESACTIVADO (match_sender_enabled = false). Saliendo.')
      return json({ message: 'Motor desactivado por configuración', enabled: false })
    }

    // No external dependencies needed — uses local sendMessage helper

    const saveLog = async () => {
      log.duration_ms = Date.now() - startTime
      await supabase.from('match_sender_logs').insert([log])
    }

    // Load configurable price margin from settings
    const { data: matchConfigRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'match_config')
      .maybeSingle()
    const matchConfig = matchConfigRow?.value as any
    const priceMarginPct = matchConfig?.price_margin
      ? Number(matchConfig.price_margin) / 100
      : 0.25
    const radiusKm = matchConfig?.radius_km ? Number(matchConfig.radius_km) : 20

    // 1. Get all active demands with auto_match + contact data
    const { data: demands } = await supabase
      .from('demands')
      .select('*, contacts(id, full_name, email, phone, agent_id, gdpr_consent, tags)')
      .eq('is_active', true)
      .eq('auto_match', true)

    if (!demands || demands.length === 0) {
      await saveLog()
      return json({ message: 'No active demands', sent: 0 })
    }

    log.demands_total = demands.length

    // 2. Get all available properties
    const { data: allProperties } = await supabase
      .from('properties')
      .select('id, title, city, province, zone, price, bedrooms, bathrooms, surface_area, property_type, operation, images, description, image_order')
      .eq('status', 'disponible')
      .eq('auto_match', true)

    if (!allProperties || allProperties.length === 0) {
      await saveLog()
      return json({ message: 'No available properties', sent: 0 })
    }

    // 3. Group demands by contact_id
    const groupedByContact = new Map<string, typeof demands>()
    for (const demand of demands) {
      const contact = demand.contacts as any
      if (!contact) continue
      const cId = contact.id as string
      if (!groupedByContact.has(cId)) groupedByContact.set(cId, [])
      groupedByContact.get(cId)!.push(demand)
    }

    // 4. Load ALL existing matches for relevant demand IDs
    const demandIds = demands.map(d => d.id)
    const contactPropertySet = new Set<string>()
    const sentSet = new Set<string>()

    let offset = 0
    const pageSize = 1000
    while (true) {
      const { data: batch } = await supabase
        .from('matches')
        .select('demand_id, property_id')
        .in('demand_id', demandIds)
        .range(offset, offset + pageSize - 1)

      if (!batch || batch.length === 0) break

      for (const m of batch) {
        sentSet.add(`${m.demand_id}_${m.property_id}`)
        const ownerDemand = demands.find(d => d.id === m.demand_id)
        const ownerContact = ownerDemand?.contacts as any
        if (ownerContact) {
          contactPropertySet.add(`${ownerContact.id}_${m.property_id}`)
        }
      }

      if (batch.length < pageSize) break
      offset += pageSize
    }

    // 5. Process per contact
    let waSentThisRun = 0

    for (const [contactId, contactDemands] of groupedByContact) {

      const contact = (contactDemands[0].contacts as any)
      if (!contact) { log.contacts_skipped++; continue }

      // Skip contacts without GDPR consent (must have voluntarily left their number)
      if (!contact.gdpr_consent) { log.contacts_skipped++; continue }

      // Skip contacts tagged as "nevera" (frozen)
      const contactTags: string[] = contact.tags || []
      if (contactTags.includes('nevera')) { log.contacts_skipped++; continue }

      // Skip opt-out contacts
      if (contact.opt_out) { log.contacts_skipped++; continue }

      // Determine exclusive channel: WhatsApp first, email fallback
      const channel: 'whatsapp' | 'email' | null = contact.phone ? 'whatsapp' : contact.email ? 'email' : null
      if (!channel) { log.contacts_skipped++; continue }

      // ─── WhatsApp daily cap ───
      if (channel === 'whatsapp' && waSentThisRun >= WA_MAX_PER_DAY) {
        log.contacts_skipped++
        continue
      }

      let bestCandidate: { prop: any; demand: any; score: number } | null = null
      let skippedAlreadySent = 0

      for (const demand of contactDemands) {
        // Parse demand cities — handle `::` separated values and expand by radius
        const rawCities = (demand.cities || []).flatMap((c: string) =>
          c.includes('::') ? c.split('::') : [c]
        )
        const demandCitiesExpanded = new Set<string>()
        for (const c of rawCities) {
          const expanded = expandCityRadius(c.trim(), radiusKm)
          for (const e of expanded) demandCitiesExpanded.add(e)
        }
        const demandCities = [...demandCitiesExpanded]

        const demandZones = (demand.zones || []).map((z: string) => z.toLowerCase().trim())

        // Skip demands without any geographic criteria
        if (demandCities.length === 0 && demandZones.length === 0) continue

        for (const prop of allProperties) {
          if (contactPropertySet.has(`${contactId}_${prop.id}`)) { skippedAlreadySent++; continue }
          if (sentSet.has(`${demand.id}_${prop.id}`)) { skippedAlreadySent++; continue }

          const propCityNorm = normalizeCityName(prop.city || '')
          const propProvince = (prop.province || '').toLowerCase().trim()
          const propZone = (prop.zone || '').toLowerCase().trim()

          if (demandCities.length > 0 || demandZones.length > 0) {
            // Exact normalised city match (expanded by radius)
            const cityMatch = demandCities.length > 0 && propCityNorm && demandCities.includes(propCityNorm)
            const zoneMatch = demandZones.length > 0 && (
              (propZone && demandZones.some((z: string) => propZone === z || propZone.includes(z) || z.includes(propZone))) ||
              (propCityNorm && demandZones.some((z: string) => propCityNorm.includes(z) || z.includes(propCityNorm))) ||
              (propProvince && demandZones.some((z: string) => propProvince.includes(z) || z.includes(propProvince)))
            )
            if (!cityMatch && !zoneMatch) continue
          }

          if (demand.max_price && prop.price) {
            if (Number(prop.price) > Number(demand.max_price) * (1 + priceMarginPct)) continue
          }
          if (demand.min_price && prop.price) {
            if (Number(prop.price) < Number(demand.min_price) * (1 - priceMarginPct)) continue
          }

          if (demand.property_type && prop.property_type && demand.property_type !== prop.property_type) continue
          if (demand.operation && prop.operation && demand.operation !== prop.operation && demand.operation !== 'ambas') continue
          if (demand.min_bedrooms && prop.bedrooms && prop.bedrooms < demand.min_bedrooms) continue
          if (demand.min_surface && prop.surface_area && Number(prop.surface_area) < Number(demand.min_surface)) continue

          let score = 0
          if (demand.max_price && prop.price && Number(prop.price) <= Number(demand.max_price)) score += 10
          if (demand.min_bedrooms && prop.bedrooms && prop.bedrooms >= demand.min_bedrooms) score += 5

          if (!bestCandidate || score > bestCandidate.score) {
            bestCandidate = { prop, demand, score }
          }
        }
      }

      log.matches_skipped_already_sent += skippedAlreadySent

      if (!bestCandidate) { log.contacts_skipped++; continue }

      log.contacts_processed++
      const bestProp = bestCandidate.prop
      const bestDemand = bestCandidate.demand
      const rawName = contact.full_name?.split(' ')[0] || ''
      const invalidNames = ['sin', 'asignar', 'no', 'desconocido', 'unknown', 'test', 'prueba', 'null', 'undefined', 'n/a', 'na', 'ninguno', 'pendiente']
      const contactName = (rawName && rawName.length > 1 && !/^\d/.test(rawName) && !contact.email?.toLowerCase().startsWith(rawName.toLowerCase()) && !invalidNames.includes(rawName.toLowerCase()) && !(contact.full_name || '').toLowerCase().includes('sin asignar')) ? rawName : ''
      const price = bestProp.price ? `${Number(bestProp.price).toLocaleString('es-ES')} €` : 'Consultar'

      // Build property link with OG-friendly slug
      const propertyUrl = buildPropertyUrl(bestProp)

      // Build messages — WhatsApp uses conversational opener (NO links)
      const whatsappMsg = buildWhatsAppOpener(contactName, bestProp, price)

      const emailSubject = `${bestProp.title} — ${bestProp.city || 'Nueva propiedad'} · Legado Colección`
      const htmlContent = buildEmailHtml(contactName, bestProp, price, propertyUrl)

      // ─── WhatsApp: delay between sends for compliance ───
      if (channel === 'whatsapp' && waSentThisRun > 0) {
        const delayMs = randomDelay()
        console.log(`WhatsApp compliance delay: ${Math.round(delayMs / 1000)}s before send #${waSentThisRun + 1}`)
        await sleep(delayMs)
      }

      // ─── Send via EXCLUSIVE channel ───
      let sendOk = false
      let sendError: string | null = null

      try {
        const destination = channel === 'whatsapp' ? contact.phone : contact.email
        const result = await sendMessage({
          channel,
          to: destination,
          contactName: contact.full_name || undefined,
          text: channel === 'whatsapp' ? whatsappMsg : htmlContent,
          subject: channel === 'email' ? emailSubject : undefined,
          html: channel === 'email' ? htmlContent : undefined,
        })

        if (result.ok) {
          sendOk = true
          if (channel === 'whatsapp') { log.whatsapp_sent++; waSentThisRun++ }
          else log.emails_sent++
        } else {
          throw new Error(result.error || 'Send failed')
        }
      } catch (e: any) {
        sendError = e.message
        if (channel === 'whatsapp') log.whatsapp_failed++
        else log.emails_failed++
        log.errors.push(`${channel} ${contact.phone || contact.email}: ${e.message}`)
      }

      // Log in match_emails (for email channel)
      if (channel === 'email') {
        await supabase.from('match_emails').insert({
          contact_id: contact.id,
          property_id: bestProp.id,
          demand_id: bestDemand.id,
          agent_id: contact.agent_id || null,
          email_to: contact.email,
          subject: emailSubject,
          status: sendOk ? 'enviado' : 'error',
          error_message: sendError,
        })
      }

      // Create match record
      await supabase.from('matches').upsert(
        {
          demand_id: bestDemand.id,
          property_id: bestProp.id,
          compatibility: 80,
          status: sendOk ? 'enviado' : 'pendiente',
          agent_id: contact.agent_id || null,
          notes: null,
        },
        { onConflict: 'demand_id,property_id' }
      )
      log.matches_created++

      // Log interaction (timeline)
      const interactionType = channel === 'whatsapp' ? 'whatsapp' : 'email'
      await supabase.from('interactions').insert({
        contact_id: contact.id,
        interaction_type: interactionType as any,
        subject: `Auto-match: ${bestProp.title}`,
        description: `Propiedad enviada automáticamente por ${channel === 'whatsapp' ? 'WhatsApp (Green API)' : 'email (Brevo)'} (campaña: cruces). Ciudad: ${bestProp.city || 'N/A'}, Precio: ${price}. ${sendOk ? 'Enviado OK' : `Error: ${sendError}`}`,
        agent_id: contact.agent_id || null,
      })

      // Log detailed communication
      await supabase.from('communication_logs').insert({
        contact_id: contact.id,
        channel,
        direction: 'outbound',
        source: 'cruces',
        subject: channel === 'email' ? emailSubject : null,
        body_preview: channel === 'whatsapp' ? whatsappMsg.slice(0, 500) : `Propiedad: ${bestProp.title}, ${bestProp.city || ''}, ${price}`,
        html_preview: channel === 'email' ? htmlContent.slice(0, 1000) : null,
        status: sendOk ? 'enviado' : 'error',
        error_message: sendError,
        agent_id: contact.agent_id || null,
        property_id: bestProp.id,
        demand_id: bestDemand.id,
      })

      contactPropertySet.add(`${contactId}_${bestProp.id}`)
      sentSet.add(`${bestDemand.id}_${bestProp.id}`)
    }

    await saveLog()

    // Alert admins if too many errors
    if (log.errors.length > 3) {
      try {
        const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin')
        if (adminRoles && adminRoles.length > 0) {
          for (const admin of adminRoles) {
            await supabase.from('notifications').insert({
              event_type: 'match_sender_errors',
              entity_type: 'system',
              entity_id: 'daily-match-sender',
              title: `⚠️ ${log.errors.length} errores en el motor de cruces`,
              description: `Emails: ${log.emails_sent} ok / ${log.emails_failed} err · WA: ${log.whatsapp_sent} ok / ${log.whatsapp_failed} err. ${log.errors.slice(0, 3).join(' | ')}`,
              agent_id: admin.user_id,
            })
          }
        }
      } catch (alertErr) {
        console.error('Error creating alert notification:', alertErr)
      }
    }

    return json({
      success: true,
      emails_sent: log.emails_sent,
      emails_failed: log.emails_failed,
      whatsapp_sent: log.whatsapp_sent,
      whatsapp_failed: log.whatsapp_failed,
      contacts_processed: log.contacts_processed,
      contacts_skipped: log.contacts_skipped,
      matches_created: log.matches_created,
      matches_skipped_already_sent: log.matches_skipped_already_sent,
      demands_total: log.demands_total,
      duration_ms: log.duration_ms,
      errors: log.errors.length > 0 ? log.errors : undefined,
    })
  } catch (err) {
    console.error('daily-match-sender error:', err)
    log.errors.push(err instanceof Error ? err.message : 'Error desconocido')
    log.duration_ms = Date.now() - startTime
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await supabase.from('match_sender_logs').insert([log])
    } catch { /* ignore */ }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildPropertyUrl(prop: any): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  return `${supabaseUrl}/functions/v1/og-property?id=${prop.id}`
}

function buildEmailHtml(contactName: string, prop: any, price: string, propertyUrl: string): string {
  return `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1a365d;">
        <h1 style="color: #1a365d; margin: 0; font-size: 22px;">Legado Inmobiliaria</h1>
      </div>
      <div style="padding: 24px 0;">
        <p style="font-size: 16px; color: #333;">Hola${contactName ? ` ${contactName}` : ''} 👋</p>
        <p style="font-size: 15px; color: #555;">Soy Alicia, de Legado Inmobiliaria. He visto algo que creo que te puede gustar:</p>
        ${(() => { let cover = prop.images?.[0] || ''; if (prop.image_order?.length > 0 && prop.images?.length > 0) { const e = prop.image_order[0]; const n = typeof e === 'string' ? e : e?.name; if (n?.startsWith('xml_')) { const i = parseInt(n.replace('xml_',''),10); if (!isNaN(i) && i < prop.images.length) cover = prop.images[i]; } else if (n) { cover = prop.images.find((u:string) => u.includes(n)) || cover; } } return cover ? `<a href="${propertyUrl}" target="_blank"><img src="${cover}" alt="${prop.title}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin: 16px 0;" /></a>` : ''; })()}
        <h2 style="color: #1a365d; margin: 12px 0 8px; font-size: 20px;">${prop.title}</h2>
        <table cellpadding="0" cellspacing="0" style="margin: 12px 0;">
          <tr><td style="padding: 4px 16px 4px 0; color: #666; font-size: 14px;">📍 ${prop.city || ''}${prop.province ? `, ${prop.province}` : ''}</td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #1a365d; font-size: 18px; font-weight: 700;">💰 ${price}</td></tr>
          ${prop.bedrooms ? `<tr><td style="padding: 4px 0; color: #666; font-size: 14px;">🛏️ ${prop.bedrooms} habitaciones</td></tr>` : ''}
          ${prop.surface_area ? `<tr><td style="padding: 4px 0; color: #666; font-size: 14px;">📐 ${Number(prop.surface_area)} m²</td></tr>` : ''}
        </table>
        ${prop.description ? `<p style="color: #555; font-size: 14px; line-height: 1.5; margin: 16px 0;">${String(prop.description).substring(0, 300)}${String(prop.description).length > 300 ? '...' : ''}</p>` : ''}
        <div style="text-align: center; margin: 24px 0;">
          <a href="${propertyUrl}" target="_blank" style="display: inline-block; background: #1a365d; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">Ver más detalles →</a>
        </div>
        <p style="margin-top: 16px; font-size: 15px; color: #333;">Si te apetece saber más o quieres visitarla, escríbeme por WhatsApp sin compromiso 🙂</p>
        <div style="text-align: center; margin: 16px 0;">
          <a href="https://wa.me/34602258982?text=${encodeURIComponent(`Hola Alicia, me interesa: ${prop.title} (${prop.city || ''})`)}" target="_blank" style="display: inline-block; background: #25D366; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">💬 Escríbeme por WhatsApp</a>
        </div>
        <div style="background: #f8f9fa; border-radius: 6px; padding: 12px; margin: 16px 0; text-align: center;">
          <p style="color: #888; font-size: 12px; margin: 0;">Este email no admite respuestas. Para hablar conmigo, usa el botón de WhatsApp 😊</p>
        </div>
      </div>
      <div style="border-top: 1px solid #eee; padding: 16px 0; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">Alicia — Legado Inmobiliaria</p>
        <p style="margin: 8px 0 0;">
          <a href="https://wa.me/34602258982?text=${encodeURIComponent('Hola, prefiero no recibir más emails de propiedades.')}" target="_blank" style="color: #999; font-size: 12px; text-decoration: underline;">Darme de baja</a>
        </p>
      </div>
    </div>
  `
}

