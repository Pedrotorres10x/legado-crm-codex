import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, FileText, Link, Loader2, PenTool, Plus, Search, Send, Users, X } from 'lucide-react';
import SignatureCertificate from '@/components/SignatureCertificate';

type SignerContact = { id: string; full_name: string; email?: string | null } | null;
type SearchContact = { id: string; full_name: string; email?: string | null; phone?: string | null };
type TemplateOption = { id: string; name: string; category?: string | null };
type CertificateContract = {
  id: string;
  content: string;
  content_hash: string | null;
  document_hash: string | null;
  signature_status: string;
  created_at: string;
  template_name?: string;
} | null;
type CertificateSigner = {
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
};

interface ContactDocumentDialogsProps {
  contactName?: string;
  templates: TemplateOption[];
  categories: { value: string; label: string }[];
  newContractOpen: boolean;
  setNewContractOpen: (open: boolean) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  generatingContract: boolean;
  generateContract: () => void;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
  previewContent: string;
  previewTitle: string;
  previewSignatureUrl: string | null;
  sendFileToSignOpen: boolean;
  setSendFileToSignOpen: (open: boolean) => void;
  fileToSign: string | null;
  sendingFileToSign: boolean;
  handleSendFileToSign: () => void;
  getFileIcon: (name: string) => string;
  signerCountOpen: boolean;
  setSignerCountOpen: (open: boolean) => void;
  signerCount: number;
  updateSignerCount: (count: number) => void;
  signerContacts: SignerContact[];
  setSignerContacts: React.Dispatch<React.SetStateAction<SignerContact[]>>;
  signerSearchTerms: string[];
  setSignerSearchTerms: React.Dispatch<React.SetStateAction<string[]>>;
  signerSearchResults: SearchContact[][];
  setSignerSearchResults: React.Dispatch<React.SetStateAction<SearchContact[][]>>;
  signerSearching: boolean[];
  searchContacts: (term: string, index: number) => void;
  sendToSign: () => void;
  sendingToSign: boolean;
  linksDialogOpen: boolean;
  setLinksDialogOpen: (open: boolean) => void;
  generatedLinks: { label: string; token: string }[];
  getSignUrl: (token: string) => string;
  copySignLink: (token: string) => void;
  copyAllLinks: () => void;
  certDialogOpen: boolean;
  setCertDialogOpen: (open: boolean) => void;
  certLoading: boolean;
  certContract: CertificateContract;
  certSigners: CertificateSigner[];
}

