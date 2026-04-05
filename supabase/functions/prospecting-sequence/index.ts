import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { sendWhatsApp } from '../_shared/greenapi.ts';
import { isAutomationOutboundEnabled } from '../_shared/automation-outbound.ts';

/**
 * Prospecting sequence engine for seller-side contacts.
 * 4-step WhatsApp sequence to convert prospects into seller clients.
 *
 * Actions:
 *   - enroll: Start a sequence for a contact
 *   - process_pending: Process all pending sequences (called by cron)
 *
 * Step schedule:
 *   0 → Day 0: Conversational intro, NO links
 *   1 → Day 3: Demand data, NO links
 *   2 → Day 7: Valoración link
 *   3 → Day 14: Last touch with link
 */

const STEP_DELAYS_HOURS = [0, 72, 168, 336]; // 0h, 3d, 7d, 14d

interface SequenceRow {
  id: string;
  contact_id: string;
  agent_id: string | null;
  current_step: number;
  metadata: Record<string, unknown>;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'process_pending';
    const automationEnabled = await isAutomationOutboundEnabled();

    if (!automationEnabled) {
      return json({ ok: true, processed: 0, enrolled: false, reason: 'automation_disabled' });
    }

    // ── ENROLL ──────────────────────────────────────────────────────────
    if (action === 'enroll') {
      const { contact_id, agent_id } = body;
      if (!contact_id) return json({ error: 'contact_id required' }, 400);

      // Get contact metadata for message generation
      const { data: contact } = await sb
        .from('contacts')
        .select('full_name, phone, city, notes, source_url, source_ref')
        .eq('id', contact_id)
        .single();

      if (!contact?.phone) return json({ error: 'Contact has no phone' }, 400);

      // Extract zone/area from notes or city
      const zone = contact.city || 'tu zona';
      const metadata = {
        name: contact.full_name?.split(' ')[0] || 'propietario',
        full_name: contact.full_name,
        phone: contact.phone,
        zone,
        source_url: contact.source_url || '',
        source_ref: contact.source_ref || '',
      };

      const { error: insertErr } = await sb.from('prospecting_sequences').upsert({
        contact_id,
        agent_id: agent_id || null,
        current_step: 0,
        next_step_at: new Date().toISOString(),
        metadata,
      }, { onConflict: 'contact_id' });

      if (insertErr) return json({ error: insertErr.message }, 500);
      return json({ ok: true, enrolled: contact_id });
    }

    // ── TEST ALL (send 4 messages immediately) ──────────────────────────
    if (action === 'test_all') {
      const { phone, name, zone } = body;
      if (!phone) return json({ error: 'phone required' }, 400);
      const testName = name || 'amigo';
      const testZone = zone || 'tu zona';
      const valoracionLink = `https://www.legadoinmobiliaria.es`;
      const results: string[] = [];

      for (let step = 0; step < 4; step++) {
        const message = generateMessage(step, testName, testZone, 0, valoracionLink);
        const result = await sendWhatsApp(phone, message);
        results.push(`Step ${step}: ${result.ok ? 'sent' : result.error}`);
        // Small pause between messages (15s)
        if (step < 3) await new Promise(r => setTimeout(r, 3000));
      }

      return json({ ok: true, results });
    }

