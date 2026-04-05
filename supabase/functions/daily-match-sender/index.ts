import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { expandCityRadius, normalizeCityName } from '../_shared/geo-coords.ts'
import {
  bedroomMatches,
  MATCHING_PILLARS,
  operationMatches,
  propertyTypeMatches,
  scoreBedroomFit,
  scoreBudgetFit,
} from '../_shared/matching.ts'
import { sendMessage } from '../_shared/send-message.ts'
import { isAutomationOutboundEnabled } from '../_shared/automation-outbound.ts'

// ─── WhatsApp compliance: rate limits & messaging rules ───
const WA_MAX_PER_DAY = 12
const WA_DELAY_MIN_MS = 120_000  // 2 minutes minimum
const WA_DELAY_MAX_MS = 300_000  // 5 minutes maximum
const WA_RETRY_AFTER_DAYS = 7
const WA_MAX_OPENER_ATTEMPTS = 3
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const randomDelay = () => WA_DELAY_MIN_MS + Math.random() * (WA_DELAY_MAX_MS - WA_DELAY_MIN_MS)

interface MatchSenderProperty {
  id: string
  title: string | null
  city: string | null
  province: string | null
  zone: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  surface_area: number | null
  property_type: string | null
  operation: string | null
  images: string[] | null
  description: string | null
  image_order: unknown
}

interface MatchSenderContact {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  agent_id: string | null
  gdpr_consent: boolean | null
  opt_out?: boolean | null
  tags: string[] | null
}

interface MatchSenderDemand {
  id: string
  contacts: MatchSenderContact | null
  cities: string[] | null
  zones: string[] | null
  min_price: number | null
  max_price: number | null
  property_type: string | null
  property_types: string[] | null
  operation: string | null
  min_bedrooms: number | null
  min_surface: number | null
}

interface MatchConfigValue {
  price_margin?: number | string
  radius_km?: number | string
}

interface MatchSenderLogRow {
  contact_id: string
  property_id: string | null
  direction: string
  channel: string
  source: string | null
  created_at: string
  metadata: {
    match_whatsapp_stage?: string
    opener_attempt?: number | string
  } | null
}

function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/wa\.me\/\S+/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildPropertyUrl(prop: Pick<MatchSenderProperty, 'id' | 'title' | 'city' | 'province'>): string {
  const titleSlug = slugify(prop.title || 'propiedad')
  const citySlug = slugify(prop.city || prop.province || '')
  const uuidSuffix = String(prop.id || '').replace(/-/g, '').slice(-5)
  const propertySlug = citySlug
    ? `${titleSlug}-${citySlug}-${uuidSuffix}`
    : `${titleSlug}-${uuidSuffix}`

  return `https://legadocoleccion.es/propiedad/${propertySlug}`
}

function isRetryWindowOpen(sentAt: string | null | undefined): boolean {
  if (!sentAt) return false
  const sentTime = new Date(sentAt).getTime()
  if (Number.isNaN(sentTime)) return false
  const elapsedMs = Date.now() - sentTime
  return elapsedMs >= WA_RETRY_AFTER_DAYS * 24 * 60 * 60 * 1000
}

