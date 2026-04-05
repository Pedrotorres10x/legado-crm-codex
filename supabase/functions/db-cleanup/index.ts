import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { sendBrevoEmail } from '../_shared/brevo.ts';
import { sendWhatsApp } from '../_shared/greenapi.ts';

/**
 * db-cleanup — Campaña automática de depuración de base de datos.
 *
 * Acciones:
 *  1. Eliminar contactos sin teléfono NI email (excluye protegidos por FK)
 *  2. Reclasificar empresas como Colaborador (tag 'API externo')
 *  3. Marcar duplicados (teléfono/email)
 *  4. Notificar al agente antes de borrar
 *
 * Solo envía email si hubo cambios reales.
 *
 * POST body: { dry_run?: boolean }
 */

const BUSINESS_KEYWORDS = [
  'inmobiliaria', 'real estate', 'agency', 'agencia', 's.l.', 's.l',
  'consulting', 'properties', 'realty', 'group', 'inversiones',
  'gestión', 'gestion', 'advisors', 'partners', 'holding',
];

type BasicContactRow = { id: string; full_name: string; agent_id: string | null; email?: string | null; tags?: string[] | null };
type ProtectedContactRow = { id: string; name: string; agent_id: string | null; reason: string };
type DuplicateSummaryRow = { id1: string; id2: string; name1: string; name2: string; field: string; value: string };
type CleanupResults = {
  actually_deleted: { id: string; name: string; agent_id: string | null }[];
  protected_contacts: ProtectedContactRow[];
  reclassified_business: { id: string; name: string; agent_id: string | null }[];
  duplicates_found: DuplicateSummaryRow[];
  dry_run: boolean;
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body.dry_run === true;
    } catch { /* no body = run for real */ }

    const results: CleanupResults = {
      actually_deleted: [] as { id: string; name: string; agent_id: string | null }[],
      protected_contacts: [] as { id: string; name: string; agent_id: string | null; reason: string }[],
      reclassified_business: [] as { id: string; name: string; agent_id: string | null }[],
      duplicates_found: [] as { id1: string; id2: string; name1: string; name2: string; field: string; value: string }[],
      dry_run: dryRun,
    };

    // ── 1. Find contacts without phone AND email ───────────────────────────
    const allNoContact = await findContactsWithoutInfo(supabase);

    // ── 1b. Exclude contacts referenced by FK constraints ──────────────────
    const { deletable, protected: protectedContacts } = await partitionByFkRefs(supabase, allNoContact);
    results.protected_contacts = protectedContacts;

    // ── 2. Find business contacts to reclassify ────────────────────────────
    const { data: allContacts } = await supabase
      .from("contacts")
      .select("id, full_name, email, agent_id, contact_type, tags")
      .not("contact_type", "eq", "colaborador")
      .limit(1000);

    const businessContacts = ((allContacts || []) as BasicContactRow[]).filter((c) => {
      const nameLower = (c.full_name || "").toLowerCase();
      const emailLower = (c.email || "").toLowerCase();
      return BUSINESS_KEYWORDS.some(kw =>
        nameLower.includes(kw) || emailLower.includes(kw)
      );
    });

    results.reclassified_business = businessContacts.map((c) => ({
      id: c.id, name: c.full_name, agent_id: c.agent_id,
    }));

    // ── 3. Find duplicates ─────────────────────────────────────────────────
    const { data: dupes } = await supabase.rpc("find_duplicate_contacts");
    results.duplicates_found = ((dupes || []) as Array<{ contact_id_1: string; contact_id_2: string; name_1: string; name_2: string; match_field: string; match_value: string }>).map((d) => ({
      id1: d.contact_id_1, id2: d.contact_id_2,
      name1: d.name_1, name2: d.name_2,
      field: d.match_field, value: d.match_value,
    }));

    // ── Execute changes (if not dry run) ───────────────────────────────────
    if (!dryRun) {
      // Delete contacts with error handling
      results.actually_deleted = await deleteWithErrorHandling(supabase, deletable, results.protected_contacts);

      // Reclassify business contacts
      for (const bc of businessContacts) {
        const currentTags = bc.tags || [];
        const newTags = currentTags.includes("API externo")
          ? currentTags
          : [...currentTags, "API externo"];

        await supabase
          .from("contacts")
          .update({ contact_type: "colaborador", tags: newTags })
          .eq("id", bc.id);
      }

      // Mark duplicates with tag
      await tagDuplicates(supabase, results.duplicates_found);
    } else {
      // In dry run, report all deletable as "would be deleted"
      results.actually_deleted = deletable.map((c: BasicContactRow) => ({
        id: c.id, name: c.full_name, agent_id: c.agent_id,
      }));
    }

    // ── 4. Notify agents about their affected contacts ─────────────────────
    const realChanges = results.actually_deleted.length + results.reclassified_business.length;

    if (!dryRun && realChanges > 0) {
      await notifyAgents(supabase, results);
    }

    // ── 5. If real changes and >10 affected → send team summary ────────────
    if (!dryRun && realChanges > 10) {
      await sendTeamSummary(supabase, supabaseUrl, serviceKey, results);
    }

    return json({
      ok: true,
      dry_run: dryRun,
      total_affected: results.actually_deleted.length + results.reclassified_business.length + results.duplicates_found.length,
      deleted: results.actually_deleted.length,
      protected: results.protected_contacts.length,
      reclassified: results.reclassified_business.length,
      duplicates: results.duplicates_found.length,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unexpected_error";
    console.error("db-cleanup error:", message);
    return json({ ok: false, error: message }, 500);
  }
});

