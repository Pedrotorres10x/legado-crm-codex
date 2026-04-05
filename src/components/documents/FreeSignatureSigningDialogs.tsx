import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ban, CheckCircle, Copy, Link, Loader2, PenTool, Send, Users } from 'lucide-react';

type SignerContact = { id: string; full_name: string } | null;
type SearchContact = { id: string; full_name: string; phone?: string | null };

interface FreeSignatureSigningDialogsProps {
  signerCountOpen: boolean;
  setSignerCountOpen: (open: boolean) => void;
  signerCount: number;
  updateSignerCount: (count: number) => void;
  signerContacts: SignerContact[];
  signerSearchTerms: string[];
  setSignerSearchTerms: React.Dispatch<React.SetStateAction<string[]>>;
  signerSearchResults: SearchContact[][];
  signerSearching: boolean[];
  searchContacts: (term: string, index: number) => void;
  selectContactForSigner: (index: number, contact: { id: string; full_name: string }) => void;
  clearContactForSigner: (index: number) => void;
  sendToSign: () => void;
  sendingToSign: boolean;
  linksDialogOpen: boolean;
  setLinksDialogOpen: (open: boolean) => void;
  generatedLinks: { label: string; token: string }[];
  getSignUrl: (token: string) => string;
  copyLink: (token: string) => void;
  copyAllLinks: () => void;
}

const FreeSignatureSigningDialogs = ({
  signerCountOpen,
  setSignerCountOpen,
  signerCount,
  updateSignerCount,
  signerContacts,
  signerSearchTerms,
  setSignerSearchTerms,
  signerSearchResults,
  signerSearching,
  searchContacts,
  selectContactForSigner,
  clearContactForSigner,
  sendToSign,
  sendingToSign,
  linksDialogOpen,
  setLinksDialogOpen,
  generatedLinks,
  getSignUrl,
  copyLink,
  copyAllLinks,
}: FreeSignatureSigningDialogsProps) => {
  return (
    <>
      <Dialog open={signerCountOpen} onOpenChange={setSignerCountOpen}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-hidden p-0">
          <div className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4">
            <div className="mb-1 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogHeader className="space-y-0 p-0">
                  <DialogTitle className="text-lg">Firmantes</DialogTitle>
                  <DialogDescription className="text-sm">
                    Selecciona los contactos que firmarán el documento
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nº de firmantes</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    onClick={() => updateSignerCount(count)}
                    className={`h-12 flex-1 rounded-xl border text-sm font-semibold transition-all ${
                      signerCount === count
                        ? 'scale-105 border-primary bg-primary text-primary-foreground shadow-md'
                        : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Contactos</Label>
              {Array.from({ length: signerCount }, (_, index) => (
                <div key={index} className="space-y-1">
                  <Label className="text-sm font-medium">Firmante {index + 1}</Label>
                  {signerContacts[index] ? (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                      <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="flex-1 text-sm font-medium">{signerContacts[index]!.full_name}</span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => clearContactForSigner(index)}>
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        placeholder="Buscar contacto por nombre…"
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
                      {signerSearching[index] && (
                        <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {(signerSearchResults[index]?.length ?? 0) > 0 && (
                        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                          {signerSearchResults[index].map((contact) => (
                            <button
                              key={contact.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                              onClick={() => selectContactForSigner(index, contact)}
                            >
                              <span className="font-medium">{contact.full_name}</span>
                              {contact.phone && <span className="text-xs text-muted-foreground">· {contact.phone}</span>}
                            </button>
                          ))}
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <div className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Link className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogHeader className="space-y-0 p-0">
                  <DialogTitle className="text-lg">Enlaces de firma</DialogTitle>
                  <DialogDescription className="text-sm">
                    Comparte cada enlace con su firmante
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            {generatedLinks.map((link, index) => (
              <div key={index} className="group relative rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <PenTool className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{link.label}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0 gap-1.5 transition-colors hover:bg-primary hover:text-primary-foreground"
                        onClick={() => copyLink(link.token)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                    </div>
                    <p className="break-all font-mono text-xs leading-relaxed text-muted-foreground">
                      {getSignUrl(link.token)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {generatedLinks.length > 1 && (
            <div className="p-4 pt-0">
              <Button variant="secondary" className="w-full gap-2" onClick={copyAllLinks}>
                <Copy className="h-4 w-4" />Copiar todos los enlaces
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FreeSignatureSigningDialogs;
