import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, isPast } from 'date-fns';

import { supabase } from '@/integrations/supabase/client';
import { registerDocument, unregisterDocument } from '@/lib/document-registry';
import {
  analyzePropertyDocumentUpload,
  applySafePropertyUpdates,
  isAiAnalyzablePropertyDocument,
} from '@/lib/property-document-ai';
import {
  createContactStubForPropertyHolder,
  findExistingContactsForHolder,
  linkExistingContactAsPropertyOwner,
} from '@/lib/document-onboarding';
import { buildLegalTrafficLight, parseAiSummaryFromNotes, type ParsedAiSummary } from '@/lib/property-legal-risk';

const HORUS_DOCS = [
  { type: 'nota_simple', label: 'Nota Simple', required_phases: ['disponible', 'reservado', 'arras'], has_expiry: true },
  { type: 'cee', label: 'Certificado Energético (CEE)', required_phases: ['disponible', 'reservado', 'arras'], has_expiry: true },
  { type: 'catastro', label: 'Referencia Catastral', required_phases: ['disponible', 'reservado', 'arras'], has_expiry: false },
  { type: 'mandato', label: 'Mandato / Encargo', required_phases: ['disponible', 'reservado', 'arras'], has_expiry: true },
  { type: 'ibi', label: 'Recibo IBI', required_phases: ['disponible', 'reservado', 'arras'], has_expiry: true },
  { type: 'comunidad', label: 'Certificado Comunidad', required_phases: ['arras'], has_expiry: true },
  { type: 'cedula', label: 'Cédula de Habitabilidad', required_phases: ['arras'], has_expiry: true },
  { type: 'escritura', label: 'Escritura de Propiedad', required_phases: ['arras'], has_expiry: false },
  { type: 'planos', label: 'Planos', required_phases: ['disponible'], has_expiry: false },
  { type: 'fotos_certificadas', label: 'Fotos Certificadas', required_phases: ['disponible'], has_expiry: false },
];

const ALL_DOC_TYPES = [
  ...HORUS_DOCS.map((doc) => ({ value: doc.type, label: doc.label })),
  { value: 'otro', label: 'Otro documento' },
];

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

type NewDocState = {
  doc_type: string;
  label: string;
  expires_at: string;
  file: File | null;
};

type PropertyDocumentRow = {
  id: string;
  property_id: string;
  doc_type: string;
  label: string;
  file_url: string | null;
  file_name: string | null;
  expires_at: string | null;
  is_required?: boolean | null;
  uploaded_by?: string | null;
  notes: string | null;
  created_at: string;
};

type PropertyAnalysisRow = {
  reference: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  zip_code: string | null;
  surface_area: number | null;
  built_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_number: string | null;
  property_type: string | null;
  energy_cert: string | null;
  description: string | null;
};

type OwnerSuggestion = {
  id: string;
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  id_number?: string | null;
  contact_type?: string | null;
  match_score: number;
  match_reason: string;
};

