import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Clock, Copy, Home, Link2, Loader2, PenTool, Search, Send, User, X } from 'lucide-react';

type SignerContact = { id: string; full_name: string; email?: string | null } | null;
type LinkContact = { id: string; full_name: string };
type LinkProperty = { id: string; title?: string | null; address?: string | null };

type DocumentRelationsDialogsProps = {
  signatureDialogOpen: boolean;
  setSignatureDialogOpen: (open: boolean) => void;
  selectedDocument: any | null;
  signerCount: number;
  updateSignerCount: (count: number) => void;
  signerSearchTerms: string[];
  setSignerSearchTerms: React.Dispatch<React.SetStateAction<string[]>>;
  signerContacts: SignerContact[];
  setSignerContacts: React.Dispatch<React.SetStateAction<SignerContact[]>>;
  signerSearchResults: any[][];
  signerSearching: boolean[];
  searchContacts: (term: string, index: number) => Promise<void>;
  selectContactForSigner: (index: number, contact: { id: string; full_name: string; email?: string | null }) => void;
  prepareDocumentForSignature: () => Promise<void>;
  preparingId: string | null;
  linksDialogOpen: boolean;
  setLinksDialogOpen: (open: boolean) => void;
  generatedLinks: { label: string; token: string }[];
  getSignUrl: (token: string) => string;
  copySignLink: (token: string) => Promise<void>;
  copyAllLinks: () => Promise<void>;
  linkDialogOpen: boolean;
  setLinkDialogOpen: (open: boolean) => void;
  linkingDocument: any | null;
  selectedContacts: LinkContact[];
  removeSelectedContact: (contactId: string) => void;
  contactSearch: string;
  setContactSearch: (value: string) => void;
  searchLinkContacts: (term: string) => Promise<void>;
  contactResults: any[];
  addSelectedContact: (contact: LinkContact) => void;
  selectedProperties: LinkProperty[];
  removeSelectedProperty: (propertyId: string) => void;
  propertySearch: string;
  setPropertySearch: (value: string) => void;
  searchProperties: (term: string) => Promise<void>;
  propertyResults: any[];
  addSelectedProperty: (property: LinkProperty) => void;
  saveDocumentLinks: () => Promise<void>;
  savingLinks: boolean;
};

export function DocumentRelationsDialogs({
  signatureDialogOpen,
  setSignatureDialogOpen,
  selectedDocument,
  signerCount,
  updateSignerCount,
  signerSearchTerms,
  setSignerSearchTerms,
  signerContacts,
  setSignerContacts,
  signerSearchResults,
  signerSearching,
  searchContacts,
  selectContactForSigner,
  prepareDocumentForSignature,
  preparingId,
  linksDialogOpen,
  setLinksDialogOpen,
  generatedLinks,
  getSignUrl,
  copySignLink,
  copyAllLinks,
  linkDialogOpen,
  setLinkDialogOpen,
  linkingDocument,
  selectedContacts,
  removeSelectedContact,
  contactSearch,
  setContactSearch,
  searchLinkContacts,
  contactResults,
  addSelectedContact,
  selectedProperties,
  removeSelectedProperty,
  propertySearch,
  setPropertySearch,
  searchProperties,
  propertyResults,
  addSelectedProperty,
  saveDocumentLinks,
  savingLinks,
}: DocumentRelationsDialogsProps) {
  return (
    <>
      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar documento a firma digital</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-sm font-medium">{selectedDocument?.title}</p>
              <p className="text-xs text-muted-foreground">{selectedDocument?.file_name}</p>
            </div>

            <div className="space-y-2">
              <Label>Firmantes</Label>
              <div className="flex gap-2">
                {[1, 2, 3].map((count) => (
                  <Button key={count} type="button" variant={signerCount === count ? 'default' : 'outline'} size="sm" onClick={() => updateSignerCount(count)}>
                    {count}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {Array.from({ length: signerCount }, (_, index) => (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <Label>Firmante {index + 1}</Label>
                  <Input
                    value={signerSearchTerms[index] || ''}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setSignerSearchTerms((prev) => {
                        const next = [...prev];
                        next[index] = value;
                        return next;
                      });
                      setSignerContacts((prev) => {
                        const next = [...prev];
                        next[index] = null;
                        return next;
                      });
                      await searchContacts(value, index);
                    }}
                    placeholder="Buscar contacto por nombre..."
                  />
                  {signerSearching[index] && <p className="text-xs text-muted-foreground">Buscando...</p>}
                  {(signerSearchResults[index] || []).length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {(signerSearchResults[index] || []).map((contact: any) => (
                        <button
                          key={contact.id}
                          type="button"
                          className="w-full text-left rounded border px-3 py-2 hover:bg-accent/50"
                          onClick={() => selectContactForSigner(index, contact)}
                        >
                          <p className="text-sm font-medium">{contact.full_name}</p>
                          <p className="text-xs text-muted-foreground">{contact.email || contact.phone || 'Sin email ni teléfono'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureDialogOpen(false)}>Cancelar</Button>
            <Button onClick={prepareDocumentForSignature} disabled={preparingId === selectedDocument?.id}>
              {preparingId === selectedDocument?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar a firma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Enlaces de firma generados</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {generatedLinks.map((link) => (
              <div key={link.token} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{getSignUrl(link.token)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copySignLink(link.token)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinksDialogOpen(false)}>Cerrar</Button>
            <Button onClick={copyAllLinks}>
              <Copy className="h-4 w-4" />
              Copiar todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Relacionar documento</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-sm font-medium">{linkingDocument?.title}</p>
              <p className="text-xs text-muted-foreground">{linkingDocument?.file_name}</p>
            </div>

            <div className="space-y-2">
              <Label>Contactos relacionados</Label>
              <div className="flex flex-wrap gap-2">
                {selectedContacts.map((contact) => (
                  <Badge key={contact.id} variant="secondary" className="gap-1">
                    <User className="h-3 w-3" />
                    {contact.full_name}
                    <button type="button" onClick={() => removeSelectedContact(contact.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setContactSearch(value);
                    await searchLinkContacts(value);
                  }}
                  className="pl-9"
                  placeholder="Buscar contacto..."
                />
              </div>
              {contactResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {contactResults.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      className="w-full text-left rounded border px-3 py-2 hover:bg-accent/50"
                      onClick={() => addSelectedContact(contact)}
                    >
                      <p className="text-sm font-medium">{contact.full_name}</p>
                      <p className="text-xs text-muted-foreground">{contact.email || contact.phone || 'Sin email ni teléfono'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Inmuebles relacionados</Label>
              <div className="flex flex-wrap gap-2">
                {selectedProperties.map((property) => (
                  <Badge key={property.id} variant="secondary" className="gap-1">
                    <Home className="h-3 w-3" />
                    {property.title || property.address || 'Inmueble'}
                    <button type="button" onClick={() => removeSelectedProperty(property.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  value={propertySearch}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setPropertySearch(value);
                    await searchProperties(value);
                  }}
                  className="pl-9"
                  placeholder="Buscar inmueble..."
                />
              </div>
              {propertyResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {propertyResults.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      className="w-full text-left rounded border px-3 py-2 hover:bg-accent/50"
                      onClick={() => addSelectedProperty(property)}
                    >
                      <p className="text-sm font-medium">{property.title || 'Inmueble sin título'}</p>
                      <p className="text-xs text-muted-foreground">{property.address || 'Sin dirección'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveDocumentLinks} disabled={savingLinks}>
              {savingLinks ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Guardar relaciones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
