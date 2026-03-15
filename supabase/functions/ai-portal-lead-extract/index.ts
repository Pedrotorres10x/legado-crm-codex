import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";

/**
 * Extracts portal lead data from a screenshot of a portal notification email
 * (Idealista, Fotocasa, etc.) using AI vision.
 * Creates contact + demand + interaction, same logic as portal-lead-inbound.
 */

const EXTRACT_PROMPT = `Eres un parser de emails de notificación de portales inmobiliarios españoles.
Analiza esta captura de pantalla de un email de notificación de un portal (Idealista, Fotocasa, Todopisos, Pisos.com, SpainHouses, etc.).
Extrae los datos del lead interesado y del inmueble que consulta.

Responde SOLO con JSON válido, sin explicaciones:
{
  "portal": "idealista|fotocasa|todopisos|pisos.com|spainhouses|otro",
  "full_name": "nombre completo" o null,
  "email": "email" o null,
  "phone": "telefono" o null,
  "message": "mensaje del interesado" o null,
  "property_reference": "referencia como LGD-XXXX si aparece" o null,
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

REGLAS:
- Identifica el portal por el diseño/logo del email.
- Extrae nombre, email y teléfono del interesado.
- Si hay referencia de inmueble (LGD-XXXX, REF-XXXX, etc.), extráela.
- Infiere los datos de demanda del contexto: tipo de inmueble, ciudad, precio, etc.
- Si el anuncio dice "Piso en Torrevieja 120.000€", pon operation=venta, property_type=piso, cities=["Torrevieja"], max_price con +10% margen.
- Si no puedes inferir un campo, déjalo null o vacío.`;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return json({ ok: false, error: "unauthorized" }, 401);

    // Parse image
    const contentType = req.headers.get("content-type") || "";
    let imageBase64: string;
    let mimeType = "image/png";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("screenshot") as File;
      if (!file) return json({ ok: false, error: "no_file" }, 400);
      mimeType = file.type || "image/png";
      const buf = await file.arrayBuffer();
      imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    } else {
      const body = await req.json();
      imageBase64 = body.image_base64;
      mimeType = body.mime_type || "image/png";
      if (!imageBase64) return json({ ok: false, error: "no_image" }, 400);
    }

    // AI extraction with vision
    const aiResult = await callAI("google/gemini-2.5-flash", [
      { role: "system", content: EXTRACT_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: "text", text: "Extrae los datos del lead de esta captura de email de portal inmobiliario." },
        ],
      },
    ], { max_tokens: 800 });

    let extracted: any;
    try {
      const raw = (aiResult.content || "").replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      extracted = JSON.parse(raw);
    } catch {
      console.error("[ai-portal-lead-extract] AI parse failed:", aiResult.content);
      return json({ ok: false, error: "ai_parse_failed", raw: aiResult.content }, 422);
    }

    const portalName = (extracted.portal || "otro").toLowerCase();
    const leadName = extracted.full_name?.trim() || "Lead portal";
    const leadEmail = extracted.email?.trim() || null;
    const leadPhone = extracted.phone?.trim() || null;
    const leadMessage = extracted.message || null;
    const propertyRef = extracted.property_reference || null;
    const aiDemand = extracted.demand || {};

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Find property by reference ──────────────────────────────────────────
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

    // ── Deduplicate contact ─────────────────────────────────────────────────
    let contactId: string | null = null;
    let isDuplicate = false;

    if (leadEmail) {
      const { data } = await supabase
        .from("contacts").select("id, agent_id")
        .ilike("email", leadEmail).limit(1).maybeSingle();
      if (data) { contactId = data.id; isDuplicate = true; if (!propertyAgentId) propertyAgentId = data.agent_id; }
    }

    if (!contactId && leadPhone) {
      const cleanPhone = leadPhone.replace(/[\s\-().]/g, "");
      const { data } = await supabase
        .from("contacts").select("id, agent_id")
        .or(`phone.eq.${cleanPhone},phone2.eq.${cleanPhone}`)
        .limit(1).maybeSingle();
      if (data) { contactId = data.id; isDuplicate = true; if (!propertyAgentId) propertyAgentId = data.agent_id; }
    }

    // ── Create contact if needed ────────────────────────────────────────────
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
          agent_id: propertyAgentId || user.id,
          notes: `Lead desde portal: ${portalName}`,
          gdpr_consent: false,
          gdpr_legal_basis: "legitimate_interest",
        })
        .select("id").single();
      if (contactErr) throw contactErr;
      contactId = newContact.id;
    }

    // ── Create interaction ──────────────────────────────────────────────────
    const description = [
      `Portal: ${portalName}`,
      leadMessage ? `Mensaje: ${leadMessage.substring(0, 500)}` : null,
      propertyRef ? `Ref. inmueble: ${propertyRef}` : null,
      extracted.property_title ? `Anuncio: ${extracted.property_title}` : null,
    ].filter(Boolean).join("\n");

    await supabase.from("interactions").insert({
      contact_id: contactId,
      interaction_type: "nota",
      subject: `Lead desde ${portalName} (pantallazo)`,
      description,
      property_id: propertyId || null,
      agent_id: user.id,
    });

    // ── Create demand ───────────────────────────────────────────────────────
    if (propertyId) {
      const { data: prop } = await supabase
        .from("properties")
        .select("city, property_type, operation, price")
        .eq("id", propertyId).maybeSingle();
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

    // ── Insert portal_leads record ──────────────────────────────────────────
    await supabase.from("portal_leads").insert({
      portal_name: portalName,
      contact_id: contactId,
      property_id: propertyId,
      raw_email_subject: `${portalName} (screenshot manual)`,
      raw_email_from: "manual-upload",
      extracted_data: extracted,
      status: isDuplicate ? "duplicado" : "nuevo",
    });

    return json({
      ok: true,
      contact_id: contactId,
      portal: portalName,
      duplicate: isDuplicate,
      property_id: propertyId,
      extracted,
    });
  } catch (err: any) {
    console.error("[ai-portal-lead-extract] Error:", err.message || err);
    return json({ ok: false, error: "Error al procesar el pantallazo del portal" }, 500);
  }
});