const ContactDocumentDialogs = ({
  contactName,
  templates,
  categories,
  newContractOpen,
  setNewContractOpen,
  selectedTemplateId,
  setSelectedTemplateId,
  generatingContract,
  generateContract,
  previewOpen,
  setPreviewOpen,
  previewContent,
  previewTitle,
  previewSignatureUrl,
  sendFileToSignOpen,
  setSendFileToSignOpen,
  fileToSign,
  sendingFileToSign,
  handleSendFileToSign,
  getFileIcon,
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
  searchContacts,
  sendToSign,
  sendingToSign,
  linksDialogOpen,
  setLinksDialogOpen,
  generatedLinks,
  getSignUrl,
  copySignLink,
  copyAllLinks,
  certDialogOpen,
  setCertDialogOpen,
  certLoading,
  certContract,
  certSigners,
}: ContactDocumentDialogsProps) => {
  return (
    <>
      <Dialog open={newContractOpen} onOpenChange={setNewContractOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Nuevo contrato para {contactName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Plantilla</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <span>{template.name}</span>
                        {template.category && (
                          <span className="text-xs text-muted-foreground">
                            ({categories.find((c) => c.value === template.category)?.label || template.category})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay plantillas disponibles. Crea una desde Herramientas → Plantillas.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              El contrato se generará con los datos del contacto y quedará en estado <strong>Borrador</strong>.
              Luego puedes enviarlo a firmar.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewContractOpen(false)}>Cancelar</Button>
            <Button disabled={!selectedTemplateId || generatingContract} onClick={generateContract}>
              {generatingContract ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Generar contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />{previewTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 font-serif text-sm leading-relaxed whitespace-pre-wrap">
            {previewContent}
          </div>
          {previewSignatureUrl && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle className="h-4 w-4 text-green-600" />Firma del cliente
              </p>
              <img src={previewSignatureUrl} alt="Firma" className="max-h-32 rounded border" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendFileToSignOpen} onOpenChange={setSendFileToSignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              Enviar a firma digital
            </DialogTitle>
            <DialogDescription>
              Se creará un enlace de firma para que el cliente pueda firmar digitalmente este documento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
              <span className="text-xl">{fileToSign ? getFileIcon(fileToSign) : '📄'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fileToSign?.replace(/^\d+_/, '')}</p>
                <p className="text-xs text-muted-foreground">Se generará un enlace de firma para este archivo</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendFileToSignOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendFileToSign} disabled={sendingFileToSign} className="gap-2">
              {sendingFileToSign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar a firmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signerCountOpen} onOpenChange={setSignerCountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Firmantes
            </DialogTitle>
            <DialogDescription>
              Selecciona los contactos que firmarán el documento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nº de firmantes</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((count) => (
                <Button
                  key={count}
                  variant={signerCount === count ? 'default' : 'outline'}
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => updateSignerCount(count)}
                >
                  {count}
                </Button>
              ))}
            </div>
          </div>

          <div className="max-h-[300px] space-y-3 overflow-y-auto">
            {Array.from({ length: signerCount }, (_, index) => (
              <div key={index} className="space-y-1">
                <Label className="text-sm font-medium">Firmante {index + 1}</Label>
                {signerContacts[index] ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-primary/5 p-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {signerContacts[index]!.full_name.charAt(0)}
                    </div>
                    <span className="flex-1 truncate text-sm font-medium">{signerContacts[index]!.full_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
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
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar contacto…"
                        className="h-9 pl-9"
                        value={signerSearchTerms[index] || ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          setSignerSearchTerms((prev) => {
                            const next = [...prev];
                            next[index] = value;
                            return next;
                          });
                          searchContacts(value, index);
                        }}
                      />
                      {signerSearching[index] && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    {(signerSearchResults[index]?.length || 0) > 0 && (
                      <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
                        {signerSearchResults[index].map((contact) => {
                          const alreadyUsed = signerContacts.some((selected, selectedIndex) => selectedIndex !== index && selected?.id === contact.id);
                          return (
                            <button
                              key={contact.id}
                              disabled={alreadyUsed}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 disabled:opacity-40"
                              onClick={() => {
                                setSignerContacts((prev) => {
                                  const next = [...prev];
                                  next[index] = { id: contact.id, full_name: contact.full_name, email: contact.email || null };
                                  return next;
                                });
                                setSignerSearchTerms((prev) => {
                                  const next = [...prev];
                                  next[index] = '';
                                  return next;
                                });
                                setSignerSearchResults((prev) => {
                                  const next = [...prev];
                                  next[index] = [];
                                  return next;
                                });
                              }}
                            >
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                                {contact.full_name.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{contact.full_name}</p>
                                {contact.phone && <p className="text-xs text-muted-foreground">{contact.phone}</p>}
                              </div>
                              {alreadyUsed && <span className="text-[10px] text-muted-foreground">Ya asignado</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button
            className="w-full gap-2"
            onClick={sendToSign}
            disabled={sendingToSign || !signerContacts.slice(0, signerCount).every((contact) => contact !== null)}
          >
            {sendingToSign
              ? <><Loader2 className="h-4 w-4 animate-spin" />Generando enlaces…</>
              : <><Send className="h-4 w-4" />Enviar a firma ({signerCount} {signerCount === 1 ? 'firmante' : 'firmantes'})</>}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Enlaces de firma
            </DialogTitle>
            <DialogDescription>
              Copia cada enlace y envíalo manualmente al firmante correspondiente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {generatedLinks.map((link, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {getSignUrl(link.token).substring(0, 50)}…
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => copySignLink(link.token)}>
                  <Link className="h-3 w-3" />Copiar
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            {generatedLinks.length > 1 && (
              <Button variant="outline" onClick={copyAllLinks} className="gap-2">
                <Link className="h-4 w-4" />Copiar todos
              </Button>
            )}
            <Button onClick={() => setLinksDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignatureCertificate
        open={certDialogOpen}
        onOpenChange={setCertDialogOpen}
        loading={certLoading}
        contract={certContract}
        signers={certSigners}
      />
    </>
  );
};

export default ContactDocumentDialogs;
