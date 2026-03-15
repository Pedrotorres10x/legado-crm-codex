import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type SignerContact = { id: string; full_name: string } | null;

export function useFreeSignatureSigning({
  refreshContracts,
}: {
  refreshContracts: () => Promise<void> | void;
}) {
  const { toast } = useToast();

  const [signerCountOpen, setSignerCountOpen] = useState(false);
  const [signerCount, setSignerCount] = useState(1);
  const [pendingContractId, setPendingContractId] = useState<string | null>(null);
  const [sendingToSign, setSendingToSign] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<{ label: string; token: string }[]>([]);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);
  const [signerContacts, setSignerContacts] = useState<SignerContact[]>([]);
  const [signerSearchTerms, setSignerSearchTerms] = useState<string[]>([]);
  const [signerSearchResults, setSignerSearchResults] = useState<Array<any[]>>([]);
  const [signerSearching, setSignerSearching] = useState<boolean[]>([]);

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
      .select('id, full_name, phone, email, contact_type')
      .ilike('full_name', `%${term}%`)
      .limit(8);

    setSignerSearchResults((prev) => {
      const next = [...prev];
      next[index] = data || [];
      return next;
    });
    setSignerSearching((prev) => {
      const next = [...prev];
      next[index] = false;
      return next;
    });
  };

  const selectContactForSigner = (index: number, contact: { id: string; full_name: string }) => {
    setSignerContacts((prev) => {
      const next = [...prev];
      next[index] = contact;
      return next;
    });
    setSignerSearchTerms((prev) => {
      const next = [...prev];
      next[index] = contact.full_name;
      return next;
    });
    setSignerSearchResults((prev) => {
      const next = [...prev];
      next[index] = [];
      return next;
    });
  };

  const clearContactForSigner = (index: number) => {
    setSignerContacts((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setSignerSearchTerms((prev) => {
      const next = [...prev];
      next[index] = '';
      return next;
    });
  };

  const updateSignerCount = (count: number) => {
    setSignerCount(count);
    setSignerContacts((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(null);
      return next.slice(0, count);
    });
    setSignerSearchTerms((prev) => {
      const next = [...prev];
      while (next.length < count) next.push('');
      return next.slice(0, count);
    });
    setSignerSearchResults((prev) => {
      const next = [...prev];
      while (next.length < count) next.push([]);
      return next.slice(0, count);
    });
    setSignerSearching((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(false);
      return next.slice(0, count);
    });
  };

  const openSignerCountDialog = (contractId: string) => {
    setPendingContractId(contractId);
    setSignerCount(1);
    setSignerContacts([null]);
    setSignerSearchTerms(['']);
    setSignerSearchResults([[]]);
    setSignerSearching([false]);
    setSignerCountOpen(true);
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
      if (contractData?.content) {
        const encoded = new TextEncoder().encode(contractData.content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
        contentHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }

      const { error } = await supabase
        .from('generated_contracts')
        .update({
          signature_status: 'pendiente',
          ...(contentHash ? { content_hash: contentHash } : {}),
        } as any)
        .eq('id', pendingContractId);
      if (error) throw error;

      const signers = Array.from({ length: signerCount }, (_, index) => ({
        contract_id: pendingContractId,
        signer_label: signerContacts[index]!.full_name,
        contact_id: signerContacts[index]!.id,
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
      await refreshContracts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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
      await refreshContracts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const getSignUrl = (token: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-contract?token=${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getSignUrl(token));
    toast({ title: '🔗 Enlace copiado (con vista previa para WhatsApp)' });
  };

  const copyAllLinks = () => {
    navigator.clipboard.writeText(generatedLinks.map((link) => `${link.label}: ${getSignUrl(link.token)}`).join('\n'));
    toast({ title: '🔗 Todos los enlaces copiados' });
  };

  return {
    signerCountOpen,
    setSignerCountOpen,
    signerCount,
    updateSignerCount,
    sendingToSign,
    generatedLinks,
    setGeneratedLinks,
    linksDialogOpen,
    setLinksDialogOpen,
    signerContacts,
    signerSearchTerms,
    setSignerSearchTerms,
    signerSearchResults,
    signerSearching,
    searchContacts,
    selectContactForSigner,
    clearContactForSigner,
    openSignerCountDialog,
    sendToSign,
    revokeSignature,
    getSignUrl,
    copyLink,
    copyAllLinks,
  };
}
