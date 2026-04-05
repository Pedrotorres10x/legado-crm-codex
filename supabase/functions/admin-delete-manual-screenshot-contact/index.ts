import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, handleCors } from "../_shared/cors.ts";

type ContactRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  tags: string[] | null;
};

type LinkedDocumentRow = {
  document_id: string | null;
  documents?: {
    bucket_id?: string | null;
    storage_path?: string | null;
  } | null;
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { email, full_name } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(full_name || "").trim().toLowerCase();

    if (!normalizedEmail && !normalizedName) {
      return json({ ok: false, error: "missing_identity" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let query = supabase
      .from("contacts")
      .select("id, full_name, email, tags")
      .contains("tags", ["manual-demand-screenshot"])
      .limit(20);

    if (normalizedEmail) {
      query = query.ilike("email", normalizedEmail);
    }

    const { data: candidates, error: findError } = await query;
    if (findError) throw findError;

    const filtered = (candidates || []).filter((contact: ContactRow) => {
      if (!normalizedName) return true;
      return (contact.full_name || "").trim().toLowerCase() === normalizedName;
    });

    if (!filtered.length) {
      return json({ ok: false, error: "not_found" }, 404);
    }

    const contactIds = filtered.map((item) => item.id);

    const { data: linkedDocs, error: linkedDocsError } = await supabase
      .from("document_contacts")
      .select("document_id, documents(bucket_id, storage_path)")
      .in("contact_id", contactIds);

    if (linkedDocsError) throw linkedDocsError;

    const documentIds = Array.from(new Set(((linkedDocs || []) as LinkedDocumentRow[]).map((row) => row.document_id).filter(Boolean)));

    if (documentIds.length) {
      const storageByBucket = new Map<string, string[]>();
      for (const row of (linkedDocs || []) as LinkedDocumentRow[]) {
        const bucketId = row.documents?.bucket_id;
        const storagePath = row.documents?.storage_path;
        if (!bucketId || !storagePath) continue;
        const current = storageByBucket.get(bucketId) || [];
        current.push(storagePath);
        storageByBucket.set(bucketId, current);
      }

      for (const [bucketId, storagePaths] of storageByBucket.entries()) {
        await supabase.storage.from(bucketId).remove(storagePaths);
      }

      await supabase.from("documents").delete().in("id", documentIds);
    }

    const { error: deleteError } = await supabase
      .from("contacts")
      .delete()
      .in("id", contactIds);

    if (deleteError) throw deleteError;

    return json({
      ok: true,
      deleted_contacts: filtered.map((item) => ({
        id: item.id,
        full_name: item.full_name,
        email: item.email,
      })),
      deleted_count: filtered.length,
      deleted_documents: documentIds.length,
    });
  } catch (error) {
    console.error("[admin-delete-manual-screenshot-contact]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "cleanup_failed" }, 500);
  }
});
