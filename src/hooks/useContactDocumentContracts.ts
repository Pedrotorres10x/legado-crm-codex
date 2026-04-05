import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

type SignerContact = { id: string; full_name: string; email?: string | null } | null;
type SignerSearchResult = { id: string; full_name: string; phone?: string | null; email?: string | null };
type ContractTemplateRow = { id: string; name: string; category: string | null; content: string };
type GeneratedContractRow = {
  id: string;
  content: string;
  signature_status?: string | null;
  signature_token?: string | null;
  contract_templates?: { name: string | null; category?: string | null } | null;
};
type ProfileRow = { user_id: string; full_name: string | null };
type ContractSignerRow = {
  signer_label: string;
  signature_token: string;
  signature_status?: string | null;
  signer_name?: string | null;
  signer_email?: string | null;
  signer_id_number?: string | null;
  signed_at?: string | null;
  signer_ip?: string | null;
  signer_user_agent?: string | null;
  otp_verified?: boolean | null;
  otp_attempts?: number | null;
  signature_hash?: string | null;
  document_hash?: string | null;
  signature_url?: string | null;
};
type ContractContentRow = { content: string | null };

export function useContactDocumentContracts({
  contactId,
  contactName,
  bucket,
  bucketPath,
}: {
  contactId: string;
  contactName?: string;
  bucket: string;
  bucketPath: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [contracts, setContracts] = useState<GeneratedContractRow[]>([]);
  const [templates, setTemplates] = useState<ContractTemplateRow[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [newContractOpen, setNewContractOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [generatingContract, setGeneratingContract] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewSignatureUrl, setPreviewSignatureUrl] = useState<string | null>(null);

  const [sendFileToSignOpen, setSendFileToSignOpen] = useState(false);
  const [fileToSign, setFileToSign] = useState<string | null>(null);
  const [sendingFileToSign, setSendingFileToSign] = useState(false);

  const [signerCountOpen, setSignerCountOpen] = useState(false);
  const [signerCount, setSignerCount] = useState(1);
  const [pendingContractId, setPendingContractId] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<{ label: string; token: string }[]>([]);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [sendingToSign, setSendingToSign] = useState(false);

  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [certContract, setCertContract] = useState<(GeneratedContractRow & { template_name: string }) | null>(null);
  const [certSigners, setCertSigners] = useState<ContractSignerRow[]>([]);

  const [signerContacts, setSignerContacts] = useState<SignerContact[]>([]);
  const [signerSearchTerms, setSignerSearchTerms] = useState<string[]>([]);
  const [signerSearchResults, setSignerSearchResults] = useState<SignerSearchResult[][]>([]);
  const [signerSearching, setSignerSearching] = useState<boolean[]>([]);

  const loadContracts = useCallback(async () => {
    setContractsLoading(true);
    const [contractsRes, templatesRes, profileRes] = await Promise.all([
      supabase
        .from('generated_contracts')
        .select('*, contract_templates(name, category)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false }),
      supabase.from('contract_templates').select('*').order('name'),
      supabase.from('profiles').select('*').eq('user_id', user?.id ?? '').maybeSingle(),
    ]);
    setContracts((contractsRes.data || []) as GeneratedContractRow[]);
    setTemplates((templatesRes.data || []) as ContractTemplateRow[]);
    setProfile((profileRes.data || null) as ProfileRow | null);
    setContractsLoading(false);
  }, [contactId, user?.id]);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  const fillTemplate = (content: string) => {
    const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
    const replacements: Record<string, string> = {
      '{{nombre_cliente}}': contactName || '___________',
      '{{email_cliente}}': '___________',
      '{{telefono_cliente}}': '___________',
      '{{direccion_cliente}}': '___________',
      '{{ciudad_cliente}}': '___________',
      '{{dni_cliente}}': '___________',
      '{{titulo_propiedad}}': '___________',
      '{{direccion_propiedad}}': '___________',
      '{{ciudad_propiedad}}': '___________',
      '{{provincia_propiedad}}': '___________',
      '{{cp_propiedad}}': '___________',
      '{{precio_propiedad}}': '___________',
      '{{superficie_propiedad}}': '___________',
      '{{superficie_construida}}': '___________',
      '{{habitaciones}}': '___________',
      '{{banos}}': '___________',
      '{{referencia_catastral}}': '___________',
      '{{tipo_propiedad}}': '___________',
      '{{planta}}': '___________',
      '{{fecha_actual}}': today,
      '{{nombre_agente}}': profile?.full_name || '___________',
    };

    let result = content;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.split(key).join(value);
    }
    return result;
  };

  const generateContract = async () => {
    if (!selectedTemplateId) return;
    setGeneratingContract(true);
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) {
      setGeneratingContract(false);
      return;
    }
    const filledContent = fillTemplate(template.content);
    const { error } = await supabase.from('generated_contracts').insert({
      template_id: template.id,
      contact_id: contactId,
      content: filledContent,
      agent_id: user?.id,
    });
    setGeneratingContract(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Contrato generado' });
    setNewContractOpen(false);
    setSelectedTemplateId('');
    void loadContracts();
  };

  const openSignerCountDialog = (contractId: string) => {
    setPendingContractId(contractId);
    setSignerCount(1);
    setSignerContacts([{ id: contactId, full_name: contactName || 'Contacto', email: null }]);
    setSignerSearchTerms(['']);
    setSignerSearchResults([[]]);
    setSignerSearching([false]);
    setSignerCountOpen(true);
  };

  const updateSignerCount = (newCount: number) => {
    setSignerCount(newCount);
    setSignerContacts((prev) => {
      const next = [...prev];
      while (next.length < newCount) next.push(null);
      return next.slice(0, newCount);
    });
    setSignerSearchTerms((prev) => {
      const next = [...prev];
      while (next.length < newCount) next.push('');
      return next.slice(0, newCount);
    });
    setSignerSearchResults((prev) => {
      const next = [...prev];
      while (next.length < newCount) next.push([]);
      return next.slice(0, newCount);
    });
    setSignerSearching((prev) => {
      const next = [...prev];
      while (next.length < newCount) next.push(false);
      return next.slice(0, newCount);
    });
  };

  const searchContacts = async (term: string, index: number) => {
    if (term.length < 2) {
      setSignerSearchResults((prev) => {
        const next = [...prev];
        next[index] = [];
        return next;
      });
      return;
    }
    setSignerSearching((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    const { data } = await supabase
      .from('contacts')
      .select('id, full_name, phone, email')
      .ilike('full_name', `%${term}%`)
      .limit(8);
    setSignerSearchResults((prev) => {
      const next = [...prev];
      next[index] = (data || []) as SignerSearchResult[];
      return next;
    });
    setSignerSearching((prev) => {
      const next = [...prev];
      next[index] = false;
      return next;
    });
  };

  const sendToSign = async () => {
    if (!pendingContractId) return;
    const selected = signerContacts.slice(0, signerCount);
    if (!selected.every(Boolean)) {
      toast({ title: 'Selecciona un contacto para cada firmante', variant: 'destructive' });
      return;
    }
    const ids = selected.map((contact) => contact!.id);
    if (new Set(ids).size !== ids.length) {
      toast({ title: 'No puedes asignar el mismo contacto a dos firmantes', variant: 'destructive' });
      return;
    }
    setSendingToSign(true);
    try {
      const { data: contractData } = await supabase
        .from('generated_contracts')
        .select('content')
        .eq('id', pendingContractId)
        .single();

      let contentHash: string | null = null;
      const contractContent = contractData as ContractContentRow | null;
      if (contractContent?.content) {
        const encoded = new TextEncoder().encode(contractContent.content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
        contentHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }

      const { error } = await supabase
        .from('generated_contracts')
        .update({ signature_status: 'pendiente', ...(contentHash ? { content_hash: contentHash } : {}) })
        .eq('id', pendingContractId);
      if (error) throw error;

      const signers = Array.from({ length: signerCount }, (_, index) => ({
        contract_id: pendingContractId,
        signer_label: signerContacts[index]!.full_name,
        contact_id: signerContacts[index]!.id,
        signer_email: signerContacts[index]!.email || null,
        signature_token: crypto.randomUUID(),
        signature_status: 'pendiente',
      }));

      const { data: insertedSigners, error: signersError } = await supabase
        .from('contract_signers')
        .insert(signers)
        .select('signer_label, signature_token');
      if (signersError) throw signersError;

      setGeneratedLinks((insertedSigners || []).map((signer) => ({
        label: signer.signer_label,
        token: signer.signature_token,
      })));
      setSignerCountOpen(false);
      setLinksDialogOpen(true);
      void loadContracts();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo enviar a firma', variant: 'destructive' });
    } finally {
      setSendingToSign(false);
    }
  };

  const revokeSignature = async (contractId: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: 'revoke', contract_id: contractId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: '🚫 Firma revocada', description: 'Los enlaces de firma han sido invalidados.' });
      void loadContracts();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo revocar la firma', variant: 'destructive' });
    }
  };

  const getSignUrl = (token: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-contract?token=${token}`;

  const copySignLink = (token: string) => {
    navigator.clipboard.writeText(getSignUrl(token));
    toast({ title: '🔗 Enlace copiado (con vista previa para WhatsApp)' });
  };

  const copyAllLinks = () => {
    navigator.clipboard.writeText(generatedLinks.map((link) => `${link.label}: ${getSignUrl(link.token)}`).join('\n'));
    toast({ title: '🔗 Todos los enlaces copiados' });
  };

  const handleSendFileToSign = async () => {
    if (!fileToSign) return;
    setSendingFileToSign(true);
    try {
      const filePath = `${bucketPath}/${fileToSign}`;
      const { data: fileData, error: dlError } = await supabase.storage.from(bucket).download(filePath);
      if (dlError || !fileData) throw new Error('No se pudo descargar el archivo');

      let templateId: string;
      const { data: existingTemplate } = await supabase.from('contract_templates').select('id').eq('name', 'Documento adjunto').maybeSingle();
      if (existingTemplate) {
        templateId = existingTemplate.id;
      } else {
        const { data: newTemplate, error: tplError } = await supabase
          .from('contract_templates')
          .insert({ name: 'Documento adjunto', category: 'otro', content: '', agent_id: user?.id })
          .select('id')
          .single();
        if (tplError || !newTemplate) throw new Error('No se pudo crear plantilla');
        templateId = newTemplate.id;
      }

      const displayName = fileToSign.replace(/^\d+_/, '');
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const content = `[Documento adjunto: ${displayName}]\n\nEste documento ha sido enviado a firma digital.\n\n📎 Archivo: ${urlData?.publicUrl || ''}`;

      const { data: newContract, error: insertError } = await supabase
        .from('generated_contracts')
        .insert({
          template_id: templateId,
          contact_id: contactId,
          content,
          agent_id: user?.id,
          signature_status: 'borrador',
        })
        .select('id')
        .single();

      if (insertError || !newContract) throw insertError || new Error('No se pudo crear contrato');
      setSendFileToSignOpen(false);
      setFileToSign(null);
      loadContracts();
      openSignerCountDialog(newContract.id);
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo enviar a firmar', variant: 'destructive' });
    } finally {
      setSendingFileToSign(false);
    }
  };

  const openPreview = (content: string, title: string, signatureUrl?: string) => {
    setPreviewContent(content);
    setPreviewTitle(title);
    setPreviewSignatureUrl(signatureUrl || null);
    setPreviewOpen(true);
  };

  const viewSignersCert = async (contractId: string) => {
    setCertLoading(true);
    setCertDialogOpen(true);
    const [signersRes, contractRes] = await Promise.all([
      supabase.from('contract_signers').select('*').eq('contract_id', contractId).order('created_at'),
      supabase.from('generated_contracts').select('*, contract_templates(name)').eq('id', contractId).single(),
    ]);
    setCertSigners((signersRes.data || []) as ContractSignerRow[]);
    if (contractRes.data) {
      setCertContract({
        ...(contractRes.data as GeneratedContractRow),
        template_name: (contractRes.data as GeneratedContractRow).contract_templates?.name || 'Documento',
      });
    }
    setCertLoading(false);
  };

  const openContractLinks = async (contract: GeneratedContractRow) => {
    const { data: signers } = await supabase
      .from('contract_signers')
      .select('signer_label, signature_token, signature_status')
      .eq('contract_id', contract.id);
    if (signers && signers.length > 0) {
      setGeneratedLinks((signers as ContractSignerRow[]).map((signer) => ({ label: signer.signer_label, token: signer.signature_token })));
      setLinksDialogOpen(true);
    } else if (contract.signature_token) {
      copySignLink(contract.signature_token);
    }
  };

  return {
    contracts,
    templates,
    contractsLoading,
    newContractOpen,
    setNewContractOpen,
    selectedTemplateId,
    setSelectedTemplateId,
    generatingContract,
    previewOpen,
    setPreviewOpen,
    previewContent,
    previewTitle,
    previewSignatureUrl,
    sendFileToSignOpen,
    setSendFileToSignOpen,
    fileToSign,
    setFileToSign,
    sendingFileToSign,
    signerCountOpen,
    setSignerCountOpen,
    signerCount,
    updateSignerCount,
    signerContacts,
    setSignerContacts,
    signerSearchTerms,
    setSignerSearchTerms,
    signerSearchResults,
    setSignerSearchResults,
    signerSearching,
    linksDialogOpen,
    setLinksDialogOpen,
    generatedLinks,
    sendingToSign,
    certDialogOpen,
    setCertDialogOpen,
    certLoading,
    certContract,
    certSigners,
    loadContracts,
    generateContract,
    openSignerCountDialog,
    searchContacts,
    sendToSign,
    revokeSignature,
    getSignUrl,
    copySignLink,
    copyAllLinks,
    handleSendFileToSign,
    openPreview,
    viewSignersCert,
    openContractLinks,
  };
}
