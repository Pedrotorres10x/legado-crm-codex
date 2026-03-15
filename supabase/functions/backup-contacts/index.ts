import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows: Record<string, unknown>[], colNames: string[]): string {
  const lines = [colNames.join(",")];
  for (const r of rows) {
    lines.push(
      colNames.map((h) => {
        const val = r[h];
        if (Array.isArray(val)) return escapeCsv(val.join("; "));
        return escapeCsv(val as string);
      }).join(",")
    );
  }
  return lines.join("\n");
}

async function fetchAllRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  cols: string,
  filters?: (q: any) => any,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(cols).range(from, from + 999);
    if (filters) q = filters(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

async function getAdminEmails(supabase: ReturnType<typeof createClient>) {
  const { data: adminUsers } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (!adminUsers || adminUsers.length === 0) return [];

  const adminIds = adminUsers.map((u: any) => u.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", adminIds);

  const emails: { email: string; name: string }[] = [];
  for (const id of adminIds) {
    const { data: { user } } = await supabase.auth.admin.getUserById(id);
    if (user?.email) {
      const profile = profiles?.find((p: any) => p.user_id === id);
      emails.push({ email: user.email, name: profile?.full_name || user.email });
    }
  }
  return emails;
}

async function sendBackupEmail(
  attachments: { content: string; name: string }[],
  summary: string,
  adminEmails: { email: string; name: string }[],
) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) { console.error("[Backup] BREVO_API_KEY not set"); return; }
  if (adminEmails.length === 0) return;

  const dateStr = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: { email: "info@planhogar.es", name: "Legado CRM" },
      to: adminEmails,
      subject: `🛡️ Backup semanal CRM — ${dateStr}`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#1a1a1a;">Backup semanal del CRM</h2>
          <p>Se adjuntan los backups completos de contactos e inmuebles propios.</p>
          ${summary}
          <p style="color:#888;font-size:13px;margin-top:16px;">Este email se genera automáticamente cada lunes. Guarda los archivos adjuntos en un lugar seguro fuera del CRM.</p>
        </div>`,
      attachment: attachments,
    }),
  });

  if (!res.ok) {
    console.error(`[Backup] Brevo error [${res.status}]: ${await res.text()}`);
  } else {
    console.log(`[Backup] Email sent to ${adminEmails.map((e) => e.email).join(", ")}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const mode = (body as Record<string, string>).mode || "download";
  const target = (body as Record<string, string>).target || "all"; // "contacts", "properties", "all"

  const isCron = mode === "storage-only";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (!isCron) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: adminRole } = await anonClient
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const results: Record<string, { csv: string; fileName: string; total: number }> = {};

  // ── Contacts ────────────────────────────────────────────────────────
  if (target === "contacts" || target === "all") {
    const contactCols = "id, full_name, phone, phone2, email, contact_type, pipeline_stage, status, city, address, notes, tags, agent_id, birth_date, nationality, id_number, source_ref, created_at, updated_at";
    const contacts = await fetchAllRows(supabase, "contacts", contactCols);
    if (contacts.length > 0) {
      const csv = buildCsv(contacts, contactCols.split(", "));
      const fileName = `backup-contactos-${dateStr}.csv`;
      await supabase.storage.from("contact-backups").upload(fileName, csv, { contentType: "text/csv", upsert: true });
      results.contacts = { csv, fileName, total: contacts.length };
    }
  }

  // ── Properties (solo propias, sin xml_id) ───────────────────────────
  if (target === "properties" || target === "all") {
    const propCols = "id, crm_reference, title, property_type, operation, price, owner_price, surface_area, built_area, bedrooms, bathrooms, floor_number, door, staircase, address, city, zone, province, zip_code, latitude, longitude, status, energy_cert, features, tags, agent_id, owner_id, mandate_type, mandate_start, mandate_end, commission, source, created_at, updated_at";
    const properties = await fetchAllRows(supabase, "properties", propCols, (q: any) =>
      q.or("xml_id.is.null,xml_id.eq.")
    );
    if (properties.length > 0) {
      const csv = buildCsv(properties, propCols.split(", "));
      const fileName = `backup-inmuebles-propios-${dateStr}.csv`;
      await supabase.storage.from("contact-backups").upload(fileName, csv, { contentType: "text/csv", upsert: true });
      results.properties = { csv, fileName, total: properties.length };
    }
  }

  if (Object.keys(results).length === 0) {
    return new Response(JSON.stringify({ error: "No data found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Email ───────────────────────────────────────────────────────────
  const adminEmails = await getAdminEmails(supabase);
  const attachments = Object.values(results).map((r) => ({
    content: base64Encode(new TextEncoder().encode(r.csv)),
    name: r.fileName,
  }));
  const summaryRows = Object.entries(results).map(([key, r]) =>
    `<tr><td style="padding:4px 12px;color:#666;">${key === "contacts" ? "Contactos" : "Inmuebles propios"}</td><td style="padding:4px 12px;font-weight:bold;">${r.total.toLocaleString("es-ES")}</td><td style="padding:4px 12px;">${r.fileName}</td></tr>`
  ).join("");
  const summaryHtml = `<table style="border-collapse:collapse;margin:16px 0;"><tr><th style="padding:4px 12px;text-align:left;">Tipo</th><th style="padding:4px 12px;text-align:left;">Total</th><th style="padding:4px 12px;text-align:left;">Archivo</th></tr>${summaryRows}</table>`;

  await sendBackupEmail(attachments, summaryHtml, adminEmails);

  if (isCron) {
    return new Response(JSON.stringify({
      ok: true,
      contacts: results.contacts?.total || 0,
      properties: results.properties?.total || 0,
      emailed: true,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // For manual download: if single target, return that CSV; if all, return contacts CSV (properties also emailed)
  const downloadTarget = target === "properties" ? results.properties : results.contacts;
  if (!downloadTarget) {
    return new Response(JSON.stringify({ ok: true, emailed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(downloadTarget.csv, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadTarget.fileName}"`,
    },
  });
});
