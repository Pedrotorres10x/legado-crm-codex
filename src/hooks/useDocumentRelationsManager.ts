import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

type Props =
  | { contactId: string; propertyId?: never }
  | { propertyId: string; contactId?: never };

type ContactOption = Pick<Database['public']['Tables']['contacts']['Row'], 'id' | 'full_name' | 'email' | 'phone'>;
type PropertyOption = Pick<Database['public']['Tables']['properties']['Row'], 'id' | 'title' | 'address'>;
type DocumentLinkContact = {
  contact_id: string;
  link_role?: string | null;
  contacts?: ContactOption | null;
};
type DocumentLinkProperty = {
  property_id: string;
  properties?: PropertyOption | null;
};
type ManagedDocument = {
  id: string;
  title: string | null;
  file_name: string | null;
  document_kind: string | null;
  source_context: string | null;
  bucket_id: string;
  storage_path: string;
  contract_id: string | null;
  expires_at: string | null;
  created_at: string;
  document_contacts?: DocumentLinkContact[] | null;
  document_properties?: DocumentLinkProperty[] | null;
  generated_contracts?: { id: string; signature_status: string | null } | null;
};
type InsertedSigner = { signer_label: string; signature_token: string };

export const useDocumentRelationsManager = ({
  props,
  userId,
  toast,
}: {
  props: Props;
  userId?: string;
  toast: ToastFn;
}) => {
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ManagedDocument[]>([]);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ManagedDocument | null>(null);
  const [signerCount, setSignerCount] = useState(1);
  const [signerContacts, setSignerContacts] = useState<Array<{ id: string; full_name: string; email?: string | null } | null>>([]);
  const [signerSearchTerms, setSignerSearchTerms] = useState<string[]>([]);
  const [signerSearchResults, setSignerSearchResults] = useState<ContactOption[][]>([]);
  const [signerSearching, setSignerSearching] = useState<boolean[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<{ label: string; token: string }[]>([]);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingDocument, setLinkingDocument] = useState<ManagedDocument | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [contactResults, setContactResults] = useState<ContactOption[]>([]);
  const [propertyResults, setPropertyResults] = useState<PropertyOption[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Array<{ id: string; full_name: string }>>([]);
  const [selectedProperties, setSelectedProperties] = useState<Array<{ id: string; title?: string | null; address?: string | null }>>([]);
  const [savingLinks, setSavingLinks] = useState(false);

  const isContactContext = 'contactId' in props;

  const loadDocuments = useCallback(async () => {
    setLoading(true);

    const query = isContactContext
      ? supabase
          .from('documents')
          .select(`
            id, title, file_name, document_kind, source_context, bucket_id, storage_path, contract_id, expires_at, created_at,
            document_contacts!inner(contact_id, link_role, contacts(id, full_name, email)),
            document_properties(property_id, properties(id, title, address)),
            generated_contracts(id, signature_status)
          `)
          .eq('document_contacts.contact_id', props.contactId)
      : supabase
          .from('documents')
          .select(`
            id, title, file_name, document_kind, source_context, bucket_id, storage_path, contract_id, expires_at, created_at,
            document_contacts(contact_id, link_role, contacts(id, full_name, email)),
            document_properties!inner(property_id, properties(id, title, address)),
            generated_contracts(id, signature_status)
          `)
          .eq('document_properties.property_id', props.propertyId);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error cargando expediente documental', description: error.message, variant: 'destructive' });
      setDocuments([]);
    } else {
      setDocuments((data || []) as ManagedDocument[]);
    }
    setLoading(false);
  }, [isContactContext, props.contactId, props.propertyId, toast]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const openDocument = async (doc: ManagedDocument) => {
    setOpeningId(doc.id);
    const { data, error } = await supabase.storage.from(doc.bucket_id).createSignedUrl(doc.storage_path, 60);
    setOpeningId(null);
    if (error || !data?.signedUrl) {
      toast({ title: 'No se pudo abrir el documento', description: error?.message, variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const updateSignerCount = (newCount: number) => {
    setSignerCount(newCount);
    setSignerContacts((prev) => [...prev.slice(0, newCount), ...Array(Math.max(0, newCount - prev.length)).fill(null)]);
    setSignerSearchTerms((prev) => [...prev.slice(0, newCount), ...Array(Math.max(0, newCount - prev.length)).fill('')]);
    setSignerSearchResults((prev) => [...prev.slice(0, newCount), ...Array(Math.max(0, newCount - prev.length)).fill([])]);
    setSignerSearching((prev) => [...prev.slice(0, newCount), ...Array(Math.max(0, newCount - prev.length)).fill(false)]);
  };

  const openSignatureDialog = (doc: ManagedDocument) => {
    setSelectedDocument(doc);
    const existingContacts = (doc.document_contacts || []).map((link) => link.contacts).filter(Boolean) as ContactOption[];
    const firstContact = isContactContext
      ? existingContacts.find((contact) => contact.id === props.contactId) || existingContacts[0] || null
      : existingContacts[0] || null;

    setSignerCount(1);
    setSignerContacts([firstContact ? { id: firstContact.id, full_name: firstContact.full_name, email: firstContact.email } : null]);
    setSignerSearchTerms([firstContact?.full_name || '']);
    setSignerSearchResults([[]]);
    setSignerSearching([false]);
    setSignatureDialogOpen(true);
  };

  const openLinkDialog = (doc: ManagedDocument) => {
    setLinkingDocument(doc);
    setSelectedContacts((doc.document_contacts || []).map((link) => link.contacts).filter(Boolean).map((contact) => ({ id: contact!.id, full_name: contact!.full_name })));
    setSelectedProperties((doc.document_properties || []).map((link) => link.properties).filter(Boolean).map((property) => ({ id: property!.id, title: property!.title, address: property!.address })));
    setContactSearch('');
    setPropertySearch('');
    setContactResults([]);
    setPropertyResults([]);
    setLinkDialogOpen(true);
  };

  const searchContacts = async (term: string, index: number) => {
    if (term.length < 2) {
      setSignerSearchResults((prev) => prev.map((items, idx) => (idx === index ? [] : items)));
      return;
    }
    setSignerSearching((prev) => prev.map((value, idx) => (idx === index ? true : value)));
    const { data } = await supabase.from('contacts').select('id, full_name, phone, email').ilike('full_name', `%${term}%`).limit(8);
    setSignerSearchResults((prev) => prev.map((items, idx) => (idx === index ? data || [] : items)));
    setSignerSearching((prev) => prev.map((value, idx) => (idx === index ? false : value)));
  };

  const selectContactForSigner = (index: number, contact: { id: string; full_name: string; email?: string | null }) => {
    setSignerContacts((prev) => prev.map((value, idx) => (idx === index ? contact : value)));
    setSignerSearchTerms((prev) => prev.map((value, idx) => (idx === index ? contact.full_name : value)));
    setSignerSearchResults((prev) => prev.map((value, idx) => (idx === index ? [] : value)));
  };

  const getSignUrl = (token: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-contract?token=${token}`;
  const copySignLink = async (token: string) => {
    await navigator.clipboard.writeText(getSignUrl(token));
    toast({ title: '🔗 Enlace copiado' });
  };
  const copyAllLinks = async () => {
    await navigator.clipboard.writeText(generatedLinks.map((link) => `${link.label}: ${getSignUrl(link.token)}`).join('\n'));
    toast({ title: '🔗 Todos los enlaces copiados' });
  };

  const searchProperties = async (term: string) => {
    if (term.length < 2) return setPropertyResults([]);
    const { data } = await supabase.from('properties').select('id, title, address').or(`title.ilike.%${term}%,address.ilike.%${term}%`).limit(8);
    setPropertyResults(data || []);
  };

  const searchLinkContacts = async (term: string) => {
    if (term.length < 2) return setContactResults([]);
    const { data } = await supabase.from('contacts').select('id, full_name, phone, email').ilike('full_name', `%${term}%`).limit(8);
    setContactResults(data || []);
  };

  const addSelectedContact = (contact: { id: string; full_name: string }) => {
    setSelectedContacts((prev) => (prev.some((item) => item.id === contact.id) ? prev : [...prev, contact]));
    setContactSearch('');
    setContactResults([]);
  };
  const addSelectedProperty = (property: { id: string; title?: string | null; address?: string | null }) => {
    setSelectedProperties((prev) => (prev.some((item) => item.id === property.id) ? prev : [...prev, property]));
    setPropertySearch('');
    setPropertyResults([]);
  };
  const removeSelectedContact = (contactId: string) => setSelectedContacts((prev) => prev.filter((contact) => contact.id !== contactId));
  const removeSelectedProperty = (propertyId: string) => setSelectedProperties((prev) => prev.filter((property) => property.id !== propertyId));

  const saveDocumentLinks = async () => {
    if (!linkingDocument) return;
    setSavingLinks(true);
    try {
      const currentContactIds = new Set((linkingDocument.document_contacts || []).map((link) => link.contact_id));
      const currentPropertyIds = new Set((linkingDocument.document_properties || []).map((link) => link.property_id));
      const desiredContactIds = new Set(selectedContacts.map((contact) => contact.id));
      const desiredPropertyIds = new Set(selectedProperties.map((property) => property.id));
      const contactsToAdd = selectedContacts.filter((contact) => !currentContactIds.has(contact.id));
      const contactsToRemove = [...currentContactIds].filter((id) => !desiredContactIds.has(id as string));
      const propertiesToAdd = selectedProperties.filter((property) => !currentPropertyIds.has(property.id));
      const propertiesToRemove = [...currentPropertyIds].filter((id) => !desiredPropertyIds.has(id as string));

      if (contactsToAdd.length > 0) {
        const { error } = await supabase.from('document_contacts').upsert(
          contactsToAdd.map((contact) => ({ document_id: linkingDocument.id, contact_id: contact.id, link_role: 'related' })),
          { onConflict: 'document_id,contact_id' },
        );
        if (error) throw error;
      }
      if (contactsToRemove.length > 0) {
        const { error } = await supabase.from('document_contacts').delete().eq('document_id', linkingDocument.id).in('contact_id', contactsToRemove);
        if (error) throw error;
      }
      if (propertiesToAdd.length > 0) {
        const { error } = await supabase.from('document_properties').upsert(
          propertiesToAdd.map((property) => ({ document_id: linkingDocument.id, property_id: property.id })),
          { onConflict: 'document_id,property_id' },
        );
        if (error) throw error;
      }
      if (propertiesToRemove.length > 0) {
        const { error } = await supabase.from('document_properties').delete().eq('document_id', linkingDocument.id).in('property_id', propertiesToRemove);
        if (error) throw error;
      }

      toast({ title: '✅ Relaciones del documento actualizadas' });
      setLinkDialogOpen(false);
      await loadDocuments();
    } catch (error) {
      toast({ title: 'Error guardando relaciones', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    } finally {
      setSavingLinks(false);
    }
  };

  const ensureAttachmentTemplate = async () => {
    const { data: existingTemplate } = await supabase.from('contract_templates').select('id').eq('name', 'Documento adjunto').maybeSingle();
    if (existingTemplate) return existingTemplate.id;
    const { data: newTemplate, error } = await supabase
      .from('contract_templates')
      .insert({ name: 'Documento adjunto', category: 'otro', content: '', agent_id: userId })
      .select('id')
      .single();
    if (error || !newTemplate) throw error || new Error('No se pudo crear la plantilla de documento adjunto');
    return newTemplate.id;
  };

  const prepareDocumentForSignature = async () => {
    if (!selectedDocument) return;
    const chosenSigners = signerContacts.slice(0, signerCount);
    if (!chosenSigners.every(Boolean)) return toast({ title: 'Selecciona un contacto para cada firmante', variant: 'destructive' });
    if (new Set(chosenSigners.map((contact) => contact!.id)).size !== chosenSigners.length) {
      return toast({ title: 'No puedes repetir el mismo firmante', variant: 'destructive' });
    }

    setPreparingId(selectedDocument.id);
    try {
      const templateId = await ensureAttachmentTemplate();
      const signedUrlRes = await supabase.storage.from(selectedDocument.bucket_id).createSignedUrl(selectedDocument.storage_path, 300);
      if (signedUrlRes.error || !signedUrlRes.data?.signedUrl) throw new Error(signedUrlRes.error?.message || 'No se pudo acceder al documento original');

      const fileResponse = await fetch(signedUrlRes.data.signedUrl);
      if (!fileResponse.ok) throw new Error('No se pudo descargar el documento original');
      const blob = await fileResponse.blob();

      const publicPath = `${selectedDocument.id}/${Date.now()}_${selectedDocument.file_name}`;
      const uploadRes = await supabase.storage.from('signature-documents').upload(publicPath, blob, { contentType: blob.type || undefined, upsert: true });
      if (uploadRes.error) throw uploadRes.error;

      const { data: publicUrlData } = supabase.storage.from('signature-documents').getPublicUrl(publicPath);
      const content = `[Documento adjunto: ${selectedDocument.title}]\n\nEste documento ha sido enviado a firma digital.\n\n📎 Archivo: ${publicUrlData.publicUrl}`;
      const primaryPropertyId = selectedDocument.document_properties?.[0]?.property_id || null;
      const primaryContactId = isContactContext ? props.contactId : chosenSigners[0]!.id;

      const { data: newContract, error: contractError } = await supabase
        .from('generated_contracts')
        .insert({
          template_id: templateId,
          contact_id: primaryContactId,
          property_id: primaryPropertyId,
          content,
          agent_id: userId,
          signature_status: 'pendiente',
        })
        .select('id, content')
        .single();

      if (contractError || !newContract) throw contractError || new Error('No se pudo crear la firma del documento');

      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newContract.content));
      const contentHash = Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      await supabase.from('generated_contracts').update({ content_hash: contentHash }).eq('id', newContract.id);

      const { data: insertedSigners, error: signersError } = await supabase
        .from('contract_signers')
        .insert(
          chosenSigners.map((contact) => ({
            contract_id: newContract.id,
            signer_label: contact!.full_name,
            contact_id: contact!.id,
            signer_email: contact!.email || null,
            signature_token: crypto.randomUUID(),
            signature_status: 'pendiente',
          })),
        )
        .select('signer_label, signature_token');

      if (signersError) throw signersError;

      await supabase.from('documents').update({ contract_id: newContract.id }).eq('id', selectedDocument.id);
      await supabase.from('document_contacts').upsert(
        chosenSigners.map((contact) => ({ document_id: selectedDocument.id, contact_id: contact!.id, link_role: 'signer' })),
        { onConflict: 'document_id,contact_id' },
      );

      setGeneratedLinks(((insertedSigners || []) as InsertedSigner[]).map((signer) => ({ label: signer.signer_label, token: signer.signature_token })));
      setSignatureDialogOpen(false);
      setLinksDialogOpen(true);
      await loadDocuments();
      toast({ title: '✅ Documento preparado para firma' });
    } catch (error) {
      toast({ title: 'Error preparando firma', description: error instanceof Error ? error.message : 'Error desconocido', variant: 'destructive' });
    } finally {
      setPreparingId(null);
    }
  };

  return {
    isContactContext,
    loading,
    openingId,
    preparingId,
    documents,
    signatureDialogOpen,
    setSignatureDialogOpen,
    selectedDocument,
    signerCount,
    updateSignerCount,
    signerContacts,
    setSignerContacts,
    signerSearchTerms,
    setSignerSearchTerms,
    signerSearchResults,
    signerSearching,
    searchContacts,
    selectContactForSigner,
    generatedLinks,
    linksDialogOpen,
    setLinksDialogOpen,
    linkDialogOpen,
    setLinkDialogOpen,
    linkingDocument,
    contactSearch,
    setContactSearch,
    propertySearch,
    setPropertySearch,
    contactResults,
    propertyResults,
    selectedContacts,
    selectedProperties,
    savingLinks,
    openDocument,
    openSignatureDialog,
    openLinkDialog,
    getSignUrl,
    copySignLink,
    copyAllLinks,
    searchLinkContacts,
    searchProperties,
    addSelectedContact,
    addSelectedProperty,
    removeSelectedContact,
    removeSelectedProperty,
    saveDocumentLinks,
    prepareDocumentForSignature,
  };
};
