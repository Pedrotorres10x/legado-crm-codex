import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from "../_shared/cors.ts";

/**
 * Receives leads from Google Sheets via Apps Script.
 * Expects JSON: { secret, rows: [{ full_name, phone, email, ad_name, campaign_name, form_name, platform, created_time, ... }] }
 * Deduplicates by email/phone, creates contacts + portal_leads + interactions.
 */

type SheetLeadRow = {
  id?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  ad_name?: string | null;
  campaign_name?: string | null;
  form_name?: string | null;
  platform?: string | null;
  created_time?: string | null;
  is_organic?: boolean | string | null;
  [key: string]: unknown;
};

type GsheetWebhookBody = {
  secret?: string;
  rows?: SheetLeadRow[];
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json() as GsheetWebhookBody;
    const { secret, rows } = body;

    // Auth via shared secret
    const expectedSecret = Deno.env.get("GSHEET_LEAD_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ ok: false, error: "no_rows" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const results: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      const fullName = (row.full_name || "Lead Facebook").trim().substring(0, 100);
      const email = row.email?.trim() || null;
      const phone = row.phone?.trim() || null;
      const adName = row.ad_name || null;
      const campaignName = row.campaign_name || null;
      const formName = row.form_name || null;
      const platform = row.platform || "facebook";
      const createdTime = row.created_time || null;
      const isOrganic = row.is_organic === true || row.is_organic === "true";
      const sheetId = row.id || null; // Facebook lead ID from the sheet

      // ── Deduplicate ────────────────────────────────────────────────────
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

      // ── Skip if already imported by this sheet ID ──────────────────────
      if (sheetId) {
        const { data: existing } = await supabase
          .from("portal_leads")
          .select("id")
          .eq("portal_name", "facebook-sheet")
          .contains("extracted_data", { sheet_id: sheetId })
          .maybeSingle();
        if (existing) {
          results.push({ sheet_id: sheetId, skipped: true, reason: "already_imported" });
          continue;
        }
      }

      // ── Build notes ────────────────────────────────────────────────────
      const notesParts = [
        `Lead Facebook Ads (Google Sheets).`,
        campaignName ? `Campaña: ${campaignName}.` : null,
        adName ? `Anuncio: ${adName}.` : null,
        formName ? `Formulario: ${formName}.` : null,
        isOrganic ? `Orgánico.` : null,
        createdTime ? `Fecha lead: ${createdTime}.` : null,
      ].filter(Boolean).join(" ");

      // ── Create or update contact ───────────────────────────────────────
      if (!contactId) {
        const { data: newContact, error: err } = await supabase
          .from("contacts")
          .insert({
            full_name: fullName,
            email: email?.substring(0, 255) || null,
            phone: phone?.substring(0, 20) || null,
            contact_type: "comprador",
            status: "nuevo",
            pipeline_stage: "nuevo",
            tags: ["fb-lead-ads", "google-sheets"],
            notes: notesParts,
            gdpr_consent: false,
            gdpr_legal_basis: "legitimate_interest",
          })
          .select("id")
          .single();
        if (err) {
          console.error("[gsheet-lead-webhook] Contact insert error:", err);
          results.push({ sheet_id: sheetId, error: err.message });
          continue;
        }
        contactId = newContact.id;
      }

      // ── Create interaction ─────────────────────────────────────────────
      await supabase.from("interactions").insert({
        contact_id: contactId,
        interaction_type: "nota",
        subject: `Lead Facebook Ads · ${campaignName || formName || platform}`,
        description: notesParts,
      });

      // ── Portal leads record ────────────────────────────────────────────
      await supabase.from("portal_leads").insert({
        portal_name: "facebook-sheet",
        contact_id: contactId,
        raw_email_subject: `FB Lead: ${fullName}`,
        raw_email_from: "google-sheets-sync",
        extracted_data: { ...row, sheet_id: sheetId },
        status: isDuplicate ? "duplicado" : "nuevo",
      });

      results.push({
        sheet_id: sheetId,
        contact_id: contactId,
        duplicate: isDuplicate,
        created: !isDuplicate,
      });
    }

    console.log(`[gsheet-lead-webhook] Processed ${results.length} leads`);
    return json({ ok: true, processed: results.length, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gsheet-lead-webhook] Error:", message);
    return json({ ok: false, error: "Error al procesar leads" }, 500);
  }
});
