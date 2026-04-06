import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ContactsActionsSection from '@/components/contacts/ContactsActionsSection';
import ContactsAiCreateDialog from '@/components/contacts/ContactsAiCreateDialog';
import ContactsCaptacionPanel from '@/components/contacts/ContactsCaptacionPanel';
import ContactCreateDialog from '@/components/contacts/ContactCreateDialog';
import ContactsHeader from '@/components/contacts/ContactsHeader';
import ContactsInsightsDialogs from '@/components/contacts/ContactsInsightsDialogs';
import ContactsListPanel from '@/components/contacts/ContactsListPanel';
import ContactsMobileFab from '@/components/contacts/ContactsMobileFab';
import ContactsInfluenceCirclePanel from '@/components/contacts/ContactsInfluenceCirclePanel';
import ContactsOverviewSection from '@/components/contacts/ContactsOverviewSection';
import ContactsPipelineControls from '@/components/contacts/ContactsPipelineControls';
import { useToast } from '@/hooks/use-toast';
import { useContactCreateDialogState } from '@/hooks/useContactCreateDialogState';
import { useContactHealthColors } from '@/hooks/useHealthColors';
import { useContactInsights } from '@/hooks/useContactInsights';
import { useIsMobile } from '@/hooks/use-mobile';
import { EMPTY_CONTACT_CREATE_FORM, useContactCreate } from '@/hooks/useContactCreate';
import { useContactsPipeline } from '@/hooks/useContactsPipeline';
import { ensureContactFromDocument } from '@/lib/document-onboarding';
import { getRelationshipTier, getRelationshipValidation, isInfluenceCircleContact } from '@/lib/agent-influence-circle';
import { useWorkspacePersona } from '@/hooks/useWorkspacePersona';

const typeLabels: Record<string, string> = { contacto: 'Contacto', prospecto: 'Prospecto (dueño sin firmar)', propietario: 'Propietario (cliente)', comprador: 'Comprador', comprador_cerrado: 'Comprador (cerrado)', vendedor_cerrado: 'Vendedor (cerrado)', ambos: 'Ambos', colaborador: 'Colaborador', statefox: 'Statefox' };
const statusLabels: Record<string, string> = { nuevo: 'Nuevo', en_seguimiento: 'En seguimiento', activo: 'Activo', cerrado: 'Cerrado' };

