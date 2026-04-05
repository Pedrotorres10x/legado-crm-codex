import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import SignatureCertificate from '@/components/SignatureCertificate';
import { Eye, FileText, Loader2 } from 'lucide-react';

type TemplateOption = {
  id: string;
  name: string;
  category: string;
};

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

type FreeSignatureDialogsProps = {
  newFromTemplateOpen: boolean;
  setNewFromTemplateOpen: (open: boolean) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  templates: TemplateOption[];
  generating: boolean;
  generateFromTemplate: () => void;
  newTextOpen: boolean;
  setNewTextOpen: (open: boolean) => void;
  freeTitle: string;
  setFreeTitle: (value: string) => void;
  freeContent: string;
  setFreeContent: (value: string) => void;
  creatingText: boolean;
  createFromText: () => void;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
  previewTitle: string;
  previewContent: string;
  signersDialogOpen: boolean;
  setSignersDialogOpen: (open: boolean) => void;
  signersLoading: boolean;
  certContract: CertificateContract;
  signersDetail: CertificateSigner[];
};

const FreeSignatureDialogs = ({
  newFromTemplateOpen,
  setNewFromTemplateOpen,
  selectedTemplateId,
  setSelectedTemplateId,
  templates,
  generating,
  generateFromTemplate,
  newTextOpen,
  setNewTextOpen,
  freeTitle,
  setFreeTitle,
  freeContent,
  setFreeContent,
  creatingText,
  createFromText,
  previewOpen,
  setPreviewOpen,
  previewTitle,
  previewContent,
  signersDialogOpen,
  setSignersDialogOpen,
  signersLoading,
  certContract,
  signersDetail,
}: FreeSignatureDialogsProps) => {
  return (
    <>
      <Dialog open={newFromTemplateOpen} onOpenChange={setNewFromTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar desde plantilla</DialogTitle>
            <DialogDescription>Selecciona una plantilla para crear el documento</DialogDescription>
          </DialogHeader>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger><SelectValue placeholder="Selecciona plantilla" /></SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name} ({template.category})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button disabled={!selectedTemplateId || generating} onClick={generateFromTemplate}>
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando...</> : 'Generar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newTextOpen} onOpenChange={setNewTextOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Documento de texto libre</DialogTitle>
            <DialogDescription>Escribe el contenido del documento que necesitas firmar</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Título (opcional)</Label>
              <Input
                value={freeTitle}
                onChange={(event) => setFreeTitle(event.target.value)}
                placeholder="Ej: Autorización de visita"
              />
            </div>
            <div className="space-y-1">
              <Label>Contenido *</Label>
              <Textarea
                value={freeContent}
                onChange={(event) => setFreeContent(event.target.value)}
                placeholder="Escribe aquí el texto del documento…"
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!freeContent.trim() || creatingText} onClick={createFromText}>
              {creatingText ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando...</> : 'Crear documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          {(() => {
            const urlMatch = previewContent?.match(/https?:\/\/[^\s]+\.(pdf|PDF)(?:\?[^\s]*)?/);
            const pdfUrl = urlMatch?.[0];
            if (pdfUrl) {
              const fileName = decodeURIComponent(pdfUrl.split('/').pop()?.split('?')[0] || 'documento.pdf');
              return (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 border rounded-xl bg-muted/30">
                  <FileText className="h-16 w-16 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">{fileName}</p>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="gap-2"><Eye className="h-4 w-4" />Ver documento PDF</Button>
                  </a>
                </div>
              );
            }

            return (
              <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed border rounded-lg p-6 bg-card">
                {previewContent}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <SignatureCertificate
        open={signersDialogOpen}
        onOpenChange={setSignersDialogOpen}
        loading={signersLoading}
        contract={certContract}
        signers={signersDetail}
      />
    </>
  );
};

export default FreeSignatureDialogs;
