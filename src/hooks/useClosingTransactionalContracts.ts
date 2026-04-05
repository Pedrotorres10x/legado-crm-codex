import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  classifyGeneratedContract,
  detectTransactionalTemplate,
  fillTransactionalTemplate,
  type TransactionalTemplateKind,
} from '@/lib/contract-generation';

export type ContractTemplate = {
  id: string;
  name: string;
  category: string | null;
  content: string;
};

export type TransactionalContract = {
  id: string;
  signature_status: string;
  created_at: string;
  content?: string;
  contract_signers?: Array<{
    id: string;
    signer_label: string;
    signer_email?: string | null;
    signature_token: string;
    signature_status: string;
    signed_at?: string | null;
  }>;
  contract_templates?: {
    name?: string | null;
    category?: string | null;
  } | null;
};

type SignerContact = { id: string; full_name: string; email?: string | null } | null;
type SignerSearchResult = { id: string; full_name: string; phone?: string | null; email?: string | null };
type BuyerContact = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  id_number?: string | null;
} | null;
type AgentProfile = { full_name?: string | null } | null;
type PropertyOwnerContact = { id: string; full_name: string; email?: string | null } | null;
type PropertyOwnerRow = { contact?: PropertyOwnerContact | null };
type PropertyLike = {
  id: string;
  arras_buyer_id?: string | null;
} & Record<string, unknown>;
type ContractContentRow = { content: string | null };

