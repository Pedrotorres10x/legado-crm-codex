import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const BUCKET = 'property-documents';

export function useFreeSignatureManager() {
  const { user, canViewAll } = useAuth();
  const { toast } = useToast();

  const [contracts, setContracts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});

  const [newFromTemplateOpen, setNewFromTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [generating, setGenerating] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newTextOpen, setNewTextOpen] = useState(false);
  const [freeTitle, setFreeTitle] = useState('');
  const [freeContent, setFreeContent] = useState('');
  const [creatingText, setCreatingText] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const [signersDetail, setSignersDetail] = useState<any[]>([]);
  const [signersDialogOpen, setSignersDialogOpen] = useState(false);
  const [signersLoading, setSignersLoading] = useState(false);
  const [certContract, setCertContract] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);

    let contractsQuery = supabase
      .from('generated_contracts')
      .select('*, contract_templates(name, category), contract_signers(*), contacts(full_name)')
      .order('created_at', { ascending: false });

    if (!canViewAll) {
      contractsQuery = contractsQuery.eq('agent_id', user?.id ?? '');
    }

    const [contractsRes, templatesRes, profileRes] = await Promise.all([
      contractsQuery,
      supabase.from('contract_templates').select('*').order('name'),
      supabase.from('profiles').select('*').eq('user_id', user?.id ?? '').maybeSingle(),
    ]);

    const allContracts = contractsRes.data || [];
    setContracts(allContracts);
    setTemplates(templatesRes.data || []);
    setProfile(profileRes.data);

    if (canViewAll && allContracts.length > 0) {
      const agentIds = [...new Set(allContracts.map((contract: any) => contract.agent_id).filter(Boolean))];
      if (agentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', agentIds);
        const names: Record<string, string> = {};
        for (const profileItem of profiles || []) {
          names[profileItem.user_id] = profileItem.full_name;
        }
        setAgentNames(names);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const fillTemplate = (content: string) => {
    const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
    const replacements: Record<string, string> = {
      '{{fecha_actual}}': today,
      '{{nombre_agente}}': profile?.full_name || '___________',
    };
    let result = content;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.split(key).join(value);
    }
    return result.replace(/\{\{[^}]+\}\}/g, '___________');
  };

  const generateFromTemplate = async () => {
    if (!selectedTemplateId) return;
    setGenerating(true);
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) {
      setGenerating(false);
      return;
    }

    const filledContent = fillTemplate(template.content);
    const { error } = await supabase.from('generated_contracts').insert({
      template_id: template.id,
      contact_id: null,
      content: filledContent,
      agent_id: user?.id,
    });

    setGenerating(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: '✅ Documento generado' });
    setNewFromTemplateOpen(false);
    setSelectedTemplateId('');
    loadData();
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const filePath = `free-sign/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const content = `[Documento adjunto: ${file.name}]\n\nEste documento ha sido enviado a firma digital.\n\n📎 Archivo: ${urlData?.publicUrl || ''}`;

      let templateId: string;
      const { data: existingTemplate } = await supabase
        .from('contract_templates')
        .select('id')
        .eq('name', 'Documento adjunto')
        .maybeSingle();

      if (existingTemplate) {
        templateId = existingTemplate.id;
      } else {
        const { data: newTemplate, error: templateError } = await supabase
          .from('contract_templates')
          .insert({ name: 'Documento adjunto', category: 'otro', content: '', agent_id: user?.id })
          .select('id')
          .single();
        if (templateError || !newTemplate) {
          throw templateError || new Error('No se pudo crear plantilla');
        }
        templateId = newTemplate.id;
      }

      const { error: insertError } = await supabase.from('generated_contracts').insert({
        template_id: templateId,
        contact_id: null,
        content,
        agent_id: user?.id,
      });
      if (insertError) throw insertError;

      toast({ title: '✅ Documento subido y listo para firmar' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const createFromText = async () => {
    if (!freeContent.trim()) return;
    setCreatingText(true);

    try {
      let templateId: string;
      const { data: existingTemplate } = await supabase
        .from('contract_templates')
        .select('id')
        .eq('name', 'Documento libre')
        .maybeSingle();

      if (existingTemplate) {
        templateId = existingTemplate.id;
      } else {
        const { data: newTemplate, error: templateError } = await supabase
          .from('contract_templates')
          .insert({ name: 'Documento libre', category: 'otro', content: '', agent_id: user?.id })
          .select('id')
          .single();
        if (templateError || !newTemplate) {
          throw templateError || new Error('Error al crear plantilla');
        }
        templateId = newTemplate.id;
      }

      const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
      const header = freeTitle.trim() ? `${freeTitle.trim()}\n\n` : '';
      const content = `${header}${freeContent.trim()}\n\n---\nFecha: ${today}`;

      const { error } = await supabase.from('generated_contracts').insert({
        template_id: templateId,
        contact_id: null,
        content,
        agent_id: user?.id,
      });
      if (error) throw error;

      toast({ title: '✅ Documento creado' });
      setNewTextOpen(false);
      setFreeTitle('');
      setFreeContent('');
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setCreatingText(false);
    }
  };

  const viewSigners = async (contractId: string) => {
    setSignersLoading(true);
    setSignersDialogOpen(true);

    const [signersRes, contractRes] = await Promise.all([
      supabase.from('contract_signers').select('*').eq('contract_id', contractId).order('created_at'),
      supabase.from('generated_contracts').select('*, contract_templates(name)').eq('id', contractId).single(),
    ]);

    setSignersDetail(signersRes.data || []);
    if (contractRes.data) {
      setCertContract({
        ...contractRes.data,
        template_name: (contractRes.data as any).contract_templates?.name || 'Documento',
      });
    }

    setSignersLoading(false);
  };

  const deleteContract = async (id: string) => {
    await supabase.from('contract_signers').delete().eq('contract_id', id);
    const { error } = await supabase.from('generated_contracts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Documento eliminado' });
    loadData();
  };

  const openPreview = (content: string, title: string) => {
    setPreviewContent(content);
    setPreviewTitle(title);
    setPreviewOpen(true);
  };

  const downloadCertificatePdf = async (contractId: string) => {
    const [signersRes, contractRes] = await Promise.all([
      supabase.from('contract_signers').select('*').eq('contract_id', contractId).order('created_at'),
      supabase.from('generated_contracts').select('*, contract_templates(name)').eq('id', contractId).single(),
    ]);
    const signersList = signersRes.data || [];
    const contractData = contractRes.data;

    if (!contractData) {
      toast({ title: 'Error', description: 'No se encontró el contrato', variant: 'destructive' });
      return;
    }

    const templateName = (contractData as any).contract_templates?.name || 'Documento';
    const now = new Date();
    const formatDate = (date: string) => {
      try {
        return format(new Date(date), "dd/MM/yyyy HH:mm:ss", { locale: es });
      } catch {
        return date;
      }
    };
    const parseUA = (userAgent: string | null) => {
      if (!userAgent) return 'Desconocido';
      let browser = 'Otro';
      let os = 'Otro';
      if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
      else if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
      else if (userAgent.includes('Edg')) browser = 'Edge';
      if (userAgent.includes('Windows')) os = 'Windows';
      else if (userAgent.includes('Mac')) os = 'macOS';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      return `${browser} en ${os}`;
    };

    const signersHtml = signersList.map((signer: any, index: number) => `
      <div class="signer-block">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:30px;height:30px;border-radius:50%;background:#e8e0f5;display:flex;align-items:center;justify-content:center;font-weight:700;color:#6d28d9;font-size:14px">${index + 1}</div>
            <div>
              <div style="font-weight:600;font-size:14px">${signer.signer_label}</div>
              ${signer.signer_name ? `<div style="font-size:12px;color:#6b7280">${signer.signer_name}</div>` : ''}
            </div>
          </div>
          <span class="badge ${signer.signature_status === 'firmado' ? 'badge-signed' : signer.signature_status === 'revocado' ? 'badge-revoked' : 'badge-pending'}">${signer.signature_status === 'firmado' ? '✓ Firmado' : signer.signature_status === 'revocado' ? 'Revocado' : 'Pendiente'}</span>
        </div>
        <div class="grid">
          ${signer.signer_id_number ? `<div><div class="field-label">DNI/NIE</div><div class="field-value">${signer.signer_id_number}</div></div>` : ''}
          ${signer.signer_email ? `<div><div class="field-label">Email verificado</div><div class="field-value">${signer.signer_email}</div></div>` : ''}
          ${signer.signed_at ? `<div><div class="field-label">Fecha y hora de firma</div><div class="field-value">${formatDate(signer.signed_at)}</div></div>` : ''}
          ${signer.signer_ip ? `<div><div class="field-label">Dirección IP</div><div class="field-value mono">${signer.signer_ip}</div></div>` : ''}
        </div>
        ${signer.signer_user_agent ? `<div style="margin-top:8px"><div class="field-label">Dispositivo</div><div class="field-value">${parseUA(signer.signer_user_agent)}</div><div class="mono" style="font-size:10px;color:#9ca3af;margin-top:2px;word-break:break-all">${signer.signer_user_agent}</div></div>` : ''}
        <div style="margin-top:8px"><div class="field-label">OTP verificado</div><div class="field-value">${signer.otp_verified ? '✅ Sí' : '❌ No'} (${signer.otp_attempts} intentos)</div></div>
        ${signer.signature_hash ? `<div style="margin-top:8px"><div class="field-label">Hash de la firma (SHA-256)</div><div class="mono" style="font-size:10px;word-break:break-all;color:#6b7280">${signer.signature_hash}</div></div>` : ''}
        ${signer.document_hash ? `<div style="margin-top:8px"><div class="field-label">Hash del documento en el momento de firma</div><div class="mono" style="font-size:10px;word-break:break-all;color:#6b7280">${signer.document_hash}</div></div>` : ''}
        ${signer.signature_url ? `<div style="margin-top:10px"><div class="field-label">Firma manuscrita digital</div><img src="${signer.signature_url}" class="signature-img" alt="Firma" /></div>` : ''}
      </div>
    `).join('');

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html><head><title>Certificado de Firma - ${templateName}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; max-width:800px; margin:0 auto; padding:40px 30px; color:#1a1a2e; font-size:13px; line-height:1.6; }
        h1 { font-size:20px; margin-bottom:4px; }
        h2 { font-size:15px; margin:24px 0 12px; padding-bottom:6px; border-bottom:2px solid #e5e7eb; }
        .meta { color:#6b7280; font-size:12px; }
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
        .field-label { font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; }
        .field-value { font-size:13px; font-weight:500; word-break:break-all; }
        .mono { font-family:'Courier New',monospace; font-size:11px; }
        .signature-img { max-width:280px; max-height:120px; border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#fff; margin-top:4px; }
        .signer-block { border:1px solid #e5e7eb; border-radius:10px; padding:20px; margin-bottom:16px; page-break-inside:avoid; }
        .badge { display:inline-block; padding:2px 10px; border-radius:99px; font-size:11px; font-weight:600; }
        .badge-signed { background:#d1fae5; color:#065f46; }
        .badge-pending { background:#fef3c7; color:#92400e; }
        .badge-revoked { background:#fee2e2; color:#991b1b; }
        .footer { margin-top:30px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; text-align:center; }
        .doc-section { border:1px solid #e5e7eb; border-radius:8px; padding:16px; max-height:300px; overflow:hidden; font-size:12px; white-space:pre-wrap; font-family:Georgia,serif; }
        .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; padding:16px; background:#f9fafb; border-radius:10px; border:1px solid #e5e7eb; }
        @media print { body { padding:20px; } }
      </style>
      </head><body>
        <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e5e7eb">
          <h1>🛡️ Certificado de Firma Electrónica</h1>
          <p class="meta">Generado el ${format(now, "dd 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es })} · Conforme al Reglamento (UE) 910/2014 (eIDAS)</p>
        </div>
        <h2>📄 Información del documento</h2>
        <div class="info-grid">
          <div><div class="field-label">Documento</div><div class="field-value">${templateName}</div></div>
          <div><div class="field-label">Estado</div><div class="field-value">${contractData.signature_status}</div></div>
          <div><div class="field-label">Fecha de creación</div><div class="field-value">${formatDate(contractData.created_at)}</div></div>
          <div><div class="field-label">ID Contrato</div><div class="mono" style="font-size:10px;color:#6b7280">${contractData.id}</div></div>
          ${contractData.content_hash || contractData.document_hash ? `<div style="grid-column:span 2"><div class="field-label">Hash SHA-256 del documento</div><div class="mono" style="font-size:10px;word-break:break-all;color:#6b7280">${contractData.content_hash || contractData.document_hash}</div></div>` : ''}
        </div>
        <h2>📎 Contenido del documento</h2>
        ${(() => {
          const urlMatch = contractData.content?.match(/https?:\/\/[^\\s]+\\.(pdf|PDF)(?:\\?[^\\s]*)?/);
          const pdfUrl = urlMatch?.[0];
          if (pdfUrl) {
            return `<div style="margin-bottom:20px"><a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" style="color:#6d28d9;text-decoration:underline;font-size:13px">📄 Ver documento PDF adjunto ↗</a></div>`;
          }
          return `<div class="doc-section" style="margin-bottom:20px">${contractData.content?.replace(/\\n/g, '<br>') || ''}</div>`;
        })()}
        <h2>✍️ Firmantes (${signersList.length})</h2>
        ${signersHtml}
        <div class="footer">
          Este certificado acredita la integridad del proceso de firma electrónica conforme al Reglamento (UE) 910/2014 (eIDAS)
          y la Ley 6/2020 de servicios electrónicos de confianza. Los hashes SHA-256 garantizan que ni el documento ni las firmas han sido modificados.
        </div>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const printContract = (content: string, title: string) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>${title}</title>
      <style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;line-height:1.8;font-size:14px;white-space:pre-wrap;}</style>
      </head><body>${content.replace(/\n/g, '<br>')}</body></html>
    `);
    win.document.close();
    win.print();
  };

  return {
    contracts,
    templates,
    loading,
    agentNames,
    newFromTemplateOpen,
    setNewFromTemplateOpen,
    selectedTemplateId,
    setSelectedTemplateId,
    generating,
    fileInputRef,
    uploading,
    handleUpload,
    newTextOpen,
    setNewTextOpen,
    freeTitle,
    setFreeTitle,
    freeContent,
    setFreeContent,
    creatingText,
    previewOpen,
    setPreviewOpen,
    previewContent,
    previewTitle,
    signersDetail,
    signersDialogOpen,
    setSignersDialogOpen,
    signersLoading,
    certContract,
    loadData,
    generateFromTemplate,
    createFromText,
    viewSigners,
    deleteContract,
    openPreview,
    downloadCertificatePdf,
    printContract,
  };
}