    // ── PROCESS PENDING ─────────────────────────────────────────────────
    const { data: pending, error: fetchErr } = await sb
      .from('prospecting_sequences')
      .select('id, contact_id, agent_id, current_step, metadata')
      .eq('completed', false)
      .eq('paused', false)
      .eq('replied', false)
      .lte('next_step_at', new Date().toISOString())
      .order('next_step_at', { ascending: true })
      .limit(20);

    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!pending || pending.length === 0) return json({ ok: true, processed: 0 });

    // Count active demands in CRM for social proof
    const { count: totalDemands } = await sb
      .from('demands')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    let processed = 0;
    const errors: string[] = [];

    for (const seq of pending as SequenceRow[]) {
      try {
        // Random delay 2-5 min between sends (simulates human behavior)
        if (processed > 0) {
          const delayMs = (120 + Math.random() * 180) * 1000;
          await new Promise(r => setTimeout(r, delayMs));
        }

        const meta = seq.metadata || {};
        const name = meta.name || 'propietario';
        const zone = meta.zone || 'tu zona';
        const phone = meta.phone;

        if (!phone) {
          errors.push(`${seq.id}: no phone`);
          continue;
        }

        // Get agent info for the link
        let agentSlug = '';
        if (seq.agent_id) {
          const { data: profile } = await sb
            .from('profiles')
            .select('slug')
            .eq('user_id', seq.agent_id)
            .single();
          agentSlug = profile?.slug || '';
        }

        const valoracionLink = `https://www.legadoinmobiliaria.es`;
        const demandCount = totalDemands || 15;

        // Generate message based on step
        const message = generateMessage(seq.current_step, name, zone, demandCount, valoracionLink);

        // Send via Green API
        const result = await sendWhatsApp(phone, message);

        if (!result.ok) {
          errors.push(`${seq.id}: ${result.error}`);
          // If daily limit reached, stop processing entirely
          if (result.error?.includes('Límite diario')) break;
          continue;
        }

        // Log communication
        await sb.from('communication_logs').insert({
          contact_id: seq.contact_id,
          channel: 'whatsapp',
          direction: 'outbound',
          body_preview: message.substring(0, 200),
          status: 'sent',
          source: 'prospecting',
          agent_id: seq.agent_id,
          provider_msg_id: result.id,
        });

        // Advance sequence
        const nextStep = seq.current_step + 1;
        const isCompleted = nextStep >= STEP_DELAYS_HOURS.length;

        const nextStepAt = isCompleted
          ? null
          : new Date(Date.now() + STEP_DELAYS_HOURS[nextStep] * 3600000).toISOString();

        await sb.from('prospecting_sequences').update({
          current_step: nextStep,
          last_step_at: new Date().toISOString(),
          next_step_at: nextStepAt,
          completed: isCompleted,
        }).eq('id', seq.id);

        // If completed, create follow-up task for agent
        if (isCompleted && seq.agent_id) {
          await sb.from('tasks').insert({
            agent_id: seq.agent_id,
            title: `Seguimiento captación: ${meta.full_name || name}`,
            description: `La secuencia de 4 mensajes ha terminado sin respuesta. Valorar llamada directa o descarte.`,
            due_date: new Date(Date.now() + 2 * 86400000).toISOString(),
            priority: 'media',
            task_type: 'seguimiento',
            contact_id: seq.contact_id,
            source: 'prospecting',
          });
        }

        processed++;
        console.log(`[prospecting] Step ${seq.current_step} sent to ${name} (${phone})`);
      } catch (e) {
        errors.push(`${seq.id}: ${e.message}`);
      }
    }

    return json({ ok: true, processed, errors: errors.length > 0 ? errors : undefined });
  } catch (e) {
    console.error('[prospecting-sequence] Error:', e);
    return json({ error: e.message }, 500);
  }
});

function generateMessage(
  step: number,
  name: string,
  zone: string,
  _demandCount: number,
  valoracionLink: string,
): string {
  // Alicia: amiga experta inmobiliaria, cero comercial, cercana y natural.
  // Solo UN mensaje lleva link (paso 2). Sin datos de demanda ni presión.
  switch (step) {
    case 0:
      // Day 0: Primer contacto cercano, SIN links
      return `Hola ${name} 👋 Soy Alicia, de Legado Inmobiliaria. He visto que tienes un piso en ${zone} y me ha parecido interesante. ¿Estás valorando venderlo o solo tanteas el mercado? Pregunto sin compromiso, es pura curiosidad profesional 😊`;

    case 1:
      // Day 3: Seguimiento natural, SIN links
      return `Hola ${name}, te escribí hace unos días. La verdad es que ${zone} está en un momento muy interesante a nivel de mercado. Si en algún momento te apetece que te cuente cómo está la cosa por ahí, me dices. Sin agobios 🙂`;

    case 2:
      // Day 7: El ÚNICO mensaje con link — ofrecemos la web como herramienta útil
      return `Hola ${name}, por cierto, tenemos una web donde puedes ver cómo trabajamos, las propiedades que gestionamos y hacerte una idea del mercado en tu zona. Te la dejo por si te resulta útil:\n${valoracionLink}\n\nCualquier duda, aquí estoy 🙂`;

    case 3:
      // Day 14: Despedida amable, SIN links
      return `Hola ${name}, no te molesto más 😊 Solo quería decirte que si algún día necesitas orientación sobre tu piso en ${zone}, ya sea para vender o simplemente para saber cómo va el mercado, me tienes por aquí. ¡Un abrazo!`;

    default:
      return '';
  }
}