// ── Helper: find contacts without phone AND email ──────────────────────────
async function findContactsWithoutInfo(supabase: ReturnType<typeof createClient>) {
  const queries = [
    supabase.from("contacts").select("id, full_name, agent_id").is("phone", null).is("email", null).limit(500),
    supabase.from("contacts").select("id, full_name, agent_id").eq("phone", "").is("email", null).limit(500),
    supabase.from("contacts").select("id, full_name, agent_id").is("phone", null).eq("email", "").limit(500),
    supabase.from("contacts").select("id, full_name, agent_id").eq("phone", "").eq("email", "").limit(500),
  ];
  const results = await Promise.all(queries);
  return dedupeById(results.flatMap(r => r.data || []));
}

// ── Helper: partition contacts into deletable vs FK-protected ──────────────
async function partitionByFkRefs(supabase: ReturnType<typeof createClient>, contacts: BasicContactRow[]) {
  if (contacts.length === 0) return { deletable: [], protected: [] };

  const ids = contacts.map((c) => c.id);
  const protectedIds = new Map<string, string>(); // id → reason

  // Check properties.owner_id
  const { data: ownedProps } = await supabase
    .from("properties")
    .select("owner_id")
    .in("owner_id", ids);
  for (const p of (ownedProps || [])) {
    protectedIds.set(p.owner_id, "propietario de inmueble");
  }

  // Check generated_contracts.contact_id
  const { data: contractRefs } = await supabase
    .from("generated_contracts")
    .select("contact_id")
    .in("contact_id", ids);
  for (const g of (contractRefs || [])) {
    protectedIds.set(g.contact_id, "referenciado en contrato");
  }

  // Check contract_signers.contact_id
  const { data: signerRefs } = await supabase
    .from("contract_signers")
    .select("contact_id")
    .in("contact_id", ids)
    .not("contact_id", "is", null);
  for (const s of (signerRefs || [])) {
    protectedIds.set(s.contact_id, "firmante de contrato");
  }

  const deletable = contacts.filter((c) => !protectedIds.has(c.id));
  const protectedList = contacts
    .filter((c) => protectedIds.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.full_name,
      agent_id: c.agent_id,
      reason: protectedIds.get(c.id)!,
    }));

  return { deletable, protected: protectedList };
}

// ── Helper: delete with error handling and fallback ────────────────────────
async function deleteWithErrorHandling(
  supabase: ReturnType<typeof createClient>,
  deletable: BasicContactRow[],
  protectedList: ProtectedContactRow[],
) {
  const actuallyDeleted: { id: string; name: string; agent_id: string | null }[] = [];

  for (let i = 0; i < deletable.length; i += 50) {
    const chunk = deletable.slice(i, i + 50);
    const { error } = await supabase
      .from("contacts")
      .delete()
      .in("id", chunk.map((c) => c.id));

    if (error) {
      // Fallback: delete one by one
      for (const c of chunk) {
        const { error: e2 } = await supabase
          .from("contacts")
          .delete()
          .eq("id", c.id);
        if (e2) {
          protectedList.push({ id: c.id, name: c.full_name, agent_id: c.agent_id, reason: `FK: ${e2.message}` });
        } else {
          actuallyDeleted.push({ id: c.id, name: c.full_name, agent_id: c.agent_id });
        }
      }
    } else {
      for (const c of chunk) {
        actuallyDeleted.push({ id: c.id, name: c.full_name, agent_id: c.agent_id });
      }
    }
  }

  return actuallyDeleted;
}

