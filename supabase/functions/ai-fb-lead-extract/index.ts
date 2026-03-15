import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";

/**
 * Extracts Facebook Lead Ads data from a screenshot using AI vision,
 * then creates the contact via the portal-lead-inbound flow.
 */

const EXTRACT_PROMPT = `Eres un extractor de datos de leads de Facebook Ads.
Analiza esta captura de pantalla del "Centro de clientes potenciales" de Facebook/Meta Business Suite.
Extrae TODOS los datos visibles del lead seleccionado (panel derecho).

Responde SOLO con JSON válido:
{
  "full_name": "nombre completo tal como aparece",
  "phone": "teléfono con prefijo internacional" o null,
  "email": "email" o null,
  "form_responses": [
    { "question": "pregunta del formulario", "answer": "respuesta" }
  ],
  "form_date": "fecha de envío si aparece (formato DD/MM/YYYY HH:MM)" o null,
  "form_id": "ID del formulario si aparece" o null
}`;

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Auth check
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

    // Parse the image
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
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
          { type: "text", text: "Extrae los datos del lead de esta captura de Facebook Lead Ads." },
        ],
      },
    ], { max_tokens: 800 });

    let extracted: any;
    try {
      const raw = (aiResult.content || "")
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      extracted = JSON.parse(raw);
    } catch {
      console.error("[ai-fb-lead-extract] AI parse failed:", aiResult.content);
      return json({ ok: false, error: "ai_parse_failed", raw: aiResult.content }, 422);
    }

    const fullName = extracted.full_name?.trim() || "Lead Facebook";
    const phone = extracted.phone?.trim() || null;
    const email = extracted.email?.trim() || null;
    const formResponses = extracted.form_responses || [];
    const formDate = extracted.form_date || null;

    // Build notes from form responses
    const responsesText = formResponses
      .map((r: any) => `"${r.question}" → "${r.answer}"`)
      .join(". ");
    const notes = [
      "Lead desde Facebook Lead Ads.",
      responsesText ? `Respuestas formulario: ${responsesText}.` : null,
      formDate ? `Fecha envío: ${formDate}.` : null,
    ].filter(Boolean).join(" ");

    // Create contact using service role
    const supabase = createClient(supabaseUrl, serviceKey);

    // Deduplicate by email or phone
    let contactId: string | null = null;
    let isDuplicate = false;

    if (email) {
      const { data } = await supabase
        .from("contacts")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (data) { contactId = data.id; isDuplicate = true; }
    }

    if (!contactId && phone) {
      const cleanPhone = phone.replace(/[\s\-().]/g, "");
      const { data } = await supabase
        .from("contacts")
        .select("id")
        .or(`phone.eq.${cleanPhone},phone2.eq.${cleanPhone}`)
        .maybeSingle();
      if (data) { contactId = data.id; isDuplicate = true; }
    }

    if (!contactId) {
      const { data: newContact, error: contactErr } = await supabase
        .from("contacts")
        .insert({
          full_name: fullName.substring(0, 100),
          email: email?.substring(0, 255) || null,
          phone: phone?.substring(0, 20) || null,
          contact_type: "comprador",
          status: "nuevo",
          pipeline_stage: "nuevo",
          tags: ["fb-lead-ads", "formulario-fb"],
          agent_id: user.id,
          notes,
          gdpr_consent: false,
          gdpr_legal_basis: "legitimate_interest",
        })
        .select("id")
        .single();
      if (contactErr) throw contactErr;
      contactId = newContact.id;
    } else {
      // Update notes on existing contact
      await supabase
        .from("contacts")
        .update({ notes, tags: ["fb-lead-ads", "formulario-fb"] })
        .eq("id", contactId);
    }

    // Create interaction
    await supabase.from("interactions").insert({
      contact_id: contactId,
      interaction_type: "nota",
      subject: "Lead desde Facebook Lead Ads",
      description: notes,
      agent_id: user.id,
    });

    // Insert portal_leads record
    await supabase.from("portal_leads").insert({
      portal_name: "facebook",
      contact_id: contactId,
      raw_email_subject: "Facebook Lead Ads (screenshot)",
      raw_email_from: "manual-upload",
      extracted_data: extracted,
      status: isDuplicate ? "duplicado" : "nuevo",
    });

    return json({
      ok: true,
      contact_id: contactId,
      duplicate: isDuplicate,
      extracted,
    });
  } catch (err: any) {
    console.error("[ai-fb-lead-extract] Error:", err.message || err);
    return json({ ok: false, error: "Error al procesar el screenshot" }, 500);
  }
});
