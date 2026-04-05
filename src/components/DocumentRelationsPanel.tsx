import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Link2, Loader2, Home, User, PenTool, Clock, CheckCircle2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentRelationsManager } from '@/hooks/useDocumentRelationsManager';
import { DocumentRelationsDialogs } from '@/components/documents/DocumentRelationsDialogs';

type Props =
  | { contactId: string; propertyId?: never }
  | { propertyId: string; contactId?: never };

const kindLabels: Record<string, string> = {
  contact_file: 'Contacto',
  property_file: 'Inmueble',
  catastro_report: 'Catastro',
  other: 'Otro',
};

type RelatedContact = {
  id: string;
  full_name?: string | null;
};

type RelatedProperty = {
  id: string;
  title?: string | null;
  address?: string | null;
};

type RelatedDocumentRow = {
  id: string;
  title: string;
  file_name: string;
  created_at: string;
  expires_at?: string | null;
  document_kind: string;
  generated_contracts?: {
    signature_status?: string | null;
  } | null;
  document_contacts?: Array<{
    contacts?: RelatedContact | null;
  }> | null;
  document_properties?: Array<{
    properties?: RelatedProperty | null;
  }> | null;
};

const DocumentRelationsPanel = (props: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    isContactContext,
    loading,
    openingId,
    preparingId,
    documents,
    signatureDialogOpen,
    setSignatureDialogOpen,
    selectedDocument,
    signerCount,
    updateSignerCount,
    signerContacts,
    setSignerContacts,
    signerSearchTerms,
    setSignerSearchTerms,
    signerSearchResults,
    signerSearching,
    searchContacts,
    selectContactForSigner,
    generatedLinks,
    linksDialogOpen,
    setLinksDialogOpen,
    linkDialogOpen,
    setLinkDialogOpen,
    linkingDocument,
    contactSearch,
    setContactSearch,
    propertySearch,
    setPropertySearch,
    contactResults,
    propertyResults,
    selectedContacts,
    selectedProperties,
    savingLinks,
    openDocument,
    openSignatureDialog,
    openLinkDialog,
    getSignUrl,
    copySignLink,
    copyAllLinks,
    searchLinkContacts,
    searchProperties,
    addSelectedContact,
    addSelectedProperty,
    removeSelectedContact,
    removeSelectedProperty,
    saveDocumentLinks,
    prepareDocumentForSignature,
  } = useDocumentRelationsManager({
    props,
    userId: user?.id,
    toast,
  });

  const typedDocuments = documents as RelatedDocumentRow[];

  return (
    <>
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Expediente documental
            <Badge variant="secondary" className="text-xs">{typedDocuments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando documentos relacionados...
            </div>
          ) : typedDocuments.length === 0 ? (
            <div className="text-sm text-muted-foreground">Todavía no hay documentos registrados en este expediente.</div>
          ) : (
            <div className="space-y-2">
              {typedDocuments.map((doc) => {
                const linkedContacts = (doc.document_contacts || [])
                  .map((link) => link.contacts)
                  .filter(Boolean)
                  .filter((contact) => !isContactContext || contact.id !== props.contactId);
                const linkedProperties = (doc.document_properties || [])
                  .map((link) => link.properties)
                  .filter(Boolean)
                  .filter((property) => isContactContext || property.id !== props.propertyId);

                return (
                  <div key={doc.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                          <Badge variant="outline" className="text-[11px]">{kindLabels[doc.document_kind] || doc.document_kind}</Badge>
                          {doc.generated_contracts?.signature_status === 'pendiente' && (
                            <Badge className="text-[11px] bg-amber-100 text-amber-800 border-amber-200">
                              <Clock className="h-3 w-3 mr-1" />
                              Firma pendiente
                            </Badge>
                          )}
                          {doc.generated_contracts?.signature_status === 'firmado' && (
                            <Badge className="text-[11px] bg-green-100 text-green-800 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Firmado
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {doc.file_name} · {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: es })}
                          {doc.expires_at ? ` · vence ${format(new Date(doc.expires_at), 'dd/MM/yyyy')}` : ''}
                        </p>
                      </div>

                      <Button size="sm" variant="outline" onClick={() => openDocument(doc)} disabled={openingId === doc.id}>
                        {openingId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openLinkDialog(doc)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openSignatureDialog(doc)} disabled={preparingId === doc.id}>
                        {preparingId === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenTool className="h-3.5 w-3.5" />}
                      </Button>
                    </div>

                    {(linkedContacts.length > 0 || linkedProperties.length > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {linkedContacts.map((contact) => (
                          <Badge key={contact.id} variant="secondary" className="gap-1">
                            <User className="h-3 w-3" />
                            {contact.full_name}
                          </Badge>
                        ))}
                        {linkedProperties.map((property) => (
                          <Badge key={property.id} variant="secondary" className="gap-1">
                            <Home className="h-3 w-3" />
                            {property.title || property.address || 'Inmueble'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentRelationsDialogs
        signatureDialogOpen={signatureDialogOpen}
        setSignatureDialogOpen={setSignatureDialogOpen}
        selectedDocument={selectedDocument}
        signerCount={signerCount}
        updateSignerCount={updateSignerCount}
        signerSearchTerms={signerSearchTerms}
        setSignerSearchTerms={setSignerSearchTerms}
        signerContacts={signerContacts}
        setSignerContacts={setSignerContacts}
        signerSearchResults={signerSearchResults}
        signerSearching={signerSearching}
        searchContacts={searchContacts}
        selectContactForSigner={selectContactForSigner}
        prepareDocumentForSignature={prepareDocumentForSignature}
        preparingId={preparingId}
        linksDialogOpen={linksDialogOpen}
        setLinksDialogOpen={setLinksDialogOpen}
        generatedLinks={generatedLinks}
        getSignUrl={getSignUrl}
        copySignLink={copySignLink}
        copyAllLinks={copyAllLinks}
        linkDialogOpen={linkDialogOpen}
        setLinkDialogOpen={setLinkDialogOpen}
        linkingDocument={linkingDocument}
        selectedContacts={selectedContacts}
        removeSelectedContact={removeSelectedContact}
        contactSearch={contactSearch}
        setContactSearch={setContactSearch}
        searchLinkContacts={searchLinkContacts}
        contactResults={contactResults}
        addSelectedContact={addSelectedContact}
        selectedProperties={selectedProperties}
        removeSelectedProperty={removeSelectedProperty}
        propertySearch={propertySearch}
        setPropertySearch={setPropertySearch}
        searchProperties={searchProperties}
        propertyResults={propertyResults}
        addSelectedProperty={addSelectedProperty}
        saveDocumentLinks={saveDocumentLinks}
        savingLinks={savingLinks}
      />
    </>
  );
};

export default DocumentRelationsPanel;