const Contacts = () => {
  const { user, isAdmin, isCoordinadora, canViewAll } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { isAgentMode } = useWorkspacePersona(canViewAll);
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'name' | 'phone' | 'email' | 'city' | 'id_number' | 'tags'>('all');
  const [filterType, setFilterType] = useState('all');
  const [pipelineTab, setPipelineTab] = useState<'captacion' | 'compradores' | 'cerrados' | 'red'>('captacion');
  const [peopleScope, setPeopleScope] = useState<'all' | 'circle'>('all');
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [circleTierFilter, setCircleTierFilter] = useState<'all' | 'oro' | 'plata' | 'bronce'>('all');
  const [circleValidationFilter, setCircleValidationFilter] = useState<'all' | 'validado' | 'potencial' | 'sin_validar'>('all');
  const canBulkImport = isAdmin || isCoordinadora;
  const [showAll, setShowAll] = useState(true);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [statefoxOpen, setStatefoxOpen] = useState(false);

  const handleAutoCreateContactFromDocument = async (data: unknown) => {
    try {
      const result = await ensureContactFromDocument(data, user?.id);
      toast({
        title: result.created ? 'Contacto creado desde documento' : 'Contacto ya existente',
        description: result.created ? 'El alta se ha generado automaticamente desde el DNI/documento.' : 'He reutilizado el contacto existente para evitar duplicados.',
      });
      navigate(`/contacts/${result.contactId}`);
    } catch (error: unknown) {
      toast({
        title: 'No se pudo dar de alta el contacto',
        description: error instanceof Error ? error.message : 'Faltan datos suficientes en el documento.',
        variant: 'destructive',
      });
    }
  };

  const effectiveViewMode = 'list';
  const {
    contacts,
    totalCount,
    currentPage,
    setCurrentPage,
    typeCounts,
    refreshContactsFirstPage,
    pipelineStages,
  } = useContactsPipeline({
    userId: user?.id,
    effectiveViewMode,
    search,
    searchField,
    filterType,
    showAll,
    pipelineTab,
    stageFilter,
  });
  const {
    emptyForm,
    loading,
    createContact,
  } = useContactCreate({
    userId: user?.id,
    toast,
    onCreated: refreshContactsFirstPage,
  });
  const {
    dialogOpen,
    setDialogOpen,
    dialogStep,
    setDialogStep,
    form,
    setForm,
    formTags,
    setFormTags,
    formTagInput,
    setFormTagInput,
    openCreateDialog,
    closeCreateDialog,
    handleDialogOpenChange,
  } = useContactCreateDialogState({
    searchParams,
    setSearchParams,
    emptyForm,
  });
  const {
    summaryOpen,
    setSummaryOpen,
    summary,
    summaryLoading,
    contactVisits,
    visitsOpen,
    setVisitsOpen,
    visitsLoading,
    fetchContactVisits,
    fetchSummary,
  } = useContactInsights({ toast });

  // Reset stage filter when changing tab
  useEffect(() => {
    setStageFilter(null);
    setCircleTierFilter('all');
    setCircleValidationFilter('all');
  }, [pipelineTab]);

  useEffect(() => {
    if (pipelineTab === 'red') {
      setPeopleScope('circle');
      return;
    }
    setPeopleScope('all');
  }, [pipelineTab]);

  const healthColors = useContactHealthColors(contacts);

  const handleSubmit = async () => {
    const result = await createContact(form, formTags);
    if (!result.ok) return;
    closeCreateDialog();
  };

  const isCircleView = pipelineTab === 'red';
  const filtered = contacts.filter((contact) => {
    const belongsToCircle = isInfluenceCircleContact(contact);
    if (peopleScope === 'circle' && !belongsToCircle) return false;
    if (!isCircleView) return true;
    if (!belongsToCircle) return false;
    if (circleTierFilter !== 'all' && getRelationshipTier(contact) !== circleTierFilter) return false;
    if (circleValidationFilter !== 'all' && getRelationshipValidation(contact) !== circleValidationFilter) return false;
    return true;
  });
  const pipelineContacts = filtered;
  const circleMeta = Object.fromEntries(
    pipelineContacts.map((contact) => [
      contact.id,
      {
        tier: getRelationshipTier(contact),
        validation: getRelationshipValidation(contact),
      },
    ]),
  );

  // Compute tab counts for display
  const captacionCount = (typeCounts['statefox'] ?? 0) + (typeCounts['prospecto'] ?? 0) + (typeCounts['propietario'] ?? 0);
  const compradoresCount = (typeCounts['comprador'] ?? 0) + (typeCounts['ambos'] ?? 0);
  const cerradosCount = (typeCounts['comprador_cerrado'] ?? 0) + (typeCounts['vendedor_cerrado'] ?? 0);
  const redCount = (typeCounts['colaborador'] ?? 0) + (typeCounts['contacto'] ?? 0) + (typeCounts['comprador_cerrado'] ?? 0) + (typeCounts['vendedor_cerrado'] ?? 0) + (typeCounts['ambos'] ?? 0);
  const circleTierCounts = pipelineContacts.reduce(
    (acc, contact) => {
      acc[getRelationshipTier(contact)] += 1;
      return acc;
    },
    { oro: 0, plata: 0, bronce: 0 },
  );
  const circleValidationCounts = pipelineContacts.reduce(
    (acc, contact) => {
      acc[getRelationshipValidation(contact)] += 1;
      return acc;
    },
    { validado: 0, potencial: 0, sin_validar: 0 },
  );
  const uviCount = useMemo(
    () => pipelineContacts.filter((contact) => healthColors[contact.id]?.label === 'UVI').length,
    [healthColors, pipelineContacts],
  );
  const prospectCount = typeCounts['prospecto'] ?? 0;
  const buyerCount = (typeCounts['comprador'] ?? 0) + (typeCounts['ambos'] ?? 0);
  const relationshipBaseCount = redCount;
  const peopleBaseTotal = totalCount > 0 ? totalCount : contacts.length;

  return (
    <div className="space-y-4 md:space-y-6">
      <ContactsOverviewSection
        uviCount={uviCount}
        prospectCount={prospectCount}
        buyerCount={buyerCount}
        peopleBaseTotal={peopleBaseTotal}
        relationshipBaseCount={relationshipBaseCount}
      />

      <ContactsHeader
        isMobile={isMobile}
        setDialogOpen={setDialogOpen}
        peopleScope={peopleScope}
        setPeopleScope={setPeopleScope}
        pipelineTab={pipelineTab}
        setPipelineTab={setPipelineTab}
        peopleBaseTotal={peopleBaseTotal}
        relationshipBaseCount={relationshipBaseCount}
        pipelineContactsLength={pipelineContacts.length}
      />

      <ContactsActionsSection
        isMobile={isMobile}
        isAgentMode={isAgentMode}
        canBulkImport={canBulkImport}
        setDialogOpen={openCreateDialog}
        setAiDialogOpen={setAiDialogOpen}
        statefoxOpen={statefoxOpen}
        setStatefoxOpen={setStatefoxOpen}
        bulkImportOpen={bulkImportOpen}
        setBulkImportOpen={setBulkImportOpen}
        refreshContactsFirstPage={refreshContactsFirstPage}
        handleAutoCreateContactFromDocument={handleAutoCreateContactFromDocument}
        userId={user?.id}
      />

      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="px-4 pt-4 pb-2 md:px-6 md:pt-5 border-b border-border/40">
            <ContactsPipelineControls
              isMobile={isMobile}
              isAgentMode={isAgentMode}
              searchField={searchField}
              setSearchField={setSearchField}
              search={search}
              setSearch={setSearch}
              typeCounts={typeCounts}
              pipelineTab={pipelineTab}
              setPipelineTab={setPipelineTab}
              captacionCount={captacionCount}
              compradoresCount={compradoresCount}
              cerradosCount={cerradosCount}
              redCount={redCount}
              pipelineStages={pipelineStages}
              pipelineContacts={pipelineContacts}
              stageFilter={stageFilter}
              setStageFilter={setStageFilter}
            />
          </div>

          <div className="px-4 md:px-6">
            <ContactsCaptacionPanel pipelineTab={pipelineTab} />

            <ContactsInfluenceCirclePanel
              isMobile={isMobile}
              isCircleView={isCircleView}
              pipelineContactsLength={pipelineContacts.length}
              circleTierCounts={circleTierCounts}
              circleValidationCounts={circleValidationCounts}
              circleTierFilter={circleTierFilter}
              setCircleTierFilter={setCircleTierFilter}
              circleValidationFilter={circleValidationFilter}
              setCircleValidationFilter={setCircleValidationFilter}
            />

            <ContactsListPanel
              contacts={pipelineContacts}
              isMobile={isMobile}
              pipelineStages={pipelineStages}
              healthColors={healthColors}
              onOpenVisits={fetchContactVisits}
              onOpenSummary={fetchSummary}
              summaryLoading={summaryLoading}
              summaryOpen={summaryOpen}
              onPhoneLogged={refreshContactsFirstPage}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalCount={isCircleView ? pipelineContacts.length : totalCount}
              typeLabels={typeLabels}
              showCircleMeta={isCircleView}
              circleMeta={circleMeta}
            />
          </div>
        </CardContent>
      </Card>

      <ContactsMobileFab isMobile={isMobile} onOpenCreate={openCreateDialog} />

      <ContactsInsightsDialogs
        visitsOpen={visitsOpen}
        onVisitsOpenChange={setVisitsOpen}
        visitsLoading={visitsLoading}
        contactVisits={contactVisits}
        summaryOpen={summaryOpen}
        onSummaryOpenChange={setSummaryOpen}
        summaryLoading={summaryLoading}
        summary={summary}
      />

      <ContactCreateDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        dialogStep={dialogStep}
        setDialogStep={setDialogStep}
        form={form}
        setForm={setForm}
        formTags={formTags}
        setFormTags={setFormTags}
        formTagInput={formTagInput}
        setFormTagInput={setFormTagInput}
        loading={loading}
        onSubmit={handleSubmit}
      />

      <ContactsAiCreateDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onCreated={(id) => navigate(`/contacts/${id}`)}
      />

    </div>
  );
};

export default Contacts;
