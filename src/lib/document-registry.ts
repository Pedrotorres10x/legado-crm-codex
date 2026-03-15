import { supabase } from '@/integrations/supabase/client';

type RegisterDocumentParams = {
  bucketId: string;
  storagePath: string;
  fileName: string;
  title?: string | null;
  documentKind: string;
  sourceContext: 'contact' | 'property' | 'contract' | 'general';
  notes?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  expiresAt?: string | null;
  uploadedBy?: string | null;
  contractId?: string | null;
  contactLinks?: Array<{ contactId: string; linkRole?: string }>;
  propertyIds?: string[];
};

export const registerDocument = async ({
  bucketId,
  storagePath,
  fileName,
  title,
  documentKind,
  sourceContext,
  notes,
  mimeType,
  sizeBytes,
  expiresAt,
  uploadedBy,
  contractId,
  contactLinks = [],
  propertyIds = [],
}: RegisterDocumentParams) => {
  const { data: document, error: documentError } = await supabase
    .from('documents')
    .upsert(
      {
        bucket_id: bucketId,
        storage_path: storagePath,
        file_name: fileName,
        title: title || fileName,
        document_kind: documentKind,
        source_context: sourceContext,
        notes: notes || null,
        mime_type: mimeType || null,
        size_bytes: sizeBytes ?? null,
        expires_at: expiresAt || null,
        uploaded_by: uploadedBy || null,
        contract_id: contractId || null,
      },
      { onConflict: 'bucket_id,storage_path' },
    )
    .select('id')
    .single();

  if (documentError || !document) {
    return { error: documentError ?? new Error('No se pudo registrar el documento') };
  }

  if (contactLinks.length > 0) {
    const { error } = await supabase.from('document_contacts').upsert(
      contactLinks.map((link) => ({
        document_id: document.id,
        contact_id: link.contactId,
        link_role: link.linkRole || 'related',
      })),
      { onConflict: 'document_id,contact_id' },
    );

    if (error) return { error };
  }

  if (propertyIds.length > 0) {
    const { error } = await supabase.from('document_properties').upsert(
      propertyIds.map((propertyId) => ({
        document_id: document.id,
        property_id: propertyId,
      })),
      { onConflict: 'document_id,property_id' },
    );

    if (error) return { error };
  }

  return { data: document };
};

export const unregisterDocument = async (bucketId: string, storagePath: string) => {
  return supabase
    .from('documents')
    .delete()
    .eq('bucket_id', bucketId)
    .eq('storage_path', storagePath);
};
