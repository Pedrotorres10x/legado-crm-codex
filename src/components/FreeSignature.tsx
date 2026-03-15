import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  PenTool,
  Upload,
  Loader2,
  FileText,
  Plus,
  Link,
  CheckCircle,
  Clock,
  Eye,
  Printer,
  Send,
  Trash2,
  Users,
  Ban,
  Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import FreeSignatureSigningDialogs from '@/components/documents/FreeSignatureSigningDialogs';
import FreeSignatureDialogs from '@/components/documents/FreeSignatureDialogs';
import { useFreeSignatureSigning } from '@/hooks/useFreeSignatureSigning';
import { useFreeSignatureManager } from '@/hooks/useFreeSignatureManager';

const FreeSignature = () => {
  const { isAdmin, canViewAll } = useAuth();
  const {
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
  } = useFreeSignatureManager();

  const {
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
  } = useFreeSignatureSigning({
    refreshContracts: loadData,
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'firmado':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3" />Firmado</Badge>;
      case 'pendiente':
        return <Badge variant="outline" className="border-amber-300 text-amber-600"><Clock className="mr-1 h-3 w-3" />Pendiente</Badge>;
      case 'revocado':
        return <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" />Revocado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-2" onClick={() => setNewFromTemplateOpen(true)}>
          <Plus className="h-4 w-4" />Desde plantilla
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setNewTextOpen(true)}>
          <FileText className="h-4 w-4" />Texto libre
        </Button>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Subiendo…' : 'Subir documento'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : contracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <PenTool className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p className="font-medium">{canViewAll ? 'Sin documentos de firma' : 'Sin documentos de firma libre'}</p>
            <p className="mt-1 text-sm">Crea un documento desde plantilla, texto libre o sube un archivo para firmarlo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {contracts.map((contract) => {
            const signers = contract.contract_signers || [];
            const signedCount = signers.filter((signer: any) => signer.signature_status === 'firmado').length;
            const totalSigners = signers.length;
            const templateName = contract.contract_templates?.name || 'Documento';

            return (
              <Card key={contract.id} className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">{templateName}</p>
                        {statusBadge(contract.signature_status)}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(contract.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                        {canViewAll && contract.agent_id && agentNames[contract.agent_id] ? ` · ${agentNames[contract.agent_id]}` : ''}
                        {contract.contact_id ? ` · 📎 ${contract.contacts?.full_name || 'Vinculado a contacto'}` : ''}
                      </p>

                      {totalSigners > 0 && (
                        <div className="mt-1.5 space-y-1">
                          <button
                            onClick={() => viewSigners(contract.id)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Users className="h-3 w-3" />
                            {signedCount}/{totalSigners} firmantes
                          </button>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {signers.map((signer: any) => (
                              <span key={signer.id} className="flex items-center gap-1 text-[11px]">
                                {signer.signature_status === 'firmado' ? (
                                  <span className="text-green-600">✅</span>
                                ) : signer.signature_status === 'revocado' ? (
                                  <span className="text-red-500">🚫</span>
                                ) : (
                                  <span className="text-amber-500">⏳</span>
                                )}
                                <span className={signer.signature_status === 'firmado' ? 'text-green-700' : 'text-muted-foreground'}>
                                  {signer.signer_label}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => contract.signature_status === 'firmado' ? viewSigners(contract.id) : openPreview(contract.content, templateName)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printContract(contract.content, templateName)}>
                        <Printer className="h-4 w-4" />
                      </Button>

                      {contract.signature_status === 'firmado' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary"
                          title="Descargar certificado de firma"
                          onClick={() => downloadCertificatePdf(contract.id)}
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                      )}

                      {contract.signature_status === 'borrador' && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSignerCountDialog(contract.id)}>
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteContract(contract.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      {contract.signature_status === 'pendiente' && totalSigners > 0 && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setGeneratedLinks(signers.map((signer: any) => ({ label: signer.signer_label, token: signer.signature_token })));
                              setLinksDialogOpen(true);
                            }}
                          >
                            <Link className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Cancelar firma">
                                <Ban className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Cancelar firma?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esto invalidará todos los enlaces de firma pendientes. Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Volver</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => revokeSignature(contract.id)}
                                >
                                  Sí, cancelar firma
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}

                      {isAdmin && contract.signature_status !== 'borrador' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Eliminar permanentemente">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar documento y firmas?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esto eliminará permanentemente el documento, todos los firmantes y sus firmas digitales. Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteContract(contract.id)}
                              >
                                Sí, eliminar todo
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FreeSignatureSigningDialogs
        signerCountOpen={signerCountOpen}
        setSignerCountOpen={setSignerCountOpen}
        signerCount={signerCount}
        updateSignerCount={updateSignerCount}
        signerContacts={signerContacts}
        signerSearchTerms={signerSearchTerms}
        setSignerSearchTerms={setSignerSearchTerms}
        signerSearchResults={signerSearchResults}
        signerSearching={signerSearching}
        searchContacts={searchContacts}
        selectContactForSigner={selectContactForSigner}
        clearContactForSigner={clearContactForSigner}
        sendToSign={sendToSign}
        sendingToSign={sendingToSign}
        linksDialogOpen={linksDialogOpen}
        setLinksDialogOpen={setLinksDialogOpen}
        generatedLinks={generatedLinks}
        getSignUrl={getSignUrl}
        copyLink={copyLink}
        copyAllLinks={copyAllLinks}
      />

      <FreeSignatureDialogs
        newFromTemplateOpen={newFromTemplateOpen}
        setNewFromTemplateOpen={setNewFromTemplateOpen}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        templates={templates}
        generating={generating}
        generateFromTemplate={generateFromTemplate}
        newTextOpen={newTextOpen}
        setNewTextOpen={setNewTextOpen}
        freeTitle={freeTitle}
        setFreeTitle={setFreeTitle}
        freeContent={freeContent}
        setFreeContent={setFreeContent}
        creatingText={creatingText}
        createFromText={createFromText}
        previewOpen={previewOpen}
        setPreviewOpen={setPreviewOpen}
        previewTitle={previewTitle}
        previewContent={previewContent}
        signersDialogOpen={signersDialogOpen}
        setSignersDialogOpen={setSignersDialogOpen}
        signersLoading={signersLoading}
        certContract={certContract}
        signersDetail={signersDetail}
      />
    </div>
  );
};

export default FreeSignature;
