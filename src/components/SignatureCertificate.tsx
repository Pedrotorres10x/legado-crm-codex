import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, CheckCircle, Clock, Printer, Download, Globe, Monitor, Mail, User, Hash, Calendar, FileText, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SignerDetail {
  id: string;
  signer_label: string;
  signer_name: string | null;
  signer_id_number: string | null;
  signer_email: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  signed_at: string | null;
  signature_status: string;
  signature_url: string | null;
  signature_hash: string | null;
  document_hash: string | null;
  otp_verified: boolean;
  otp_attempts: number;
  created_at: string;
}

interface ContractInfo {
  id: string;
  content: string;
  content_hash: string | null;
  document_hash: string | null;
  signature_status: string;
  created_at: string;
  template_name?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  contract: ContractInfo | null;
  signers: SignerDetail[];
}

const SignatureCertificate = ({ open, onOpenChange, loading, contract, signers }: Props) => {

  const printCertificate = () => {
    const printEl = document.getElementById('signature-certificate-print');
    if (!printEl) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Certificado de Firma - ${contract?.template_name || 'Documento'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 30px; color: #1a1a2e; font-size: 13px; line-height: 1.6; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
        .meta { color: #6b7280; font-size: 12px; }
        .section { margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .field-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
        .field-value { font-size: 13px; font-weight: 500; word-break: break-all; }
        .mono { font-family: 'Courier New', monospace; font-size: 11px; }
        .signature-img { max-width: 280px; max-height: 120px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; background: #fff; }
        .signer-block { border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 16px; page-break-inside: avoid; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .badge-signed { background: #d1fae5; color: #065f46; }
        .badge-pending { background: #fef3c7; color: #92400e; }
        .badge-revoked { background: #fee2e2; color: #991b1b; }
        .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
        .doc-content { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; max-height: 300px; overflow: hidden; font-size: 12px; white-space: pre-wrap; font-family: Georgia, serif; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>${printEl.innerHTML}</body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'firmado': return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Firmado</Badge>;
      case 'revocado': return <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Revocado</Badge>;
      default: return <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
    }
  };

  const parseUA = (ua: string | null) => {
    if (!ua) return { browser: 'Desconocido', os: 'Desconocido' };
    let browser = 'Otro';
    let os = 'Otro';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';
    return { browser, os };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Certificado de Firma Electrónica
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !contract ? (
          <p className="text-center py-8 text-muted-foreground">No se encontró el contrato.</p>
        ) : (
          <>
            {/* Printable content */}
            <div id="signature-certificate-print">
              {/* Header */}
              <div className="text-center mb-6 border-b pb-4">
                <h1 className="text-xl font-bold">Certificado de Firma Electrónica</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Generado el {format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es })} · Conforme al Reglamento (UE) 910/2014 (eIDAS)
                </p>
              </div>

              {/* Document info */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
                  <FileText className="h-4 w-4" />Información del documento
                </h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 bg-muted/30 rounded-xl border">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Documento</p>
                    <p className="text-sm font-medium">{contract.template_name || 'Documento'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Estado</p>
                    <div className="mt-0.5">{statusBadge(contract.signature_status)}</div>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Fecha de creación</p>
                    <p className="text-sm">{format(new Date(contract.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">ID Contrato</p>
                    <p className="text-xs font-mono text-muted-foreground">{contract.id}</p>
                  </div>
                  {(contract.content_hash || contract.document_hash) && (
                    <div className="col-span-2">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Hash SHA-256 del documento</p>
                      <p className="text-xs font-mono break-all text-muted-foreground">{contract.content_hash || contract.document_hash}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Document preview */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
                  <FileText className="h-4 w-4" />Contenido del documento
                </h2>
                {(() => {
                  const urlMatch = contract.content?.match(/https?:\/\/[^\s]+\.(pdf|PDF)(?:\?[^\s]*)?/);
                  const pdfUrl = urlMatch?.[0];
                  if (pdfUrl) {
                    return (
                      <div className="flex flex-col items-center justify-center py-8 space-y-3 border rounded-xl bg-muted/30">
                        <FileText className="h-12 w-12 text-muted-foreground/40" />
                        <p className="text-sm font-medium">{decodeURIComponent(pdfUrl.split('/').pop()?.split('?')[0] || 'documento.pdf')}</p>
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline font-medium">Ver documento PDF ↗</a>
                      </div>
                    );
                  }
                  return (
                    <div className="whitespace-pre-wrap font-serif text-xs leading-relaxed border rounded-xl p-4 bg-card max-h-60 overflow-y-auto">
                      {contract.content}
                    </div>
                  );
                })()}
              </div>

              {/* Signers */}
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
                  <User className="h-4 w-4" />Firmantes ({signers.length})
                </h2>
                <div className="space-y-4">
                  {signers.map((s, idx) => {
                    const { browser, os } = parseUA(s.signer_user_agent);
                    return (
                      <div key={s.id} className="border rounded-xl p-4 space-y-3">
                        {/* Signer header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{s.signer_label}</p>
                              {s.signer_name && <p className="text-xs text-muted-foreground">{s.signer_name}</p>}
                            </div>
                          </div>
                          {statusBadge(s.signature_status)}
                        </div>

                        {/* Signer data grid */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 bg-muted/30 rounded-lg p-3">
                          {s.signer_id_number && (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><User className="h-3 w-3" />DNI/NIE</p>
                              <p className="text-sm font-medium">{s.signer_id_number}</p>
                            </div>
                          )}
                          {s.signer_email && (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Mail className="h-3 w-3" />Email verificado</p>
                              <p className="text-sm">{s.signer_email}</p>
                            </div>
                          )}
                          {s.signed_at && (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3 w-3" />Fecha y hora de firma</p>
                              <p className="text-sm">{format(new Date(s.signed_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}</p>
                            </div>
                          )}
                          {s.signer_ip && (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Globe className="h-3 w-3" />Dirección IP</p>
                              <p className="text-sm font-mono">{s.signer_ip}</p>
                            </div>
                          )}
                          {s.signer_user_agent && (
                            <div className="col-span-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Monitor className="h-3 w-3" />Dispositivo</p>
                              <p className="text-sm">{browser} en {os}</p>
                              <p className="text-[10px] font-mono text-muted-foreground/70 break-all mt-0.5">{s.signer_user_agent}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">OTP verificado</p>
                            <p className="text-sm">{s.otp_verified ? '✅ Sí' : '❌ No'} ({s.otp_attempts} intentos)</p>
                          </div>
                          {s.signature_hash && (
                            <div className="col-span-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Hash className="h-3 w-3" />Hash de la firma (SHA-256)</p>
                              <p className="text-[10px] font-mono break-all text-muted-foreground">{s.signature_hash}</p>
                            </div>
                          )}
                          {s.document_hash && (
                            <div className="col-span-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Hash className="h-3 w-3" />Hash del documento en el momento de firma</p>
                              <p className="text-[10px] font-mono break-all text-muted-foreground">{s.document_hash}</p>
                            </div>
                          )}
                        </div>

                        {/* Signature image */}
                        {s.signature_url && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Firma manuscrita digital</p>
                            <div className="inline-block border rounded-lg p-3 bg-white">
                              <img src={s.signature_url} alt={`Firma de ${s.signer_name || s.signer_label}`} className="max-w-[280px] max-h-[120px]" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legal footer */}
              <div className="mt-6 pt-4 border-t text-center">
                <p className="text-[10px] text-muted-foreground">
                  Este certificado acredita la integridad del proceso de firma electrónica conforme al Reglamento (UE) 910/2014 (eIDAS)
                  y la Ley 6/2020 de servicios electrónicos de confianza. Los hashes SHA-256 garantizan que ni el documento ni las firmas han sido modificados.
                  La dirección IP y el User-Agent han sido capturados en el momento de cada firma como evidencia forense.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t mt-4">
              <Button className="flex-1 gap-2" onClick={printCertificate}>
                <Printer className="h-4 w-4" />Imprimir / Guardar PDF
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SignatureCertificate;