function addDaysIso(baseDate: string, days: number): string {
  const d = new Date(baseDate)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

// ─── Alicia: cercana, natural y con pie a respuesta ───
function buildWhatsAppOpener(contactName: string): string {
  const greeting = contactName
    ? `Hola ${contactName}, soy Alicia, de Legado.`
    : 'Hola, soy Alicia, de Legado.'

  return `${greeting} Me acaba de entrar una vivienda que podría cuadrarte bastante. Si quieres, te cuento un poco y me dices qué te parece.`
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
    const automationEnabled = await isAutomationOutboundEnabled()
    if (!automationEnabled) {
      return json({ message: 'Automatizacion saliente desactivada', automation_enabled: false })
    }

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
    const matchConfig = matchConfigRow?.value as MatchConfigValue | null
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
    const groupedByContact = new Map<string, MatchSenderDemand[]>()
    for (const demand of demands as MatchSenderDemand[]) {
      const contact = demand.contacts
      if (!contact) continue
      const cId = contact.id
      if (!groupedByContact.has(cId)) groupedByContact.set(cId, [])
      groupedByContact.get(cId)!.push(demand)
    }

    // 4. Load ALL existing matches for relevant demand IDs
    const demandIds = demands.map(d => d.id)
    const contactPropertySet = new Set<string>()
    const sentSet = new Set<string>()
    const openerByContactProperty = new Map<string, { created_at: string; attempts: number }>()
    const followUpSet = new Set<string>()
    const latestInboundByContact = new Map<string, string>()

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
        const ownerContact = ownerDemand?.contacts
        if (ownerContact) {
          contactPropertySet.add(`${ownerContact.id}_${m.property_id}`)
        }
      }

      if (batch.length < pageSize) break
      offset += pageSize
    }

    // 4b. Load communication history needed for WhatsApp retry logic
    const contactIds = [...groupedByContact.keys()]
    if (contactIds.length > 0) {
      let commOffset = 0
      while (true) {
        const { data: commBatch } = await supabase
          .from('communication_logs')
          .select('contact_id, property_id, direction, channel, source, created_at, metadata')
          .in('contact_id', contactIds)
          .eq('channel', 'whatsapp')
          .range(commOffset, commOffset + pageSize - 1)

        if (!commBatch || commBatch.length === 0) break

        for (const logEntry of commBatch as MatchSenderLogRow[]) {
          const contactId = logEntry.contact_id
          const propertyId = logEntry.property_id
          const key = propertyId ? `${contactId}_${propertyId}` : null

          if (logEntry.direction === 'inbound') {
            const prev = latestInboundByContact.get(contactId)
            if (!prev || new Date(logEntry.created_at).getTime() > new Date(prev).getTime()) {
              latestInboundByContact.set(contactId, logEntry.created_at)
            }
            continue
          }

          if (!key) continue

          if (logEntry.source === 'cruces_followup') {
            followUpSet.add(key)
            continue
          }

          if (logEntry.source !== 'cruces') continue

          const stage = logEntry.metadata?.match_whatsapp_stage || 'opener'
          if (stage !== 'opener') continue

          const current = openerByContactProperty.get(key)
          const currentAttempts = Number(logEntry.metadata?.opener_attempt || 1)
          if (!current || new Date(logEntry.created_at).getTime() > new Date(current.created_at).getTime()) {
            openerByContactProperty.set(key, {
              created_at: logEntry.created_at,
              attempts: Number.isFinite(currentAttempts) && currentAttempts > 0 ? currentAttempts : 1,
            })
          }
        }

        if (commBatch.length < pageSize) break
        commOffset += pageSize
      }
    }

    // 5. Process per contact
    let waSentThisRun = 0

    for (const [contactId, contactDemands] of groupedByContact) {

      const contact = contactDemands[0].contacts
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

      let bestCandidate: { prop: MatchSenderProperty; demand: MatchSenderDemand; score: number } | null = null
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
          const contactPropertyKey = `${contactId}_${prop.id}`
          const demandPropertyKey = `${demand.id}_${prop.id}`
          const priorOpener = openerByContactProperty.get(contactPropertyKey)
          const latestInboundAt = latestInboundByContact.get(contactId)
          const hasInboundAfterOpener = Boolean(
            priorOpener &&
            latestInboundAt &&
            new Date(latestInboundAt).getTime() > new Date(priorOpener.created_at).getTime()
          )
          const retryEligible = Boolean(
            channel === 'whatsapp' &&
            priorOpener &&
            priorOpener.attempts < WA_MAX_OPENER_ATTEMPTS &&
            !followUpSet.has(contactPropertyKey) &&
            !hasInboundAfterOpener &&
            isRetryWindowOpen(priorOpener.created_at)
          )

          if (!retryEligible && contactPropertySet.has(contactPropertyKey)) { skippedAlreadySent++; continue }
          if (!retryEligible && sentSet.has(demandPropertyKey)) { skippedAlreadySent++; continue }

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

          const budget = scoreBudgetFit(demand.min_price, demand.max_price, prop.price, priceMarginPct)
          if (!budget.ok) continue

          if (!propertyTypeMatches(demand.property_type, demand.property_types, prop.property_type)) continue
          if (!operationMatches(demand.operation, prop.operation)) continue
          if (!bedroomMatches(demand.min_bedrooms, prop.bedrooms)) continue
          if (demand.min_surface && prop.surface_area && Number(prop.surface_area) < Number(demand.min_surface)) continue

          let score = 0
          score += Math.round(MATCHING_PILLARS.budget * budget.score)

          if (demand.min_bedrooms && prop.bedrooms) {
            score += Math.round(MATCHING_PILLARS.bedrooms * scoreBedroomFit(demand.min_bedrooms, prop.bedrooms))
          }

          if (propertyTypeMatches(demand.property_type, demand.property_types, prop.property_type)) {
            score += MATCHING_PILLARS.propertyFamily
          }

          if (operationMatches(demand.operation, prop.operation)) {
            score += MATCHING_PILLARS.operation
          }

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

      const propertyUrl = buildPropertyUrl(bestProp)
      const priorOpener = openerByContactProperty.get(`${contactId}_${bestProp.id}`)
      const openerAttempt = priorOpener ? priorOpener.attempts + 1 : 1
      const sentAtIso = new Date().toISOString()
      const nextRetryAt = channel === 'whatsapp' && openerAttempt < WA_MAX_OPENER_ATTEMPTS
        ? addDaysIso(sentAtIso, WA_RETRY_AFTER_DAYS)
        : null

      // Build messages — WhatsApp uses conversational opener (NO links)
      const whatsappMsg = stripUrls(buildWhatsAppOpener(contactName))

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
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Send failed'
        sendError = message
        if (channel === 'whatsapp') log.whatsapp_failed++
        else log.emails_failed++
        log.errors.push(`${channel} ${contact.phone || contact.email}: ${message}`)
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

      const matchStatus = channel === 'whatsapp'
        ? 'pendiente'
        : sendOk
          ? 'enviado'
          : 'pendiente'

      // Create match record
      await supabase.from('matches').upsert(
        {
          demand_id: bestDemand.id,
          property_id: bestProp.id,
          compatibility: 80,
          status: matchStatus,
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
        interaction_type: interactionType,
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
        metadata: channel === 'whatsapp'
          ? {
              match_whatsapp_stage: 'opener',
              property_url: propertyUrl,
              opener_attempt: openerAttempt,
              max_opener_attempts: WA_MAX_OPENER_ATTEMPTS,
              pending_response: true,
              next_retry_at: nextRetryAt,
              retries_remaining: Math.max(0, WA_MAX_OPENER_ATTEMPTS - openerAttempt),
            }
          : { property_url: propertyUrl },
      })

      contactPropertySet.add(`${contactId}_${bestProp.id}`)
      sentSet.add(`${bestDemand.id}_${bestProp.id}`)
      if (channel === 'whatsapp') {
        openerByContactProperty.set(`${contactId}_${bestProp.id}`, {
          created_at: sentAtIso,
          attempts: openerAttempt,
        })
      }
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

function buildEmailHtml(contactName: string, prop: MatchSenderProperty, price: string, propertyUrl: string): string {
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
