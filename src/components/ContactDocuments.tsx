import { useCallback, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  FolderOpen, Upload, Download, Trash2, FileText, Plus, Send,
  Link, CheckCircle, Clock, Loader2, Eye, Printer, PenTool, Ban, Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ContactDocumentDialogs from '@/components/documents/ContactDocumentDialogs';
import { registerDocument, unregisterDocument } from '@/lib/document-registry';
import { useContactDocumentContracts } from '@/hooks/useContactDocumentContracts';

interface Props {
  contactId: string;
  contactName?: string;
}

type StorageFileRow = {
  name: string;
  created_at?: string | null;
  metadata?: {
    size?: number;
  } | null;
};

const CATEGORIES = [
  { value: 'arras', label: 'Arras' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'mandato', label: 'Mandato de venta' },
  { value: 'otro', label: 'Otro' },
];

const BUCKET = 'property-documents';

const ContactDocuments = ({ contactId, contactName }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Bucket files ──
  const [files, setFiles] = useState<StorageFileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bucketPath = `contacts/${contactId}`;
  const {
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
  } = useContactDocumentContracts({
    contactId,
    contactName,
    bucket: BUCKET,
    bucketPath,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Load data
  // ─────────────────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    const { data, error } = await supabase.storage.from(BUCKET).list(bucketPath, { sortBy: { column: 'created_at', order: 'desc' } });
    if (!error) setFiles((data || []) as StorageFileRow[]);
    setFilesLoading(false);
  }, [bucketPath]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  // ─────────────────────────────────────────────────────────────────────────
  // File operations
  // ─────────────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const filePath = `${bucketPath}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: false });
    setUploading(false);
    if (error) { toast({ title: 'Error al subir', description: error.message, variant: 'destructive' }); return; }
    const registryResult = await registerDocument({
      bucketId: BUCKET,
      storagePath: filePath,
      fileName: file.name,
      title: file.name,
      documentKind: 'contact_file',
      sourceContext: 'contact',
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedBy: user?.id,
      contactLinks: [{ contactId, linkRole: 'primary' }],
    });
    if (registryResult.error) {
      toast({
        title: 'Archivo subido, pero no registrado',
        description: 'El archivo existe, pero falta enlazarlo al expediente documental.',
        variant: 'destructive',
      });
    }
    toast({ title: '✅ Archivo subido' });
    void loadFiles();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (fileName: string) => {
    const filePath = `${bucketPath}/${fileName}`;
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
    if (error || !data) { toast({ title: 'Error al descargar', variant: 'destructive' }); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (fileName: string) => {
    const filePath = `${bucketPath}/${fileName}`;
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) { toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' }); return; }
    await unregisterDocument(BUCKET, filePath);
    toast({ title: 'Archivo eliminado' });
    void loadFiles();
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return '📄';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return '🖼️';
    if (['doc', 'docx'].includes(ext || '')) return '📝';
    if (['xls', 'xlsx'].includes(ext || '')) return '📊';
    return '📎';
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

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── SECTION A: Bucket files ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Archivos</h3>
            <Badge variant="secondary">{files.length}</Badge>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,application/pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt,image/*"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Subiendo…' : 'Subir archivo'}
            </Button>
          </div>
        </div>

        {filesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm">Sin archivos</p>
              <p className="text-xs mt-1">Sube documentos para este contacto</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />Subir archivo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {files.map(file => (
              <Card key={file.name} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <span className="text-xl shrink-0">{getFileIcon(file.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {/* Strip timestamp prefix if present */}
                      {file.name.replace(/^\d+_/, '')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {file.metadata?.size ? `${(file.metadata.size / 1024).toFixed(1)} KB` : ''}
                      {file.created_at ? ` · ${format(new Date(file.created_at), 'dd MMM yyyy', { locale: es })}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(file.name)}
                      title="Descargar"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => { setFileToSign(file.name); setSendFileToSignOpen(true); }}
                      title="Enviar a firma digital"
                    >
                      <PenTool className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(file.name)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION B: Contracts ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Contratos para firma</h3>
            <Badge variant="secondary">{contracts.length}</Badge>
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => { setSelectedTemplateId(''); setNewContractOpen(true); }}
          >
            <Plus className="h-4 w-4" />Nuevo contrato
          </Button>
        </div>

        {contractsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : contracts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm">Sin contratos</p>
              <p className="text-xs mt-1">Genera un contrato desde una plantilla para enviarlo a firmar</p>
              <Button
                size="sm"
                className="mt-4 gap-2"
                onClick={() => { setSelectedTemplateId(''); setNewContractOpen(true); }}
              >
                <Plus className="h-4 w-4" />Nuevo contrato
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {contracts.map(c => (
              <Card key={c.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{c.contract_templates?.name || 'Contrato'}</p>
                        {c.contract_templates?.category && (
                          <Badge variant="outline" className="text-xs">
                            {CATEGORIES.find(cat => cat.value === c.contract_templates.category)?.label || c.contract_templates.category}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(c.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                      </p>

                      {/* Status */}
                      <div className="mt-2">
                        {c.signature_status === 'firmado' ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1">
                              <CheckCircle className="h-3 w-3" />Firmado
                            </Badge>
                            {c.signed_at && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(c.signed_at), 'dd MMM yyyy HH:mm', { locale: es })}
                                {c.signer_name && ` · ${c.signer_name}`}
                                {c.signer_id_number && ` · DNI: ${c.signer_id_number}`}
                              </p>
                            )}
                            {c.document_hash && (
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                SHA-256: {c.document_hash.substring(0, 20)}…
                              </p>
                            )}
                          </div>
                        ) : c.signature_status === 'pendiente' ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 gap-1">
                            <Clock className="h-3 w-3" />Pendiente de firma
                          </Badge>
                        ) : c.signature_status === 'revocado' ? (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="h-3 w-3" />Revocado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Borrador</Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 flex-wrap justify-end shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs h-8"
                        onClick={() => c.signature_status === 'firmado' ? viewSignersCert(c.id) : openPreview(c.content, c.contract_templates?.name || 'Contrato', c.signature_url)}
                      >
                        {c.signature_status === 'firmado' ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {c.signature_status === 'firmado' ? 'Certificado' : 'Ver'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs h-8"
                        onClick={() => printContract(c.content, c.contract_templates?.name || 'Contrato')}
                      >
                        <Printer className="h-3 w-3" />Imprimir
                      </Button>
                      {c.signature_status === 'borrador' && (
                        <Button
                          size="sm"
                          className="gap-1 text-xs h-8"
                          onClick={() => openSignerCountDialog(c.id)}
                        >
                          <Send className="h-3 w-3" />Enviar a firmar
                        </Button>
                      )}
                      {c.signature_status === 'pendiente' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs h-8"
                            onClick={() => openContractLinks(c)}
                          >
                            <Link className="h-3 w-3" />Ver enlaces
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs h-8 text-destructive hover:text-destructive"
                              >
                                <Ban className="h-3 w-3" />Cancelar firma
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Cancelar firma?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esto invalidará todos los enlaces de firma pendientes de este contrato. Los firmantes que ya hayan firmado no se verán afectados. Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Volver</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => revokeSignature(c.id)}
                                >
                                  Sí, cancelar firma
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialog: New contract ── */}
      <ContactDocumentDialogs
        contactName={contactName}
        templates={templates}
        categories={CATEGORIES}
        newContractOpen={newContractOpen}
        setNewContractOpen={setNewContractOpen}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        generatingContract={generatingContract}
        generateContract={generateContract}
        previewOpen={previewOpen}
        setPreviewOpen={setPreviewOpen}
        previewContent={previewContent}
        previewTitle={previewTitle}
        previewSignatureUrl={previewSignatureUrl}
        sendFileToSignOpen={sendFileToSignOpen}
        setSendFileToSignOpen={setSendFileToSignOpen}
        fileToSign={fileToSign}
        sendingFileToSign={sendingFileToSign}
        handleSendFileToSign={handleSendFileToSign}
        getFileIcon={getFileIcon}
        signerCountOpen={signerCountOpen}
        setSignerCountOpen={setSignerCountOpen}
        signerCount={signerCount}
        updateSignerCount={updateSignerCount}
        signerContacts={signerContacts}
        setSignerContacts={setSignerContacts}
        signerSearchTerms={signerSearchTerms}
        setSignerSearchTerms={setSignerSearchTerms}
        signerSearchResults={signerSearchResults}
        setSignerSearchResults={setSignerSearchResults}
        signerSearching={signerSearching}
        searchContacts={searchContacts}
        sendToSign={sendToSign}
        sendingToSign={sendingToSign}
        linksDialogOpen={linksDialogOpen}
        setLinksDialogOpen={setLinksDialogOpen}
        generatedLinks={generatedLinks}
        getSignUrl={getSignUrl}
        copySignLink={copySignLink}
        copyAllLinks={copyAllLinks}
        certDialogOpen={certDialogOpen}
        setCertDialogOpen={setCertDialogOpen}
        certLoading={certLoading}
        certContract={certContract}
        certSigners={certSigners}
      />
    </div>
  );
};

export default ContactDocuments;
