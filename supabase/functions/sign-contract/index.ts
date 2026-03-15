import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_OTP_ATTEMPTS = 5;

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

async function auditLog(supabase: any, action: string, recordId: string, details: Record<string, string>) {
  const fieldsToLog = Object.entries(details);
  for (const [fieldName, newValue] of fieldsToLog) {
    await supabase.from("audit_log").insert({
      table_name: "contract_signers",
      record_id: recordId,
      action,
      field_name: fieldName,
      new_value: newValue,
    });
  }
}

async function sendOtpEmail(email: string, code: string, signerLabel: string) {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "CRM Legado Colección", email: "info@planhogar.es" },
      to: [{ email }],
      subject: `Código de verificación para firma: ${code}`,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;">
          <h2 style="color:#1a1a2e;margin-bottom:20px;">Verificación de firma</h2>
          <p style="color:#444;font-size:15px;">${signerLabel}, para continuar con la firma del contrato, introduce el siguiente código:</p>
          <div style="background:#f4f4f8;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;">${code}</span>
          </div>
          <p style="color:#888;font-size:13px;">Este código expira en 10 minutos. Si no has solicitado esta verificación, ignora este email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#aaa;font-size:11px;">Legado Colección — Firma Digital Segura</p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Brevo error: ${res.status} - ${errBody}`);
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendCompletionEmails(supabase: any, contract: any, signers: any[], documentHash: string) {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) return;

  const signDate = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const signersSummaryHtml = signers.map((s: any) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.signer_label || 'Firmante'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.signer_name || '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.signer_id_number || '—'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.signed_at ? new Date(s.signed_at).toLocaleDateString("es-ES") : '—'}</td>
    </tr>
  `).join("");

  // Detect if content is a PDF URL
  const pdfMatch = contract.content?.match(/https?:\/\/[^\s]+\.(pdf|PDF)(?:\?[^\s]*)?/);
  const pdfUrl = pdfMatch?.[0];
  const documentSection = pdfUrl
    ? `<p style="margin:16px 0;"><a href="${pdfUrl}" style="display:inline-block;padding:10px 20px;background:#6d28d9;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">📄 Ver documento firmado</a></p>`
    : `<div style="background:#f9f9fb;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="color:#888;font-size:12px;margin:0 0 4px;">Extracto del contrato:</p>
        <p style="color:#555;font-size:13px;margin:0;">${contract.content.replace(/<[^>]*>/g, "").substring(0, 300)}...</p>
      </div>`;

  // Send to each signer with email
  for (const s of signers) {
    if (!s.signer_email) continue;
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "CRM Legado Colección", email: "info@planhogar.es" },
        to: [{ email: s.signer_email }],
        subject: "✅ Contrato firmado por todas las partes",
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;">
            <h2 style="color:#1a1a2e;">Contrato firmado correctamente</h2>
            <p style="color:#444;font-size:15px;">Hola ${s.signer_name || s.signer_label},</p>
            <p style="color:#444;font-size:15px;">Te confirmamos que <strong>todas las partes han firmado</strong> el contrato.</p>
            ${documentSection}
            <h3 style="color:#1a1a2e;font-size:14px;margin-top:24px;">Resumen de firmantes</h3>
            <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;">
              <thead>
                <tr style="background:#f4f4f8;">
                  <th style="padding:8px 12px;text-align:left;">Parte</th>
                  <th style="padding:8px 12px;text-align:left;">Nombre</th>
                  <th style="padding:8px 12px;text-align:left;">DNI/NIE</th>
                  <th style="padding:8px 12px;text-align:left;">Fecha firma</th>
                </tr>
              </thead>
              <tbody>${signersSummaryHtml}</tbody>
            </table>
            <p style="color:#888;font-size:12px;">Hash del documento: <code>${documentHash}</code></p>
            <p style="color:#888;font-size:12px;">Fecha de cierre: ${signDate}</p>
            <p style="color:#aaa;font-size:11px;margin-top:16px;">Este documento ha sido firmado electrónicamente conforme al Reglamento (UE) 910/2014 (eIDAS).</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
            <p style="color:#aaa;font-size:11px;">Legado Colección — Firma Digital Segura</p>
          </div>
        `,
      }),
    });
  }

  // Send admin notification
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (adminRoles?.length) {
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("email, full_name")
      .in("user_id", adminRoles.map((r: any) => r.user_id));

    for (const admin of (adminProfiles || [])) {
      if (!admin.email) continue;

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "CRM Legado Colección", email: "info@planhogar.es" },
        to: [{ email: admin.email }],
        subject: "🔔 Contrato firmado por todas las partes",
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px;">
            <h2 style="color:#1a1a2e;">Firma completada</h2>
            <p style="color:#444;font-size:15px;">Hola ${admin.full_name},</p>
            <p style="color:#444;font-size:15px;">Todas las partes han firmado un contrato. Detalles:</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
              <thead>
                <tr style="background:#f4f4f8;">
                  <th style="padding:8px 12px;text-align:left;">Parte</th>
                  <th style="padding:8px 12px;text-align:left;">Nombre</th>
                  <th style="padding:8px 12px;text-align:left;">Email</th>
                  <th style="padding:8px 12px;text-align:left;">Fecha firma</th>
                </tr>
              </thead>
              <tbody>${signers.map((s: any) => `
                <tr>
                  <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.signer_label || 'Firmante'}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.signer_name || '—'}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.signer_email || '—'}</td>
                  <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.signed_at ? new Date(s.signed_at).toLocaleDateString("es-ES") : '—'}</td>
                </tr>
              `).join("")}</tbody>
            </table>
            <p style="color:#888;font-size:12px;">Hash: <code>${documentHash}</code> · Fecha: ${signDate}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
            <p style="color:#aaa;font-size:11px;">Legado Colección — CRM Interno</p>
          </div>
        `,
      }),
    });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ═══════════════════════════════════════════════════════════════════
    // GET: fetch contract by token for public viewing
    // ═══════════════════════════════════════════════════════════════════
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token || token.length < 10) {
        return jsonResponse({ error: "Token inválido" }, 400);
      }

      // Multi-signer flow
      const { data: signer } = await supabase
        .from("contract_signers")
        .select("id, contract_id, signer_label, signature_status, signer_name, signer_id_number, signed_at, signature_url, document_hash, otp_verified, signer_email")
        .eq("signature_token", token)
        .single();

      if (signer) {
        const { data: contract } = await supabase
          .from("generated_contracts")
          .select("id, content, content_hash")
          .eq("id", signer.contract_id)
          .single();

        if (!contract) return jsonResponse({ error: "Contrato no encontrado" }, 404);

        const contentHash = await sha256(contract.content);
        return jsonResponse({
          id: contract.id,
          content: contract.content,
          signature_status: signer.signature_status,
          signer_name: signer.signer_name,
          signer_id_number: signer.signer_id_number,
          signed_at: signer.signed_at,
          signature_url: signer.signature_url,
          document_hash: signer.document_hash,
          signer_label: signer.signer_label,
          content_hash: contentHash,
          signer_id: signer.id,
          otp_verified: signer.otp_verified,
          signer_email: signer.signer_email,
        });
      }

      // Legacy single-signer
      const { data, error } = await supabase
        .from("generated_contracts")
        .select("id, content, signature_status, signer_name, signer_id_number, signed_at, signature_url, document_hash")
        .eq("signature_token", token)
        .single();

      if (error || !data) return jsonResponse({ error: "Contrato no encontrado" }, 404);

      const contentHash = await sha256(data.content);
      return jsonResponse({ ...data, content_hash: contentHash, otp_verified: true });
    }

    // ═══════════════════════════════════════════════════════════════════
    // POST: handle actions
    // ═══════════════════════════════════════════════════════════════════
    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;
      const clientIp = getClientIp(req);
      const clientUA = req.headers.get("user-agent") || "unknown";

      // ──── SEND OTP ────
      if (action === "send_otp") {
        const { token, email } = body;
        if (!token || !email) return jsonResponse({ error: "Token y email son obligatorios" }, 400);

        const normalizedEmail = email.trim().toLowerCase();

        const { data: signer } = await supabase
          .from("contract_signers")
          .select("id, signer_label, signature_status, otp_verified, signer_email")
          .eq("signature_token", token)
          .single();

        if (!signer) return jsonResponse({ error: "Enlace no válido" }, 404);
        if (signer.signature_status === "firmado") return jsonResponse({ error: "Ya firmado" }, 400);
        if (signer.signature_status === "revocado") return jsonResponse({ error: "Este enlace ha sido revocado" }, 400);
        if (signer.signer_email && signer.signer_email.trim().toLowerCase() !== normalizedEmail) {
          return jsonResponse({ error: "Debes verificarte con el email asignado a este firmante" }, 403);
        }

        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await supabase.from("contract_signers").update({
          signer_email: signer.signer_email?.trim().toLowerCase() || normalizedEmail,
          otp_code: otp,
          otp_expires_at: expiresAt,
          otp_verified: false,
          otp_attempts: 0,
        }).eq("id", signer.id);

        await sendOtpEmail(signer.signer_email?.trim().toLowerCase() || normalizedEmail, otp, signer.signer_label || "Firmante");

        // Audit: OTP sent
        await auditLog(supabase, "otp_sent", signer.id, {
          email: signer.signer_email?.trim().toLowerCase() || normalizedEmail,
          ip: clientIp,
        });

        return jsonResponse({ success: true, message: "Código enviado" });
      }

      // ──── VERIFY OTP ────
      if (action === "verify_otp") {
        const { token, code } = body;
        if (!token || !code) return jsonResponse({ error: "Token y código son obligatorios" }, 400);

        const { data: signer } = await supabase
          .from("contract_signers")
          .select("id, otp_code, otp_expires_at, otp_attempts")
          .eq("signature_token", token)
          .single();

        if (!signer) return jsonResponse({ error: "Enlace no válido" }, 404);

        if (!signer.otp_code || !signer.otp_expires_at) {
          return jsonResponse({ error: "No se ha enviado ningún código" }, 400);
        }

        // Check attempt limit
        if ((signer.otp_attempts || 0) >= MAX_OTP_ATTEMPTS) {
          // Invalidate the OTP
          await supabase.from("contract_signers").update({
            otp_code: null,
            otp_expires_at: null,
            otp_attempts: 0,
          }).eq("id", signer.id);

          await auditLog(supabase, "otp_blocked", signer.id, {
            reason: "max_attempts_exceeded",
            ip: clientIp,
          });

          return jsonResponse({ error: "Demasiados intentos. Solicita un nuevo código." }, 429);
        }

        if (new Date(signer.otp_expires_at) < new Date()) {
          return jsonResponse({ error: "El código ha expirado. Solicita uno nuevo." }, 400);
        }

        if (signer.otp_code !== code.trim()) {
          // Increment attempts
          await supabase.from("contract_signers").update({
            otp_attempts: (signer.otp_attempts || 0) + 1,
          }).eq("id", signer.id);

          const remaining = MAX_OTP_ATTEMPTS - (signer.otp_attempts || 0) - 1;
          return jsonResponse({ error: `Código incorrecto. ${remaining > 0 ? `Te quedan ${remaining} intento${remaining === 1 ? '' : 's'}.` : 'Solicita un nuevo código.'}` }, 400);
        }

        await supabase.from("contract_signers").update({
          otp_verified: true,
          otp_code: null,
          otp_expires_at: null,
          otp_attempts: 0,
        }).eq("id", signer.id);

        // Audit: OTP verified
        await auditLog(supabase, "otp_verified", signer.id, {
          ip: clientIp,
          user_agent: clientUA,
        });

        return jsonResponse({ success: true, message: "Verificado" });
      }

      // ──── REVOKE SIGNATURE LINK ────
      if (action === "revoke") {
        const { contract_id } = body;
        if (!contract_id) return jsonResponse({ error: "contract_id es obligatorio" }, 400);

        // This requires auth — check authorization header
        const authHeader = req.headers.get("authorization");
        if (!authHeader) return jsonResponse({ error: "No autorizado" }, 401);

        const authSupabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        // Check the user owns this contract or is admin
        const { data: contract, error: contractErr } = await authSupabase
          .from("generated_contracts")
          .select("id, signature_status, agent_id")
          .eq("id", contract_id)
          .single();

        if (contractErr || !contract) return jsonResponse({ error: "Contrato no encontrado" }, 404);
        if (contract.signature_status === "firmado") return jsonResponse({ error: "No se puede revocar un contrato ya firmado" }, 400);

        // Cancel all pending signers
        await supabase.from("contract_signers")
          .update({ signature_status: "revocado", otp_code: null, otp_expires_at: null })
          .eq("contract_id", contract_id)
          .eq("signature_status", "pendiente");

        // Update contract status
        await supabase.from("generated_contracts")
          .update({ signature_status: "revocado" })
          .eq("id", contract_id);

        // Audit
        await supabase.from("audit_log").insert({
          table_name: "generated_contracts",
          record_id: contract_id,
          action: "signature_revoked",
          field_name: "signature_status",
          old_value: contract.signature_status,
          new_value: "revocado",
          user_id: contract.agent_id,
        });

        return jsonResponse({ success: true, message: "Firma revocada" });
      }

      // ──── SIGN CONTRACT ────
      const { token: signToken, signer_name, signer_id_number, signature_base64 } = body;
      const token = signToken || body.token;

      if (!token || !signer_name || !signer_id_number || !signature_base64) {
        return jsonResponse({ error: "Campos obligatorios: token, signer_name, signer_id_number, signature_base64" }, 400);
      }

      const dniNieRegex = /^[0-9XYZ]\d{7}[A-Z]$/i;
      const cleanId = signer_id_number.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!dniNieRegex.test(cleanId)) {
        return jsonResponse({ error: "Formato de DNI/NIE inválido" }, 400);
      }

      if (signer_name.trim().length < 3 || signer_name.trim().length > 150) {
        return jsonResponse({ error: "El nombre debe tener entre 3 y 150 caracteres" }, 400);
      }

      if (!signature_base64.startsWith("data:image/png;base64,")) {
        return jsonResponse({ error: "Formato de firma inválido" }, 400);
      }

      // Multi-signer flow
      const { data: signer } = await supabase
        .from("contract_signers")
        .select("id, contract_id, signature_status, otp_verified")
        .eq("signature_token", token)
        .single();

      if (signer) {
        if (signer.signature_status === "firmado") return jsonResponse({ error: "Este firmante ya ha firmado" }, 400);
        if (signer.signature_status === "revocado") return jsonResponse({ error: "Este enlace ha sido revocado" }, 400);
        if (!signer.otp_verified) return jsonResponse({ error: "Debes verificar tu email antes de firmar" }, 403);

        const { data: contract } = await supabase
          .from("generated_contracts")
          .select("id, content, content_hash")
          .eq("id", signer.contract_id)
          .single();

        if (!contract) return jsonResponse({ error: "Contrato no encontrado" }, 404);

        const documentHash = await sha256(contract.content);

        // Verify content integrity — if content_hash was frozen at send time, compare
        if (contract.content_hash && contract.content_hash !== documentHash) {
          return jsonResponse({ error: "El contenido del contrato ha sido modificado. Firma bloqueada por seguridad." }, 409);
        }

        // Process signature image
        const base64Data = signature_base64.replace(/^data:image\/png;base64,/, "");
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

        // Hash the signature image for anti-tampering
        const signatureImageHash = await sha256(base64Data);

        const filePath = `${signer.id}.png`;
        await supabase.storage.from("contract-signatures").upload(filePath, bytes, { contentType: "image/png", upsert: true });

        // Since bucket is now private, generate a signed URL for viewing
        const { data: signedUrlData } = await supabase.storage
          .from("contract-signatures")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10); // 10 years

        const signatureUrl = signedUrlData?.signedUrl || filePath;

        await supabase.from("contract_signers").update({
          signature_status: "firmado",
          signer_name: signer_name.trim(),
          signer_id_number: cleanId,
          signer_ip: clientIp,
          signer_user_agent: clientUA,
          signed_at: new Date().toISOString(),
          signature_url: signatureUrl,
          document_hash: documentHash,
          signature_hash: signatureImageHash,
        }).eq("id", signer.id);

        // Audit: signature completed
        await auditLog(supabase, "contract_signed", signer.id, {
          signer_name: signer_name.trim(),
          signer_id_number: cleanId,
          ip: clientIp,
          user_agent: clientUA,
          document_hash: documentHash,
          signature_hash: signatureImageHash,
        });

        // Check if all signers signed
        const { data: allSigners } = await supabase
          .from("contract_signers")
          .select("signature_status, contact_id, signer_name, signer_email, signer_label, signed_at")
          .eq("contract_id", contract.id);

        const allSigned = allSigners?.every(s => s.signature_status === "firmado");
        if (allSigned) {
          const primaryContactId = allSigners?.find(s => s.contact_id)?.contact_id || null;

          await supabase.from("generated_contracts").update({
            signature_status: "firmado",
            signed_at: new Date().toISOString(),
            document_hash: documentHash,
            ...(primaryContactId ? { contact_id: primaryContactId } : {}),
          }).eq("id", contract.id);

          // Send signed contract to all signers + admin notification
          try {
            await sendCompletionEmails(supabase, contract, allSigners, documentHash);
          } catch (emailErr) {
            console.error("Error sending completion emails:", emailErr);
          }
        }

        return jsonResponse({
          success: true,
          message: "Contrato firmado correctamente",
          document_hash: documentHash,
        });
      }

      // ──── Legacy single-signer flow (no OTP) ────
      const { data: contract, error: findError } = await supabase
        .from("generated_contracts")
        .select("id, content, signature_status")
        .eq("signature_token", token)
        .single();

      if (findError || !contract) return jsonResponse({ error: "Contrato no encontrado" }, 404);
      if (contract.signature_status === "firmado") return jsonResponse({ error: "Este contrato ya ha sido firmado" }, 400);
      if (contract.signature_status !== "pendiente") return jsonResponse({ error: "Este contrato no está pendiente de firma" }, 400);

      const documentHash = await sha256(contract.content);
      const base64Data = signature_base64.replace(/^data:image\/png;base64,/, "");
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const signatureImageHash = await sha256(base64Data);

      const filePath = `${contract.id}.png`;
      const { error: uploadError } = await supabase.storage.from("contract-signatures").upload(filePath, bytes, { contentType: "image/png", upsert: true });
      if (uploadError) return jsonResponse({ error: "Error al subir la firma: " + uploadError.message }, 500);

      const { data: signedUrlData } = await supabase.storage
        .from("contract-signatures")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);

      const signatureUrl = signedUrlData?.signedUrl || filePath;

      const { error: updateError } = await supabase.from("generated_contracts").update({
        signature_status: "firmado",
        signer_name: signer_name.trim(),
        signer_id_number: cleanId,
        signer_ip: clientIp,
        signer_user_agent: clientUA,
        signed_at: new Date().toISOString(),
        signature_url: signatureUrl,
        document_hash: documentHash,
      }).eq("id", contract.id);

      if (updateError) return jsonResponse({ error: "Error al actualizar contrato: " + updateError.message }, 500);

      return jsonResponse({
        success: true,
        message: "Contrato firmado correctamente",
        document_hash: documentHash,
      });
    }

    return jsonResponse({ error: "Método no permitido" }, 405);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});
