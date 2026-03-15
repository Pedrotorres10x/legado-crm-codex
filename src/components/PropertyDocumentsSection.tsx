import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePropertyDocumentsManager } from '@/hooks/usePropertyDocumentsManager';
import PropertyDocumentsDialogs from '@/components/documents/PropertyDocumentsDialogs';
import { PropertyDocumentsChecklistPanel } from '@/components/documents/PropertyDocumentsChecklistPanel';

interface Props {
  propertyId: string;
  propertyStatus: string;
}

const PropertyDocumentsSection = ({ propertyId, propertyStatus }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const {
    docs,
    uploading,
    analyzing,
    reanalyzingDocId,
    reanalyzingAll,
    resolvingHolder,
    linkDialogOpen,
    setLinkDialogOpen,
    linkingDoc,
    linkingOwnerName,
    ownerSuggestions,
    loadingSuggestions,
    showAdd,
    setShowAdd,
    newDoc,
    setNewDoc,
    missingRequired,
    expiringDocs,
    expiredDocs,
    completionPct,
    legalTrafficLight,
    docsWithAiIssues,
    docsValidatedByAi,
    getAiSummary,
    handleUpload,
    handleReanalyzeDocument,
    handleReanalyzeAll,
    handleDelete,
    handleCreatePendingOwner,
    openLinkExistingDialog,
    handleLinkExistingOwner,
    resetLinkingState,
    horusDocs,
    allDocTypes,
  } = usePropertyDocumentsManager({
    propertyId,
    propertyStatus,
    userId: user?.id,
    toast,
  });

  return (
    <Card className="animate-fade-in-up">
      <PropertyDocumentsChecklistPanel
        completionPct={completionPct}
        reanalyzingAll={reanalyzingAll}
        handleReanalyzeAll={handleReanalyzeAll}
        onAddDocument={() => setShowAdd(true)}
        legalTrafficLight={legalTrafficLight as any}
        expiredDocs={expiredDocs}
        expiringDocs={expiringDocs}
        missingRequired={missingRequired}
        horusDocs={horusDocs}
        docsWithAiIssues={docsWithAiIssues as any}
        docsValidatedByAi={docsValidatedByAi as any}
        docs={docs}
        propertyStatus={propertyStatus}
        getAiSummary={getAiSummary as any}
        reanalyzingDocId={reanalyzingDocId}
        handleReanalyzeDocument={handleReanalyzeDocument}
        handleDelete={handleDelete}
        onUploadMissing={(docType, label) => {
          setNewDoc({ doc_type: docType, label, expires_at: '', file: null });
          setShowAdd(true);
        }}
        resolvingHolder={resolvingHolder}
        openLinkExistingDialog={openLinkExistingDialog}
        handleCreatePendingOwner={handleCreatePendingOwner}
      />

      <PropertyDocumentsDialogs
        linkDialogOpen={linkDialogOpen}
        setLinkDialogOpen={setLinkDialogOpen}
        linkingOwnerName={linkingOwnerName}
        loadingSuggestions={loadingSuggestions}
        ownerSuggestions={ownerSuggestions}
        linkingDoc={linkingDoc}
        resolvingHolder={resolvingHolder}
        handleLinkExistingOwner={handleLinkExistingOwner}
        resetLinkingState={resetLinkingState}
        showAdd={showAdd}
        setShowAdd={setShowAdd}
        newDoc={newDoc}
        setNewDoc={setNewDoc}
        allDocTypes={allDocTypes}
        handleUpload={handleUpload}
        uploading={uploading}
        analyzing={analyzing}
      />
    </Card>
  );
};

export default PropertyDocumentsSection;