export function useClosingTransactionalContracts({
  property,
  propertyOwners,
}: {
  property: PropertyLike;
  propertyOwners: PropertyOwnerRow[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [transactionalContracts, setTransactionalContracts] = useState<TransactionalContract[]>([]);
  const [buyerContact, setBuyerContact] = useState<BuyerContact>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile>(null);
  const [generatingKind, setGeneratingKind] = useState<TransactionalTemplateKind | null>(null);
  const [signerCountOpen, setSignerCountOpen] = useState(false);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [pendingContractId, setPendingContractId] = useState<string | null>(null);
  const [signerCount, setSignerCount] = useState(1);
  const [sendingToSign, setSendingToSign] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<{ label: string; token: string }[]>([]);
  const [signerContacts, setSignerContacts] = useState<SignerContact[]>([]);
  const [signerSearchTerms, setSignerSearchTerms] = useState<string[]>([]);
  const [signerSearchResults, setSignerSearchResults] = useState<SignerSearchResult[][]>([]);
  const [signerSearching, setSignerSearching] = useState<boolean[]>([]);
  const [revokingContractId, setRevokingContractId] = useState<string | null>(null);

  const primaryOwner = propertyOwners[0]?.contact || null;

  const refreshTransactionalContracts = async () => {
    const { data } = await supabase
      .from('generated_contracts')
      .select('id, signature_status, created_at, content, contract_templates(name, category), contract_signers(id, signer_label, signer_email, signature_token, signature_status, signed_at)')
      .eq('property_id', property.id)
      .order('created_at', { ascending: false });

    setTransactionalContracts((data as TransactionalContract[]) || []);
  };

  useEffect(() => {
    let cancelled = false;

    const loadTransactionalContext = async () => {
      const [templatesRes, contractsRes, buyerRes, profileRes] = await Promise.all([
        supabase.from('contract_templates').select('id, name, category, content').order('name'),
        supabase
          .from('generated_contracts')
          .select('id, signature_status, created_at, content, contract_templates(name, category), contract_signers(id, signer_label, signer_email, signature_token, signature_status, signed_at)')
          .eq('property_id', property.id)
          .order('created_at', { ascending: false }),
        property.arras_buyer_id
          ? supabase.from('contacts').select('id, full_name, email, phone, address, city, id_number').eq('id', property.arras_buyer_id).maybeSingle()
          : Promise.resolve({ data: null as BuyerContact }),
        user?.id
          ? supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null as AgentProfile }),
      ]);

      if (cancelled) return;

      setTemplates((templatesRes.data as ContractTemplate[]) || []);
      setTransactionalContracts((contractsRes.data as TransactionalContract[]) || []);
      setBuyerContact((buyerRes.data || null) as BuyerContact);
      setAgentProfile((profileRes.data || null) as AgentProfile);
    };

    loadTransactionalContext();

    return () => {
      cancelled = true;
    };
  }, [property.id, property.arras_buyer_id, user?.id]);

  const transactionalSummary = useMemo(() => {
    const summary: Record<TransactionalTemplateKind, TransactionalContract | null> = {
      reserva: null,
      arras: null,
    };

    transactionalContracts.forEach((contract) => {
      const kind = classifyGeneratedContract(contract);
      if (!kind || summary[kind]) return;
      summary[kind] = contract;
    });

    return summary;
  }, [transactionalContracts]);

  const transactionalReadiness = {
    reserva: {
      template: detectTransactionalTemplate(templates, 'reserva'),
      disabledReason: !buyerContact
        ? 'Falta comprador para preparar la reserva.'
        : !primaryOwner
          ? 'Falta al menos un propietario vinculado.'
          : null,
    },
    arras: {
      template: detectTransactionalTemplate(templates, 'arras'),
      disabledReason: !buyerContact
        ? 'Falta comprador para preparar arras.'
        : !primaryOwner
          ? 'Falta al menos un propietario vinculado.'
          : null,
    },
  };

  const generateTransactionalDraft = async (kind: TransactionalTemplateKind) => {
    const template = detectTransactionalTemplate(templates, kind);
    if (!template) {
      toast({
        title: 'Falta plantilla',
        description: `No he encontrado una plantilla de ${kind}.`,
        variant: 'destructive',
      });
      return;
    }

    setGeneratingKind(kind);
    try {
      const filledContent = fillTransactionalTemplate({
        content: template.content,
        property,
        buyer: buyerContact,
        seller: primaryOwner,
        agentName: agentProfile?.full_name,
      });

      const primaryContactId = buyerContact?.id || primaryOwner?.id || null;

      const { error } = await supabase.from('generated_contracts').insert({
        template_id: template.id,
        property_id: property.id,
        contact_id: primaryContactId,
        content: filledContent,
        agent_id: user?.id,
        signature_status: 'borrador',
      });

      if (error) throw error;

      await refreshTransactionalContracts();
      toast({ title: `✅ Borrador de ${kind} generado` });
    } catch (error: unknown) {
      toast({
        title: `Error generando ${kind}`,
        description: error instanceof Error ? error.message : 'No se pudo generar el borrador.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingKind(null);
    }
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

  const openSignerDialog = (contract: TransactionalContract) => {
    const defaultBuyer = buyerContact
      ? {
          id: buyerContact.id,
          full_name: buyerContact.full_name,
          email: buyerContact.email || null,
        }
      : null;

    setPendingContractId(contract.id);
    setGeneratedLinks([]);
    setSignerCount(1);
    setSignerContacts([defaultBuyer]);
    setSignerSearchTerms([defaultBuyer?.full_name || '']);
    setSignerSearchResults([[]]);
    setSignerSearching([false]);
    setSignerCountOpen(true);
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

  const getSignUrl = (token: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-contract?token=${token}`;

  const copySignLink = async (token: string) => {
    await navigator.clipboard.writeText(getSignUrl(token));
    toast({ title: '🔗 Enlace copiado' });
  };

  const copyAllLinks = async () => {
    const text = generatedLinks.map((link) => `${link.label}: ${getSignUrl(link.token)}`).join('\n');
    await navigator.clipboard.writeText(text);
    toast({ title: '🔗 Todos los enlaces copiados' });
  };

  const sendTransactionalToSign = async () => {
    if (!pendingContractId) return;

    const selectedSigners = signerContacts.slice(0, signerCount);
    if (!selectedSigners.every(Boolean)) {
      toast({ title: 'Selecciona un contacto para cada firmante', variant: 'destructive' });
      return;
    }

    const uniqueIds = new Set(selectedSigners.map((contact) => contact!.id));
    if (uniqueIds.size !== selectedSigners.length) {
      toast({ title: 'No puedes repetir el mismo firmante', variant: 'destructive' });
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
        contentHash = Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      }

      const { error: contractError } = await supabase
        .from('generated_contracts')
        .update({
          signature_status: 'pendiente',
          ...(contentHash ? { content_hash: contentHash } : {}),
        })
        .eq('id', pendingContractId);

      if (contractError) throw contractError;

      await supabase.from('contract_signers').delete().eq('contract_id', pendingContractId);

      const { data: insertedSigners, error: signersError } = await supabase
        .from('contract_signers')
        .insert(
          selectedSigners.map((contact) => ({
            contract_id: pendingContractId,
            signer_label: contact!.full_name,
            contact_id: contact!.id,
            signer_email: contact!.email || null,
            signature_token: crypto.randomUUID(),
            signature_status: 'pendiente',
          })),
        )
        .select('signer_label, signature_token');

      if (signersError) throw signersError;

      setGeneratedLinks((insertedSigners || []).map((signer) => ({ label: signer.signer_label, token: signer.signature_token })));
      setSignerCountOpen(false);
      setLinksDialogOpen(true);
      await refreshTransactionalContracts();
    } catch (error: unknown) {
      toast({
        title: 'Error enviando a firma',
        description: error instanceof Error ? error.message : 'No se pudo preparar la firma.',
        variant: 'destructive',
      });
    } finally {
      setSendingToSign(false);
    }
  };

  const openExistingLinks = (contract: TransactionalContract) => {
    const links = (contract.contract_signers || [])
      .filter((signer) => signer.signature_status !== 'revocado')
      .map((signer) => ({
        label: signer.signer_label,
        token: signer.signature_token,
      }));

    if (links.length === 0) {
      toast({
        title: 'Sin enlaces activos',
        description: 'Este contrato no tiene enlaces de firma disponibles.',
        variant: 'destructive',
      });
      return;
    }

    setGeneratedLinks(links);
    setLinksDialogOpen(true);
  };

  const revokeSignature = async (contractId: string) => {
    setRevokingContractId(contractId);
    try {
      const session = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: 'revoke', contract_id: contractId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo revocar la firma.');

      await refreshTransactionalContracts();
      toast({ title: '🚫 Firma revocada' });
    } catch (error: unknown) {
      toast({
        title: 'Error revocando firma',
        description: error instanceof Error ? error.message : 'No se pudo revocar la firma.',
        variant: 'destructive',
      });
    } finally {
      setRevokingContractId(null);
    }
  };

  return {
    agentProfile,
    buyerContact,
    copyAllLinks,
    copySignLink,
    generatedLinks,
    generatingKind,
    getSignUrl,
    linksDialogOpen,
    openExistingLinks,
    openSignerDialog,
    pendingContractId,
    refreshTransactionalContracts,
    revokeSignature,
    revokingContractId,
    searchContacts,
    sendTransactionalToSign,
    sendingToSign,
    setGeneratedLinks,
    setLinksDialogOpen,
    setSignerContacts,
    setSignerCountOpen,
    setSignerSearchResults,
    setSignerSearchTerms,
    signerContacts,
    signerCount,
    signerCountOpen,
    signerSearchResults,
    signerSearchTerms,
    signerSearching,
    templates,
    transactionalContracts,
    transactionalReadiness,
    transactionalSummary,
    updateSignerCount,
    generateTransactionalDraft,
  };
}