// ── Helper: tag duplicates ─────────────────────────────────────────────────
async function tagDuplicates(supabase: ReturnType<typeof createClient>, duplicates: DuplicateSummaryRow[]) {
  const dupeIds = new Set<string>();
  for (const d of duplicates) {
    dupeIds.add(d.id1);
    dupeIds.add(d.id2);
  }
  for (const did of dupeIds) {
    const { data: c } = await supabase
      .from("contacts")
      .select("tags")
      .eq("id", did)
      .single();
    if (c) {
      const tags = c.tags || [];
      if (!tags.includes("posible-duplicado")) {
        await supabase
          .from("contacts")
          .update({ tags: [...tags, "posible-duplicado"] })
          .eq("id", did);
      }
    }
  }
}

// ── Helper: notify agents ──────────────────────────────────────────────────
async function notifyAgents(supabase: ReturnType<typeof createClient>, results: CleanupResults) {
  const agentMap = new Map<string, { deleted: string[]; reclassified: string[]; protected: string[] }>();

  for (const c of results.actually_deleted) {
    if (!c.agent_id) continue;
    if (!agentMap.has(c.agent_id)) agentMap.set(c.agent_id, { deleted: [], reclassified: [], protected: [] });
    agentMap.get(c.agent_id)!.deleted.push(c.name);
  }
  for (const c of results.reclassified_business) {
    if (!c.agent_id) continue;
    if (!agentMap.has(c.agent_id)) agentMap.set(c.agent_id, { deleted: [], reclassified: [], protected: [] });
    agentMap.get(c.agent_id)!.reclassified.push(c.name);
  }
  for (const c of results.protected_contacts) {
    if (!c.agent_id) continue;
    if (!agentMap.has(c.agent_id)) agentMap.set(c.agent_id, { deleted: [], reclassified: [], protected: [] });
    agentMap.get(c.agent_id)!.protected.push(`${c.name} (${c.reason})`);
  }

  for (const [agentId, data] of agentMap) {
    const lines: string[] = [];
    if (data.deleted.length > 0) lines.push(`🗑️ Eliminados: ${data.deleted.join(", ")}`);
    if (data.reclassified.length > 0) lines.push(`🏢 Reclasificados: ${data.reclassified.join(", ")}`);
    if (data.protected.length > 0) lines.push(`🛡️ Protegidos: ${data.protected.join(", ")}`);

    await supabase.from("notifications").insert({
      event_type: "db_cleanup",
      entity_type: "contact",
      entity_id: agentId,
      title: `🧹 Depuración: ${data.deleted.length} eliminados, ${data.protected.length} protegidos`,
      description: lines.join("\n").slice(0, 500),
      agent_id: agentId,
    });
  }
}

// ── Helper: send team summary ──────────────────────────────────────────────
async function sendTeamSummary(
  supabase: ReturnType<typeof createClient>, supabaseUrl: string, serviceKey: string,
  results: CleanupResults,
) {
  const { data: coordAdmin } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "coordinadora"]);

  const userIds = ((coordAdmin || []) as Array<{ user_id: string }>).map((r) => r.user_id);
  if (userIds.length === 0) return;

  const summaryLines = [
    `🧹 *Depuración BBDD completada*`,
    ``,
    `🗑️ Eliminados: ${results.actually_deleted.length}`,
    `🛡️ Protegidos (FK): ${results.protected_contacts.length}`,
    `🏢 Reclasificados: ${results.reclassified_business.length}`,
    `🔄 Duplicados: ${results.duplicates_found.length}`,
  ];

  if (results.actually_deleted.length > 0) {
    summaryLines.push(``, `*Eliminados:*`);
    for (const c of results.actually_deleted.slice(0, 20)) {
      summaryLines.push(`  • ${c.name}`);
    }
    if (results.actually_deleted.length > 20) {
      summaryLines.push(`  ... y ${results.actually_deleted.length - 20} más`);
    }
  }

  if (results.protected_contacts.length > 0) {
    summaryLines.push(``, `*Protegidos (no se pueden borrar):*`);
    for (const c of results.protected_contacts.slice(0, 10)) {
      summaryLines.push(`  • ${c.name} — ${c.reason}`);
    }
  }

  if (results.reclassified_business.length > 0) {
    summaryLines.push(``, `*Reclasificados:*`);
    for (const c of results.reclassified_business.slice(0, 20)) {
      summaryLines.push(`  • ${c.name}`);
    }
  }

  if (results.duplicates_found.length > 0) {
    summaryLines.push(``, `*Posibles duplicados:*`);
    for (const d of results.duplicates_found.slice(0, 15)) {
      summaryLines.push(`  • ${d.name1} ↔ ${d.name2} (${d.field}: ${d.value})`);
    }
  }

  const summaryText = summaryLines.join("\n");

  // Internal notifications
  const notifs = userIds.map((uid: string) => ({
    event_type: "db_cleanup",
    entity_type: "system",
    entity_id: uid,
    title: `🧹 Depuración: ${results.actually_deleted.length} eliminados, ${results.protected_contacts.length} protegidos, ${results.reclassified_business.length} reclasificados`,
    description: summaryText.slice(0, 500),
    agent_id: uid,
  }));
  await supabase.from("notifications").insert(notifs);

  // Send via WhatsApp + Email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, email")
    .in("user_id", userIds);

  for (const p of (profiles || [])) {
    if (p.phone) {
      try {
        await sendWhatsApp(p.phone, summaryText);
      } catch (err) {
        console.error(`[db-cleanup] WhatsApp to ${p.full_name} failed:`, err);
      }
    }

    if (p.email) {
      try {
        await sendBrevoEmail(
          [{ email: p.email, name: p.full_name }],
          `🧹 Depuración BBDD: ${results.actually_deleted.length} eliminados, ${results.protected_contacts.length} protegidos`,
          buildCleanupEmailHtml(results),
        );
      } catch (err) {
        console.error(`[db-cleanup] Email to ${p.full_name} failed:`, err);
      }
    }
  }
}