export const usePropertyDocumentsManager = ({
  propertyId,
  propertyStatus,
  userId,
  toast,
}: {
  propertyId: string;
  propertyStatus: string;
  userId?: string;
  toast: ToastFn;
}) => {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<PropertyDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reanalyzingDocId, setReanalyzingDocId] = useState<string | null>(null);
  const [reanalyzingAll, setReanalyzingAll] = useState(false);
  const [resolvingHolder, setResolvingHolder] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingDoc, setLinkingDoc] = useState<PropertyDocumentRow | null>(null);
  const [linkingOwnerName, setLinkingOwnerName] = useState('');
  const [ownerSuggestions, setOwnerSuggestions] = useState<OwnerSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newDoc, setNewDoc] = useState<NewDocState>({ doc_type: '', label: '', expires_at: '', file: null });

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from('property_documents')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: true });

    setDocs((data || []) as PropertyDocumentRow[]);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  const requiredTypes = HORUS_DOCS.filter((doc) => doc.required_phases.includes(propertyStatus)).map((doc) => doc.type);
  const uploadedTypes = docs.map((doc) => doc.doc_type);
  const missingRequired = requiredTypes.filter((docType) => !uploadedTypes.includes(docType));
  const expiringDocs = docs.filter((doc) =>
    doc.expires_at && differenceInDays(new Date(doc.expires_at), new Date()) <= 30 && !isPast(new Date(doc.expires_at)),
  );
  const expiredDocs = docs.filter((doc) => doc.expires_at && isPast(new Date(doc.expires_at)));
  const completionPct = requiredTypes.length > 0
    ? Math.round(((requiredTypes.length - missingRequired.length) / requiredTypes.length) * 100)
    : 100;

  const getAiSummary = (notes?: string | null): ParsedAiSummary | null => parseAiSummaryFromNotes(notes);

  const runAnalysisForDocument = async (doc: Pick<PropertyDocumentRow, 'id' | 'file_url' | 'file_name' | 'label' | 'doc_type'>) => {
    if (!doc.file_url || !isAiAnalyzablePropertyDocument(doc.doc_type)) return null;

    const { data: property } = await supabase
      .from('properties')
      .select('reference, address, city, province, zip_code, surface_area, built_area, bedrooms, bathrooms, floor_number, property_type, energy_cert, description')
      .eq('id', propertyId)
      .single();

    const propertyRecord = property as PropertyAnalysisRow | null;
    if (!propertyRecord) throw new Error('No se ha podido cargar la ficha del inmueble para reanalizar.');

    const analysis = await analyzePropertyDocumentUpload({
      fileUrl: doc.file_url,
      fileName: doc.file_name || doc.label || doc.doc_type,
      docType: doc.doc_type,
      property: propertyRecord,
      propertyId,
    });

    if (analysis) {
      await supabase.from('property_documents').update({ notes: analysis.notes }).eq('id', doc.id);
      await applySafePropertyUpdates(propertyId, analysis.suggestedUpdates);
    }

    return analysis;
  };

  const handleUpload = async () => {
    if (!newDoc.doc_type) return;

    setUploading(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let storagePath: string | null = null;

      if (newDoc.file) {
        const ext = newDoc.file.name.split('.').pop();
        const path = `${propertyId}/${newDoc.doc_type}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('property-documents').upload(path, newDoc.file);
        if (uploadError) throw uploadError;
        storagePath = path;
        const { data: urlData } = supabase.storage.from('property-documents').getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileName = newDoc.file.name;
      }

      const label = newDoc.label || ALL_DOC_TYPES.find((docType) => docType.value === newDoc.doc_type)?.label || newDoc.doc_type;
      const { data: insertedDoc, error } = await supabase
        .from('property_documents')
        .insert({
          property_id: propertyId,
          doc_type: newDoc.doc_type,
          label,
          file_url: fileUrl,
          file_name: fileName,
          expires_at: newDoc.expires_at || null,
          is_required: requiredTypes.includes(newDoc.doc_type),
          uploaded_by: userId,
        })
        .select('id')
        .single();

      if (error) throw error;

      if (newDoc.file && storagePath) {
        const registryResult = await registerDocument({
          bucketId: 'property-documents',
          storagePath,
          fileName: fileName || newDoc.file.name,
          title: label,
          documentKind: newDoc.doc_type,
          sourceContext: 'property',
          mimeType: newDoc.file.type,
          sizeBytes: newDoc.file.size,
          expiresAt: newDoc.expires_at || null,
          uploadedBy: userId,
          propertyIds: [propertyId],
        });

        if (registryResult.error) {
          toast({
            title: 'Documento subido, pero no registrado',
            description: 'El archivo existe, pero falta enlazarlo al expediente del inmueble.',
            variant: 'destructive',
          });
        }
      }

      if (insertedDoc?.id && fileUrl && isAiAnalyzablePropertyDocument(newDoc.doc_type)) {
        setAnalyzing(true);
        try {
          const analysis = await runAnalysisForDocument({
            id: insertedDoc.id,
            file_url: fileUrl,
            file_name: fileName || newDoc.file?.name || label,
            label,
            doc_type: newDoc.doc_type,
          });

          if (analysis) {
            toast({
              title: analysis.inconsistencies.length > 0 ? 'IA: inconsistencias detectadas' : 'IA: documento analizado',
              description: analysis.inconsistencies.length > 0
                ? `${analysis.inconsistencies.length} posible(s) discrepancia(s) encontrada(s) en ${label}.`
                : Object.keys(analysis.suggestedUpdates).length > 0
                  ? `Se completaron ${Object.keys(analysis.suggestedUpdates).length} campo(s) vacio(s) de la ficha.`
                  : `No se detectaron inconsistencias en ${label}.`,
              variant: analysis.inconsistencies.length > 0 ? 'destructive' : 'default',
            });
          }
        } catch (analysisError: unknown) {
          toast({
            title: 'Documento subido, pero analisis IA incompleto',
            description: analysisError instanceof Error ? analysisError.message : 'No se pudo completar el cruce automatico.',
            variant: 'destructive',
          });
        } finally {
          setAnalyzing(false);
        }
      }

      toast({ title: '✅ Documento añadido' });
      setShowAdd(false);
      setNewDoc({ doc_type: '', label: '', expires_at: '', file: null });
      await fetchDocs();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo subir el documento', variant: 'destructive' });
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleReanalyzeDocument = async (doc: PropertyDocumentRow) => {
    setReanalyzingDocId(doc.id);
    try {
      const analysis = await runAnalysisForDocument(doc);
      await fetchDocs();
      if (analysis) {
        toast({
          title: 'Documento reanalizado',
          description: analysis.inconsistencies.length > 0
            ? `${doc.label}: ${analysis.inconsistencies.length} aviso(s) tras la nueva revision.`
            : `${doc.label} actualizado con el informe IA mas reciente.`,
          variant: analysis.inconsistencies.length > 0 ? 'destructive' : 'default',
        });
      }
    } catch (error: unknown) {
      toast({
        title: 'No se pudo reanalizar el documento',
        description: error instanceof Error ? error.message : 'Ha fallado la reanalisis automatica.',
        variant: 'destructive',
      });
    } finally {
      setReanalyzingDocId(null);
    }
  };

  const handleReanalyzeAll = async () => {
    const analyzableDocs = docs.filter((doc) => doc.file_url && isAiAnalyzablePropertyDocument(doc.doc_type));
    if (analyzableDocs.length === 0) {
      toast({
        title: 'Sin documentos analizables',
        description: 'Este inmueble no tiene nota simple, catastro o escritura con archivo para reanalizar.',
      });
      return;
    }

    setReanalyzingAll(true);
    try {
      for (const doc of analyzableDocs) {
        await runAnalysisForDocument(doc);
      }
      await fetchDocs();
      toast({
        title: 'Expediente reanalizado',
        description: `He actualizado ${analyzableDocs.length} documento(s) con la capa juridica nueva.`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Reanalisis incompleta',
        description: error instanceof Error ? error.message : 'No se pudieron refrescar todos los documentos analizables.',
        variant: 'destructive',
      });
    } finally {
      setReanalyzingAll(false);
      setReanalyzingDocId(null);
    }
  };

  const handleDelete = async (doc: PropertyDocumentRow) => {
    if (doc.file_url) {
      const path = doc.file_url.split('/property-documents/')[1];
      if (path) {
        await supabase.storage.from('property-documents').remove([path]);
        await unregisterDocument('property-documents', path);
      }
    }
    await supabase.from('property_documents').delete().eq('id', doc.id);
    await fetchDocs();
  };

  const refreshOwnerNotes = async (doc: PropertyDocumentRow, ownerName: string) => {
    const updatedNotes = (doc.notes || '').replace(`- Falta alta en CRM: ${ownerName}`, `- Vinculado: ${ownerName}`);
    await supabase.from('property_documents').update({ notes: updatedNotes }).eq('id', doc.id);
  };

  const handleCreatePendingOwner = async (doc: PropertyDocumentRow, ownerName: string) => {
    setResolvingHolder(`${doc.id}:${ownerName}`);
    try {
      const result = await createContactStubForPropertyHolder({ fullName: ownerName, propertyId, agentId: userId });
      await refreshOwnerNotes(doc, ownerName);
      toast({
        title: result.created ? 'Titular creado y vinculado' : 'Titular vinculado',
        description: result.created
          ? `${ownerName} se ha creado como contacto y ha quedado vinculado al inmueble.`
          : `${ownerName} ya existia en CRM y ha quedado vinculado al inmueble.`,
      });
      await fetchDocs();
      navigate(`/contacts/${result.contactId}`);
    } catch (error: unknown) {
      toast({
        title: 'No se pudo crear el titular',
        description: error instanceof Error ? error.message : 'Ha fallado la alta automatica del contacto.',
        variant: 'destructive',
      });
    } finally {
      setResolvingHolder(null);
    }
  };

  const openLinkExistingDialog = async (doc: PropertyDocumentRow, ownerName: string) => {
    setResolvingHolder(`${doc.id}:${ownerName}:search`);
    setLinkingDoc(doc);
    setLinkingOwnerName(ownerName);
    setLinkDialogOpen(true);
    setLoadingSuggestions(true);
    try {
      const matches = await findExistingContactsForHolder(ownerName);
      setOwnerSuggestions(matches as OwnerSuggestion[]);
    } catch (error: unknown) {
      toast({
        title: 'No se pudieron cargar sugerencias',
        description: error instanceof Error ? error.message : 'Ha fallado la busqueda de contactos existentes.',
        variant: 'destructive',
      });
      setLinkDialogOpen(false);
    } finally {
      setLoadingSuggestions(false);
      setResolvingHolder(null);
    }
  };

  const handleLinkExistingOwner = async (contact: OwnerSuggestion) => {
    if (!linkingDoc || !linkingOwnerName) return;
    setResolvingHolder(`${linkingDoc.id}:${linkingOwnerName}:link:${contact.id}`);
    try {
      await linkExistingContactAsPropertyOwner({ contactId: contact.id, propertyId });
      await refreshOwnerNotes(linkingDoc, linkingOwnerName);
      toast({
        title: 'Titular vinculado',
        description: `${contact.full_name} ha quedado vinculado como propietario del inmueble.`,
      });
      setLinkDialogOpen(false);
      setLinkingDoc(null);
      setLinkingOwnerName('');
      setOwnerSuggestions([]);
      await fetchDocs();
      navigate(`/contacts/${contact.id}`);
    } catch (error: unknown) {
      toast({
        title: 'No se pudo vincular el contacto',
        description: error instanceof Error ? error.message : 'Ha fallado la vinculacion del titular existente.',
        variant: 'destructive',
      });
    } finally {
      setResolvingHolder(null);
    }
  };

  const resetLinkingState = () => {
    setLinkingDoc(null);
    setLinkingOwnerName('');
    setOwnerSuggestions([]);
    setLoadingSuggestions(false);
  };

  const legalTrafficLight = buildLegalTrafficLight(docs.map((doc) => ({ label: doc.label, notes: doc.notes })));

  useEffect(() => {
    if (loading) return;
    const persistLegalRisk = async () => {
      await supabase
        .from('properties')
        .update({
          legal_risk_level: legalTrafficLight.level,
          legal_risk_summary: legalTrafficLight.description,
          legal_risk_docs_count: legalTrafficLight.affectedDocs,
          legal_risk_updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId);
    };
    void persistLegalRisk();
  }, [docs, loading, legalTrafficLight.level, legalTrafficLight.description, legalTrafficLight.affectedDocs, propertyId]);

  const docsWithAiIssues = docs
    .map((doc) => ({ doc, ai: getAiSummary(doc.notes) }))
    .filter((item) => item.ai?.hasIssues || (item.ai?.pendingOwnersCount || 0) > 0);
  const docsValidatedByAi = docs
    .map((doc) => ({ doc, ai: getAiSummary(doc.notes) }))
    .filter((item) => item.ai?.isValidated);

  return {
    docs,
    uploading,
    analyzing,
    reanalyzingDocId,
    reanalyzingAll,
    resolvingHolder,
    linkDialogOpen,
    setLinkDialogOpen,
    linkingDoc,
    linkingOwnerName,
    ownerSuggestions,
    loadingSuggestions,
    showAdd,
    setShowAdd,
    newDoc,
    setNewDoc,
    missingRequired,
    expiringDocs,
    expiredDocs,
    completionPct,
    legalTrafficLight,
    docsWithAiIssues,
    docsValidatedByAi,
    getAiSummary,
    handleUpload,
    handleReanalyzeDocument,
    handleReanalyzeAll,
    handleDelete,
    handleCreatePendingOwner,
    openLinkExistingDialog,
    handleLinkExistingOwner,
    resetLinkingState,
    horusDocs: HORUS_DOCS,
    allDocTypes: ALL_DOC_TYPES,
  };
};
