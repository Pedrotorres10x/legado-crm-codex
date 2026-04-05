import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { sendMessage } from '../_shared/send-message.ts';

/**
 * Campaign: enrich incomplete demands (missing budget / zone).
 * 
 * Identifies candidates with incomplete demands and sends them
 * AI-generated messages directly via Green API (WhatsApp) or Brevo (Email).
 * 
 * POST body: { batch_size?, preview? }
 */

type SupabaseClient = ReturnType<typeof createClient>;

interface CampaignDemandEnrichBody {
  batch_size?: number;
  preview?: boolean;
}

interface EnrichDemand {
  id: string;
  contact_id: string;
  operation: string | null;
  property_type: string | null;
  max_price: number | null;
  min_price: number | null;
  cities: string[] | null;
  zones: string[] | null;
}

interface EnrichContact {
  id: string;
  full_name: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  city: string | null;
  nationality: string | null;
  notes: string | null;
  preferred_language: string | null;
  tags: string[] | null;
  opt_out: boolean | null;
}

interface EnrichCandidate extends EnrichContact {
  _demand: EnrichDemand;
}

interface AiMessageResponse {
  ok?: boolean;
  error?: string;
  text?: string;
  subject?: string;
  html?: string;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // ── Auth: require authenticated admin/coordinadora ───────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    // Check admin or coordinadora role
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'coordinadora'])
      .limit(1);
    if (!roleRow || roleRow.length === 0) {
      return json({ error: 'Forbidden: admin or coordinadora role required' }, 403);
    }

    // Kill-switch check
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "campaign_enrich_enabled")
      .maybeSingle();
    if (setting?.value === false || setting?.value === 'false') {
      return json({ ok: false, error: "Campaña de enriquecimiento desactivada" });
    }

    const body = await req.json() as CampaignDemandEnrichBody;
    const batchSize = Math.min(body.batch_size || 200, 500);
    const preview = body.preview === true;

    // ─── Find candidates ─────────────────────────────────────────────
    const candidates = await findCandidates(supabase, preview ? 1 : batchSize);

    if (!candidates.length) {
      return json({ ok: true, message: "No quedan demandas incompletas por procesar", sent: 0, remaining: 0 });
    }

    if (preview) {
      const c = candidates[0];
      return json({
        ok: true, preview: true,
        contact_name: c.full_name,
        channel: c.phone ? "whatsapp" : "email",
        remaining: candidates.length,
        missing: { budget: !c._demand?.max_price, zone: !c._demand?.cities?.length },
      });
    }

    // ─── Generate AI messages and send directly ─────────────────────
    let sent = 0;
    const errors: string[] = [];

    for (const contact of candidates) {
      try {
        const demand = contact._demand;
        const channel: 'whatsapp' | 'email' = contact.phone ? 'whatsapp' : 'email';
        const destination = channel === 'whatsapp' ? (contact.phone || contact.phone2) : contact.email;
        if (!destination) continue;

        const missingFields = {
          budget: !demand?.max_price,
          zone: !demand?.cities?.length,
        };

        // Generate AI message via ai-classify-message
        const msgRes = await fetch(`${supabaseUrl}/functions/v1/ai-classify-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({
            contact,
            channel,
            agent_name: "Alicia",
            attempt_number: 1,
            previous_messages: [],
            campaign_type: "demand_enrich",
            context: { demand, missing_fields: missingFields },
          }),
        });

        const msgData = await msgRes.json();
        if (!msgData.ok) throw new Error(`AI error: ${msgData.error}`);

        // Send directly
        const result = await sendMessage({
          channel,
          to: destination,
          contactName: contact.full_name,
          text: msgData.text,
          subject: channel === 'email' ? msgData.subject : undefined,
          html: channel === 'email' ? msgData.html : undefined,
          replyTo: channel === 'email' ? `campaign+${contact.id}@inbound.planhogar.es` : undefined,
        });

        if (!result.ok) throw new Error(result.error || 'Send failed');

        // Record in CRM
        await Promise.all([
          supabase.from("interactions").insert({
            contact_id: contact.id,
            interaction_type: channel === "whatsapp" ? "whatsapp" : "email",
            subject: "Campaña enriquecimiento demanda",
            description: `Enviado por ${channel === 'whatsapp' ? 'Green API' : 'Brevo'}. Texto: ${msgData.text?.slice(0, 200) || ""}`,
          }),
          supabase.from("communication_logs").insert({
            contact_id: contact.id,
            channel,
            direction: "outbound",
            source: "campaign_demand_enrich",
            body_preview: msgData.text?.slice(0, 500) || null,
            provider_msg_id: result.provider_message_id || null,
            status: "enviado",
            metadata: { campaign: "demand_enrich", channel },
          }),
        ]);

        // Tag contact
        const currentTags = contact.tags || [];
        if (!currentTags.includes("demanda-enrich-pendiente")) {
          await supabase.from("contacts").update({
            tags: [...currentTags, "demanda-enrich-pendiente"],
          }).eq("id", contact.id);
        }

        sent++;
        if (sent < candidates.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`${contact.full_name}: ${message}`);
      }
    }

    return json({ ok: true, sent, errors: errors.length ? errors : undefined, remaining: candidates.length - sent });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("campaign-demand-enrich error:", message);
    return json({ ok: false, error: message }, 500);
  }
});

// ─── Find incomplete demands without enrichment tags ─────────────────
async function findCandidates(supabase: SupabaseClient, limit: number): Promise<EnrichCandidate[]> {
  const { data: demands, error } = await supabase
    .from("demands")
    .select("id, contact_id, operation, property_type, max_price, min_price, cities, zones")
    .eq("is_active", true)
    .limit(500);

  if (error) throw new Error(`Query error: ${error.message}`);

  const incomplete = ((demands ?? []) as EnrichDemand[]).filter((d) =>
    d.max_price == null || !d.cities?.length
  );
  if (!incomplete.length) return [];

  const contactIds = [...new Set(incomplete.map((d) => d.contact_id))];

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, phone, phone2, email, city, nationality, notes, preferred_language, tags, opt_out")
    .in("id", contactIds);

  if (!contacts?.length) return [];

  const valid = ((contacts ?? []) as EnrichContact[]).filter((c) => {
    const tags = c.tags || [];
    return !tags.includes("demanda-enriquecida") &&
           !tags.includes("nevera") &&
           !c.opt_out &&
           (c.phone || c.email);
  });

  const results: EnrichCandidate[] = [];
  for (const contact of valid) {
    const contactDemands = incomplete.filter((d) => d.contact_id === contact.id);
    if (contactDemands.length > 0) {
      results.push({ ...contact, _demand: contactDemands[0] });
      if (results.length >= limit) break;
    }
  }

  return results;
}
