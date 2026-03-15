import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, Loader2, Search, Send, User, X } from 'lucide-react';

type SignerContact = { id: string; full_name: string; email?: string | null } | null;

interface ClosingTransactionalDialogsProps {
  signerCountOpen: boolean;
  setSignerCountOpen: (open: boolean) => void;
  signerCount: number;
  updateSignerCount: (count: number) => void;
  signerContacts: SignerContact[];
  setSignerContacts: React.Dispatch<React.SetStateAction<SignerContact[]>>;
  signerSearchTerms: string[];
  setSignerSearchTerms: React.Dispatch<React.SetStateAction<string[]>>;
  signerSearchResults: Array<any[]>;
  setSignerSearchResults: React.Dispatch<React.SetStateAction<Array<any[]>>>;
  signerSearching: boolean[];
  searchContacts: (term: string, index: number) => void;
  sendTransactionalToSign: () => void;
  sendingToSign: boolean;
  linksDialogOpen: boolean;
  setLinksDialogOpen: (open: boolean) => void;
  generatedLinks: { label: string; token: string }[];
  getSignUrl: (token: string) => string;
  copySignLink: (token: string) => void;
  copyAllLinks: () => void;
}

const ClosingTransactionalDialogs = ({
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
  sendTransactionalToSign,
  sendingToSign,
  linksDialogOpen,
  setLinksDialogOpen,
  generatedLinks,
  getSignUrl,
  copySignLink,
  copyAllLinks,
}: ClosingTransactionalDialogsProps) => {
  return (
    <>
      <Dialog open={signerCountOpen} onOpenChange={setSignerCountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Firmantes del contrato
            </DialogTitle>
            <DialogDescription>
              Selecciona quién firmará el documento desde esta operación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nº de firmantes</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((count) => (
                  <Button
                    key={count}
                    type="button"
                    size="sm"
                    variant={signerCount === count ? 'default' : 'outline'}
                    className="h-9 w-9 p-0"
                    onClick={() => updateSignerCount(count)}
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {Array.from({ length: signerCount }, (_, index) => (
                <div key={index} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Firmante {index + 1}</Label>
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
                          {signerSearchResults[index].map((contact: any) => {
                            const alreadyUsed = signerContacts.some((selected, selectedIndex) => selectedIndex !== index && selected?.id === contact.id);
                            return (
                              <button
                                key={contact.id}
                                type="button"
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSignerCountOpen(false)}>Cancelar</Button>
            <Button onClick={sendTransactionalToSign} disabled={sendingToSign}>
              {sendingToSign ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar a firmar
            </Button>
          </DialogFooter>
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
              Copia cada enlace y envíalo al firmante correspondiente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {generatedLinks.map((link, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {getSignUrl(link.token).substring(0, 50)}...
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => copySignLink(link.token)}>
                  <Link className="h-3 w-3" />
                  Copiar
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            {generatedLinks.length > 1 && (
              <Button variant="outline" onClick={copyAllLinks}>
                <Link className="mr-2 h-4 w-4" />
                Copiar todos
              </Button>
            )}
            <Button onClick={() => setLinksDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClosingTransactionalDialogs;