function buildCleanupEmailHtml(results: CleanupResults): string {
  const deletedRows = results.actually_deleted
    .slice(0, 30)
    .map((c) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${c.name}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;color:#999;">Eliminado</td></tr>`)
    .join("");

  const protectedRows = results.protected_contacts
    .slice(0, 15)
    .map((c) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${c.name}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;color:#999;">🛡️ ${c.reason}</td></tr>`)
    .join("");

  const reclassifiedRows = results.reclassified_business
    .slice(0, 30)
    .map((c) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${c.name}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;color:#999;">→ Colaborador</td></tr>`)
    .join("");

  const dupeRows = results.duplicates_found
    .slice(0, 20)
    .map((d) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${d.name1} ↔ ${d.name2}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;color:#999;">${d.field}: ${d.value}</td></tr>`)
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f7;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:20px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:#1a365d;padding:24px 30px;">
  <h1 style="margin:0;color:#fff;font-size:20px;">🧹 Depuración BBDD Completada</h1>
</td></tr>
<tr><td style="padding:30px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
    <tr>
      <td style="padding:12px;background:#fee2e2;border-radius:6px;text-align:center;width:25%;">
        <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626;">${results.actually_deleted.length}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#666;">Eliminados</p>
      </td>
      <td style="width:6px;"></td>
      <td style="padding:12px;background:#e0e7ff;border-radius:6px;text-align:center;width:25%;">
        <p style="margin:0;font-size:24px;font-weight:700;color:#4338ca;">${results.protected_contacts.length}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#666;">Protegidos</p>
      </td>
      <td style="width:6px;"></td>
      <td style="padding:12px;background:#fef3c7;border-radius:6px;text-align:center;width:25%;">
        <p style="margin:0;font-size:24px;font-weight:700;color:#d97706;">${results.reclassified_business.length}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#666;">Reclasificados</p>
      </td>
      <td style="width:6px;"></td>
      <td style="padding:12px;background:#dbeafe;border-radius:6px;text-align:center;width:25%;">
        <p style="margin:0;font-size:24px;font-weight:700;color:#2563eb;">${results.duplicates_found.length}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#666;">Duplicados</p>
      </td>
    </tr>
  </table>
  ${deletedRows ? `<h3 style="margin:16px 0 8px;font-size:14px;color:#dc2626;">🗑️ Eliminados</h3><table width="100%" style="font-size:13px;">${deletedRows}</table>` : ""}
  ${protectedRows ? `<h3 style="margin:16px 0 8px;font-size:14px;color:#4338ca;">🛡️ Protegidos (FK)</h3><table width="100%" style="font-size:13px;">${protectedRows}</table>` : ""}
  ${reclassifiedRows ? `<h3 style="margin:16px 0 8px;font-size:14px;color:#d97706;">🏢 Reclasificados</h3><table width="100%" style="font-size:13px;">${reclassifiedRows}</table>` : ""}
  ${dupeRows ? `<h3 style="margin:16px 0 8px;font-size:14px;color:#2563eb;">🔄 Posibles duplicados</h3><table width="100%" style="font-size:13px;">${dupeRows}</table>` : ""}
</td></tr>
<tr><td style="padding:16px 30px;background:#f8f9fa;border-top:1px solid #eee;">
  <p style="margin:0;font-size:12px;color:#999;text-align:center;">Legado Colección — Depuración Automática</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function dedupeById(arr: BasicContactRow[]): BasicContactRow[] {
  const seen = new Set<string>();
  return arr.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
