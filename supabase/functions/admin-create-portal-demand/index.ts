import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, handleCors } from "../_shared/cors.ts";
import { resolveAssignedAgentId } from "../_shared/agent-assignment.ts";
import { sendPropertyInterestOpener } from "../_shared/match-whatsapp.ts";
import { resolveContactLanguage } from "../_shared/contact-language.ts";

type Payload = {
  portal?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  property_id?: string | null;
  language?: string | null;
  operation?: string | null;
  property_type?: string | null;
  city?: string | null;
  zone?: string | null;
  base_price?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  min_surface?: number | null;
  notes?: string | null;
};

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function normalizePhone(value?: string | null) {
  const cleaned = value?.replace(/[^\d+]/g, "").trim() || null;
  return cleaned || null;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json()) as Payload;
    const portal = (body.portal || "todopisos").trim().toLowerCase();
    const fullName = body.full_name?.trim() || "Lead portal";
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const propertyId = body.property_id?.trim() || null;
    const preferredLanguage = body.language?.trim() || null;
    const city = body.city?.trim() || null;
    const zone = body.zone?.trim() || null;
    const operation = body.operation?.trim().toLowerCase() || "venta";
    const propertyType = body.property_type?.trim().toLowerCase() || "piso";
    const basePrice = Number.isFinite(Number(body.base_price)) ? Number(body.base_price) : null;
    const minPrice =
      Number.isFinite(Number(body.min_price)) ? Number(body.min_price) :
      basePrice ? Math.round(basePrice * 0.75) :
      null;
    const maxPrice =
      Number.isFinite(Number(body.max_price)) ? Number(body.max_price) :
      basePrice ? Math.round(basePrice * 1.25) :
      null;
    const minSurface = Number.isFinite(Number(body.min_surface)) ? Number(body.min_surface) : null;
    const notes = body.notes?.trim() || null;

    if (!email && !phone) {
      return json({ ok: false, error: "missing_identity" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let contactId: string | null = null;
    let propertyAgentId: string | null = null;
    let existingPreferredLanguage: string | null = null;

    if (email) {
      const { data } = await supabase
        .from("contacts")
        .select("id, agent_id, preferred_language")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (data) {
        contactId = data.id;
        propertyAgentId = data.agent_id;
        existingPreferredLanguage = data.preferred_language || null;
      }
    }

    if (!contactId && phone) {
      const { data } = await supabase
        .from("contacts")
        .select("id, agent_id, preferred_language")
        .or(`phone.eq.${phone},phone2.eq.${phone}`)
        .limit(1)
        .maybeSingle();
      if (data) {
        contactId = data.id;
        propertyAgentId = data.agent_id;
        existingPreferredLanguage = data.preferred_language || null;
      }
    }

    const resolvedLanguage = resolveContactLanguage(preferredLanguage || existingPreferredLanguage, notes, city, zone, portal, fullName);

    const assignedAgentId = await resolveAssignedAgentId(supabase, propertyAgentId || null);

    if (!contactId) {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          full_name: fullName,
          email,
          phone,
          contact_type: "comprador",
          status: "nuevo",
          pipeline_stage: "nuevo",
          preferred_language: resolvedLanguage,
          tags: ["portal-lead", `portal:${portal}`],
          agent_id: assignedAgentId,
          notes: `Lead rescatado manualmente desde ${portal}`,
          gdpr_consent: true,
          gdpr_consent_at: new Date().toISOString(),
          gdpr_legal_basis: "explicit_consent",
        })
        .select("id")
        .single();

      if (contactError) throw contactError;
      contactId = newContact.id;
    } else {
      await supabase
        .from("contacts")
        .update({
          full_name: fullName,
          email,
          phone,
          preferred_language: resolvedLanguage,
          agent_id: assignedAgentId,
          gdpr_consent: true,
          gdpr_consent_at: new Date().toISOString(),
          gdpr_legal_basis: "explicit_consent",
          tags: ["portal-lead", `portal:${portal}`],
        })
        .eq("id", contactId);
    }

    const demandNotes = [
      `Lead ${portal} rescatado manualmente.`,
      zone ? `Zona: ${zone}` : null,
      notes,
    ].filter(Boolean).join(" | ");

    const { data: demand, error: demandError } = await supabase
      .from("demands")
      .insert({
        contact_id: contactId,
        cities: city ? [city] : [],
        zones: zone ? [zone] : [],
        property_type: propertyType,
        operation,
        min_price: minPrice,
        max_price: maxPrice,
        min_surface: minSurface,
        auto_match: true,
        is_active: true,
        notes: demandNotes || null,
      })
      .select("id")
      .single();

    if (demandError) throw demandError;

    await supabase.from("interactions").insert({
      contact_id: contactId,
      interaction_type: "nota",
      subject: `Lead desde ${portal} (rescate manual)`,
      description: [
        `Portal: ${portal}`,
        email ? `Email: ${email}` : null,
        phone ? `Telefono: ${phone}` : null,
        city ? `Ciudad: ${city}` : null,
        zone ? `Zona: ${zone}` : null,
        basePrice ? `Precio base detectado: ${basePrice}€` : null,
        demandNotes || null,
      ].filter(Boolean).join("\n"),
      agent_id: assignedAgentId,
    });

    await supabase.from("portal_leads").insert({
      portal_name: portal,
      contact_id: contactId,
      raw_email_subject: `Rescate manual ${portal}`,
      raw_email_from: "outlook-manual-rescue",
      extracted_data: {
        portal,
        full_name: fullName,
        email,
        phone,
        demand: {
          operation,
          property_type: propertyType,
          cities: city ? [city] : [],
          zones: zone ? [zone] : [],
          min_price: minPrice,
          max_price: maxPrice,
          min_surface: minSurface,
        },
        notes,
      },
      status: "nuevo",
    });

    if (propertyId && phone) {
      const { data: property } = await supabase
        .from("properties")
        .select("id, title, city, province")
        .eq("id", propertyId)
        .maybeSingle();

      if (property) {
        await sendPropertyInterestOpener({
          supabase,
          contact: {
            id: contactId,
            full_name: fullName,
            phone,
            agent_id: assignedAgentId,
            gdpr_consent: true,
          },
          property,
          demandId: demand.id,
          source: "admin-create-portal-demand",
          preferredLanguage,
          languageSamples: [notes, city, zone, portal],
        });
      }
    }

    return json({
      ok: true,
      contact_id: contactId,
      demand_id: demand.id,
      portal,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin-create-portal-demand] Error:", message);
    return json({ ok: false, error: message || "unexpected_error" }, 500);
  }
});
