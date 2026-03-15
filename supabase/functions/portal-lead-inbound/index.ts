import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";

/**
 * Receives inbound emails from Brevo Inbound Parsing for portal lead notifications.
 * Parses the email with AI to extract lead data, deduplicates contacts, links to
 * properties, creates interactions/demands, and notifies agents.
 *
 * Setup: In Brevo, add inbound parsing rule for portal-lead@inbound.planhogar.es
 * pointing to this function's URL.
 */

const AI_PROMPT = `Eres un parser de emails de notificación de portales inmobiliarios españoles.
Analiza el subject y body del email y extrae los datos del lead interesado.
Responde SOLO con JSON válido, sin explicaciones:
{
  "portal": "idealista|fotocasa|todopisos|pisos.com|spainhouses|otro",
  "full_name": "nombre completo" o null,
  "email": "email" o null,
  "phone": "telefono" o null,
  "message": "mensaje del interesado" o null,
  "property_reference": "referencia como LGD-XXXX" o null,
  "property_title": "titulo del anuncio si aparece" o null,
  "demand": {
    "operation": "venta|alquiler" o null,
    "property_type": "piso|casa|chalet|adosado|atico|duplex|estudio|local|oficina|nave|terreno|garaje|trastero" o null,
    "cities": ["ciudad mencionada"] o [],
    "zones": ["zona o barrio mencionado"] o [],
    "min_bedrooms": numero o null,
    "min_bathrooms": numero o null,
    "min_price": numero o null,
    "max_price": numero o null,
    "min_surface": numero o null,
    "features": ["piscina","garaje","terraza","ascensor","jardin","trastero"] o []
  }
}

REGLAS PARA DEMAND:
- Extrae lo que puedas del contexto del email: tipo de inmueble del anuncio, ciudad, precio, etc.
- Si el email menciona un inmueble concreto (por título o referencia), infiere el tipo, ciudad y rango de precio.
- Si el anuncio dice "Piso en Torrevieja 120.000€", pon operation=venta, property_type=piso, cities=["Torrevieja"], max_price con +10% margen.
- Si no puedes inferir un campo, déjalo null o vacío.`;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // ── Auth check ─────────────────────────────────────────────────────────
    const secret = Deno.env.get("PORTAL_LEAD_SECRET");
    if (!secret) {
      console.error("[portal-lead-inbound] PORTAL_LEAD_SECRET not configured");
      return json({ ok: false, error: "webhook_not_configured" }, 500);
    }
    if (req.headers.get("x-portal-key") !== secret) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    // ── Parse inbound payload ──────────────────────────────────────────────
    let body: any;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const itemsRaw = formData.get("items");
      if (itemsRaw) {
        body = JSON.parse(itemsRaw as string);
        if (Array.isArray(body)) body = body[0];
      } else {
        body = {
          Sender: { Email: formData.get("Sender") },
          Subject: formData.get("Subject"),
          RawTextBody: formData.get("RawTextBody") || formData.get("TextBody"),
          ExtractedMarkdownMessage: formData.get("ExtractedMarkdownMessage"),
          RawHtmlBody: formData.get("RawHtmlBody"),
        };
      }
    } else {
      body = await req.json();
    }

    // ── Normalize: accept simplified format { subject, from, body } ───────
    const subject = body?.Subject || body?.subject || "";
    const fromEmail = body?.Sender?.Email || body?.from || "";
    const text =
      body?.ExtractedMarkdownMessage?.trim() ||
      body?.RawTextBody?.trim() ||
      body?.TextBody?.trim() ||
      body?.body?.trim() ||
      body?.Items?.[0]?.RawTextBody?.trim() ||
      body?.Items?.[0]?.TextBody?.trim() ||
      body?.RawHtmlBody?.replace(/<[^>]*>/g, " ").trim() ||
      "";

    console.log(`[portal-lead-inbound] Email from: ${fromEmail}, subject: ${subject}`);

    if (!text && !subject) {
      return json({ ok: false, error: "empty_email" }, 400);
    }

    // ── AI extraction ──────────────────────────────────────────────────────
    const aiResult = await callAI("google/gemini-2.5-flash-lite", [
      { role: "system", content: AI_PROMPT },
      { role: "user", content: `Subject: ${subject}\n\nBody:\n${text.slice(0, 3000)}` },
    ], { max_tokens: 500 });

    let extracted: any;
    try {
      const raw = (aiResult.content || "").replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      extracted = JSON.parse(raw);
    } catch {
      console.error("[portal-lead-inbound] AI parse failed:", aiResult.content);
      return json({ ok: false, error: "ai_parse_failed" }, 422);
    }

    const portalName = (extracted.portal || "otro").toLowerCase();
    const leadEmail = extracted.email?.trim() || null;
    const leadPhone = extracted.phone?.trim() || null;
    const leadName = extracted.full_name?.trim() || "Lead portal";
    const leadMessage = extracted.message || null;
    const propertyRef = extracted.property_reference || null;

    // ── Supabase client ────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Find property by reference ─────────────────────────────────────────
    let propertyId: string | null = null;
    let propertyAgentId: string | null = null;

    if (propertyRef) {
      const { data: prop } = await supabase
        .from("properties")
        .select("id, agent_id")
        .ilike("crm_reference", propertyRef)
        .limit(1)
        .maybeSingle();
      if (prop) {
        propertyId = prop.id;
        propertyAgentId = prop.agent_id;
      }
    }

    // ── Deduplicate contact ────────────────────────────────────────────────
    let contactId: string | null = null;
    let isDuplicate = false;

    if (leadEmail) {
      const { data } = await supabase
        .from("contacts")
        .select("id, agent_id")
        .ilike("email", leadEmail)
        .limit(1)
        .maybeSingle();
      if (data) {
        contactId = data.id;
        isDuplicate = true;
        if (!propertyAgentId) propertyAgentId = data.agent_id;
      }
    }

    if (!contactId && leadPhone) {
      const cleanPhone = leadPhone.replace(/[\s\-().]/g, "");
      const { data } = await supabase
        .from("contacts")
        .select("id, agent_id")
        .or(`phone.eq.${cleanPhone},phone2.eq.${cleanPhone}`)
        .limit(1)
        .maybeSingle();
      if (data) {
        contactId = data.id;
        isDuplicate = true;
        if (!propertyAgentId) propertyAgentId = data.agent_id;
      }
    }

    // ── Create new contact if needed ───────────────────────────────────────
    if (!contactId) {
      const tags = ["portal-lead", `portal:${portalName}`];
      const { data: newContact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          full_name: leadName.substring(0, 100),
          email: leadEmail?.substring(0, 255) || null,
          phone: leadPhone?.substring(0, 20) || null,
          contact_type: "comprador",
          status: "nuevo",
          pipeline_stage: "nuevo",
          tags,
          agent_id: propertyAgentId || null,
          notes: `Lead desde portal: ${portalName}`,
          gdpr_consent: false,
          gdpr_legal_basis: "legitimate_interest",
        })
        .select("id")
        .single();
      if (contactErr) {
        console.error("[portal-lead-inbound] Contact creation error:", contactErr);
        throw contactErr;
      }
      contactId = newContact.id;
    }

    // ── Create interaction ─────────────────────────────────────────────────
    const description = [
      `Portal: ${portalName}`,
      leadMessage ? `Mensaje: ${leadMessage.substring(0, 500)}` : null,
      propertyRef ? `Ref. inmueble: ${propertyRef}` : null,
      extracted.property_title ? `Anuncio: ${extracted.property_title}` : null,
    ].filter(Boolean).join("\n");

    await supabase.from("interactions").insert({
      contact_id: contactId,
      interaction_type: "nota",
      subject: `Lead desde ${portalName}`,
      description,
      property_id: propertyId || null,
      agent_id: propertyAgentId || null,
    });

    // ── Create demand ────────────────────────────────────────────────────
    const aiDemand = extracted.demand || {};

    if (propertyId) {
      const { data: prop } = await supabase
        .from("properties")
        .select("city, property_type, operation, price")
        .eq("id", propertyId)
        .maybeSingle();

      if (prop) {
        await supabase.from("demands").insert({
          contact_id: contactId,
          cities: prop.city ? [prop.city] : (aiDemand.cities?.length ? aiDemand.cities : []),
          zones: aiDemand.zones?.length ? aiDemand.zones : [],
          property_type: prop.property_type || aiDemand.property_type || null,
          operation: prop.operation || aiDemand.operation || "venta",
          max_price: prop.price ? Math.round(prop.price * 1.1) : (aiDemand.max_price || null),
          min_price: aiDemand.min_price || null,
          min_bedrooms: aiDemand.min_bedrooms || null,
          min_bathrooms: aiDemand.min_bathrooms || null,
          min_surface: aiDemand.min_surface || null,
          features: aiDemand.features?.length ? aiDemand.features : [],
          auto_match: true,
        });
      }
    } else if (aiDemand.cities?.length || aiDemand.property_type || aiDemand.max_price) {
      await supabase.from("demands").insert({
        contact_id: contactId,
        cities: aiDemand.cities || [],
        zones: aiDemand.zones || [],
        property_type: aiDemand.property_type || null,
        operation: aiDemand.operation || "venta",
        max_price: aiDemand.max_price || null,
        min_price: aiDemand.min_price || null,
        min_bedrooms: aiDemand.min_bedrooms || null,
        min_bathrooms: aiDemand.min_bathrooms || null,
        min_surface: aiDemand.min_surface || null,
        features: aiDemand.features?.length ? aiDemand.features : [],
        auto_match: true,
      });
    }

    // ── Insert portal_leads record ─────────────────────────────────────────
    await supabase.from("portal_leads").insert({
      portal_name: portalName,
      contact_id: contactId,
      property_id: propertyId,
      raw_email_subject: subject.substring(0, 500),
      raw_email_from: fromEmail.substring(0, 255),
      extracted_data: extracted,
      status: isDuplicate ? "duplicado" : "nuevo",
    });

    // ── Push notification ──────────────────────────────────────────────────
    try {
      const targetAgents: string[] = [];
      if (propertyAgentId) {
        targetAgents.push(propertyAgentId);
      } else {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        if (admins) targetAgents.push(...admins.map((a: any) => a.user_id));
      }

      for (const agentId of targetAgents) {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            agent_id: agentId,
            title: `🏠 Lead desde ${portalName}`,
            body: `${leadName}${propertyRef ? ` · ${propertyRef}` : ""}`,
            data: { table: "contacts", id: contactId },
          }),
        });
      }
    } catch (pushErr) {
      console.warn("[portal-lead-inbound] Push failed:", pushErr);
    }

    console.log(`[portal-lead-inbound] Lead processed: ${contactId} from ${portalName} (${isDuplicate ? "duplicado" : "nuevo"})`);

    return json({
      ok: true,
      contact_id: contactId,
      portal: portalName,
      duplicate: isDuplicate,
      property_id: propertyId,
    });
  } catch (err: any) {
    console.error("[portal-lead-inbound] Error:", err.message || err);
    return json({ ok: false, error: "Error al procesar el lead del portal" }, 500);
  }
});
