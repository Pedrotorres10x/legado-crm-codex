import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Search, Users, Phone, Mail, Sparkles, Loader2, Calendar, CheckCircle, Clock, Bot, ChevronLeft, ChevronRight } from 'lucide-react';
import AIContactCreator from '@/components/AIContactCreator';
import PortalLeadUploadDialog from '@/components/PortalLeadUploadDialog';
import DocumentScanner from '@/components/DocumentScanner';
import BulkImportContacts from '@/components/BulkImportContacts';
import ContactCreateDialog from '@/components/contacts/ContactCreateDialog';
import ContactsInsightsDialogs from '@/components/contacts/ContactsInsightsDialogs';
import ContactsListPanel from '@/components/contacts/ContactsListPanel';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import AgentFilter from '@/components/AgentFilter';
import { useContactHealthColors } from '@/hooks/useHealthColors';
import { SUGGESTED_CONTACT_TAGS } from '@/lib/contact-tags';
import HealthDot from '@/components/HealthDot';
import PhoneLink from '@/components/PhoneLink';
import { useIsMobile } from '@/hooks/use-mobile';
import { EMPTY_CONTACT_CREATE_FORM, useContactCreate } from '@/hooks/useContactCreate';
import { PIPELINE_TYPE_MAP, useContactsPipeline } from '@/hooks/useContactsPipeline';
import { cn } from '@/lib/utils';
import { ensureContactFromDocument } from '@/lib/document-onboarding';
import { getRelationshipTier, getRelationshipValidation, isInfluenceCircleContact } from '@/lib/agent-influence-circle';
import { useWorkspacePersona } from '@/hooks/useWorkspacePersona';
import AISectionGuide from '@/components/ai/AISectionGuide';

const typeLabels: Record<string, string> = { contacto: 'Contacto', prospecto: 'Prospecto (dueño sin firmar)', propietario: 'Propietario (cliente)', comprador: 'Comprador', comprador_cerrado: 'Comprador (cerrado)', vendedor_cerrado: 'Vendedor (cerrado)', ambos: 'Ambos', colaborador: 'Colaborador', statefox: 'Statefox' };
const statusLabels: Record<string, string> = { nuevo: 'Nuevo', en_seguimiento: 'En seguimiento', activo: 'Activo', cerrado: 'Cerrado' };

/* ─── Mini-funnel summary ─── */
const MiniFunnel = ({
  typeCounts,
  activeTab,
  onTabChange,
}: {
  typeCounts: Record<string, number>;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) => {
  const captacionTotal = (typeCounts['statefox'] ?? 0) + (typeCounts['prospecto'] ?? 0) + (typeCounts['propietario'] ?? 0);
  const compradoresTotal = (typeCounts['comprador'] ?? 0) + (typeCounts['ambos'] ?? 0);
  const cerradosTotal = (typeCounts['comprador_cerrado'] ?? 0) + (typeCounts['vendedor_cerrado'] ?? 0);

  const funnels = [
    { key: 'captacion', label: 'Captación', icon: '🏠', count: captacionTotal, color: 'bg-amber-500' },
    { key: 'compradores', label: 'Compradores', icon: '🛒', count: compradoresTotal, color: 'bg-blue-500' },
    { key: 'cerrados', label: 'Cerrados', icon: '✅', count: cerradosTotal, color: 'bg-emerald-500' },
  ];

  const maxCount = Math.max(...funnels.map(f => f.count), 1);

  return (
    <div className="flex gap-3 items-end">
      {funnels.map((f) => (
        <button
          key={f.key}
          onClick={() => onTabChange(f.key)}
          className={cn(
            'flex-1 rounded-xl border p-3 transition-all text-left hover:shadow-md',
            activeTab === f.key
              ? 'border-primary/50 bg-primary/5 shadow-sm'
              : 'border-border bg-card hover:border-primary/30'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">{f.icon} {f.label}</span>
            <span className="text-lg font-bold">{f.count.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', f.color)}
              style={{ width: `${Math.max((f.count / maxCount) * 100, 4)}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
};

/* ─── Stage sub-filter badges ─── */
const StageSubFilter = ({
  stages,
  contacts,
  activeStage,
  onStageChange,
}: {
  stages: { key: string; label: string; color: string }[];
  contacts: any[];
  activeStage: string | null;
  onStageChange: (stage: string | null) => void;
}) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onStageChange(null)}
        className={cn(
          'text-xs px-2.5 py-1 rounded-full border transition-colors',
          !activeStage
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
        )}
      >
        Todos
      </button>
      {stages.map((s) => {
        const count = contacts.filter(c => (c as any).pipeline_stage === s.key).length;
        return (
          <button
            key={s.key}
            onClick={() => onStageChange(activeStage === s.key ? null : s.key)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5',
              activeStage === s.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}
          >
            <span className={cn('h-2 w-2 rounded-full', s.color)} />
            {s.label}
            {count > 0 && <span className="opacity-70">({count})</span>}
          </button>
        );
      })}
    </div>
  );
};

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<'type' | 'form'>('type');
  const [summaryOpen, setSummaryOpen] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [pipelineTab, setPipelineTab] = useState<'captacion' | 'compradores' | 'cerrados' | 'red'>('captacion');
  const [peopleScope, setPeopleScope] = useState<'all' | 'circle'>('all');
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [circleTierFilter, setCircleTierFilter] = useState<'all' | 'oro' | 'plata' | 'bronce'>('all');
  const [circleValidationFilter, setCircleValidationFilter] = useState<'all' | 'validado' | 'potencial' | 'sin_validar'>('all');
  const [contactVisits, setContactVisits] = useState<any[]>([]);
  const [visitsOpen, setVisitsOpen] = useState<string | null>(null);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const canBulkImport = isAdmin || isCoordinadora;
  const [showAll, setShowAll] = useState(true);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagInput, setFormTagInput] = useState('');
  const [form, setForm] = useState(EMPTY_CONTACT_CREATE_FORM);

  useEffect(() => {
    if (searchParams.get('quickCreate') === '1') {
      setDialogOpen(true);
    }
  }, [searchParams]);

  const handleAutoCreateContactFromDocument = async (data: any) => {
    try {
      const result = await ensureContactFromDocument(data, user?.id);
      toast({
        title: result.created ? 'Contacto creado desde documento' : 'Contacto ya existente',
        description: result.created ? 'El alta se ha generado automaticamente desde el DNI/documento.' : 'He reutilizado el contacto existente para evitar duplicados.',
      });
      navigate(`/contacts/${result.contactId}`);
    } catch (error: any) {
      toast({
        title: 'No se pudo dar de alta el contacto',
        description: error.message || 'Faltan datos suficientes en el documento.',
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

  const fetchContactVisits = async (contactId: string) => {
    setVisitsOpen(contactId);
    setVisitsLoading(true);
    const { data } = await supabase
      .from('visits')
      .select('*, properties(title)')
      .eq('contact_id', contactId)
      .order('visit_date', { ascending: false });
    setContactVisits(data || []);
    setVisitsLoading(false);
  };

  const fetchSummary = async (contactId: string) => {
    setSummaryOpen(contactId);
    setSummaryLoading(true);
    setSummary('');
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ contact_id: contactId }),
      });
      const data = await resp.json();
      if (data.error) { toast({ title: 'Error IA', description: data.error, variant: 'destructive' }); setSummaryOpen(null); }
      else setSummary(data.summary);
    } catch { toast({ title: 'Error', description: 'No se pudo conectar con IA', variant: 'destructive' }); setSummaryOpen(null); }
    setSummaryLoading(false);
  };

  const healthColors = useContactHealthColors(contacts);

  const handleSubmit = async () => {
    const result = await createContact(form, formTags);
    if (!result.ok) return;
    setDialogOpen(false);
    setDialogStep('type');
    setForm(emptyForm);
    setFormTags([]);
    setFormTagInput('');
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
      <AISectionGuide
        title="Personas: aqui empieza casi todo"
        context="Aqui trabajas personas y relaciones: circulo, zona, prospectos vendedores y compradores. Si esta base esta viva, el negocio nace solo."
        doNow={`Ahora mismo tienes ${uviCount} contacto${uviCount === 1 ? '' : 's'} en UVI, ${prospectCount} prospecto${prospectCount === 1 ? '' : 's'} vendedor${prospectCount === 1 ? '' : 'es'} y ${buyerCount} comprador${buyerCount === 1 ? '' : 'es'} activos. Empieza por ahi.`}
        dontForget="Prospecto es el dueño que aun no ha firmado. Propietario es cliente. Si clasificas mal, luego haces toques malos y pierdes negocio."
        risk="Una base fria o mal segmentada te deja sin visitas de captacion, sin recomendaciones y sin ventas futuras."
        actions={[
          { label: 'Que hago primero aqui', description: 'Revisa UVI, sube contactos nuevos y marca bien si son circulo, zona, prospecto o comprador.' },
          { label: 'Que contacto tiene mas valor', description: 'El que te puede abrir un propietario, una visita de captacion o una venta en el corto plazo.' },
          { label: 'Cuando un dueno deja de ser prospecto', description: 'Cuando firma con nosotros y pasa a ser propietario cliente.' },
        ]}
      />

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Base de negocio</p>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Personas</h1>
            <p className="text-sm text-muted-foreground">
              Tu negocio nace aqui: relaciones, prospectos vendedores, compradores y contactos que te pueden abrir la siguiente captacion.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Base total</p>
              <p className="mt-2 text-2xl font-bold">{peopleBaseTotal}</p>
              <p className="mt-1 text-xs text-muted-foreground">Personas registradas para trabajar negocio.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Circulo de influencia</p>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Relacional</Badge>
              </div>
              <p className="mt-2 text-2xl font-bold">{relationshipBaseCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Base relacional que puede abrir referrals, propietarios y negocio futuro.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Prospectos vendedores</p>
              <p className="mt-2 text-2xl font-bold">{prospectCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Dueños que aun no han firmado con nosotros.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Compradores + UVI</p>
              <p className="mt-2 text-2xl font-bold">{buyerCount + uviCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Negocio activo que pide seguimiento y siguiente paso.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Bandeja de personas</h2>
          <p className="text-sm text-muted-foreground">
            {peopleScope === 'circle'
              ? `${pipelineContacts.length} personas del círculo de influencia visibles para trabajar relación y referral.`
              : `${peopleBaseTotal} personas registradas para captar, vender y cuidar relaciones.`}
          </p>
        </div>
        {!isMobile && (
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Añadir persona</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: `Toda la base (${peopleBaseTotal})` },
          { key: 'circle', label: `Solo círculo de influencia (${relationshipBaseCount})` },
        ].map((option) => (
          <Button
            key={option.key}
            variant={peopleScope === option.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setPeopleScope(option.key as typeof peopleScope);
              if (option.key === 'circle' && pipelineTab !== 'red') {
                setPipelineTab('red');
              }
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {!isMobile && (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <Accordion type="single" collapsible defaultValue="actions">
            <AccordionItem value="actions" className="border-b-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="min-w-0 text-left">
                  <p className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {isAgentMode ? 'Dar de alta contactos' : 'Altas y automatizaciones'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAgentMode
                      ? 'Empieza por alta manual o DNI. Lo demás puede esperar.'
                      : 'Crear contactos manualmente o apoyarte en documento, IA e importación.'}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className={cn('grid gap-3 md:grid-cols-2', !isAgentMode && 'xl:grid-cols-4')}>
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm font-medium">Alta manual</p>
                    <p className="text-xs text-muted-foreground mt-1">Crear un contacto nuevo con lo mínimo útil para empezar a trabajar.</p>
                    <Button className="mt-3 w-full" onClick={() => setDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />Añadir persona
                    </Button>
                  </div>
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm font-medium">Alta por DNI</p>
                    <p className="text-xs text-muted-foreground mt-1">Extraer datos desde documento y evitar duplicados.</p>
                    <div className="mt-3">
                      <DocumentScanner context="contact" buttonLabel="Escanear DNI" onExtracted={handleAutoCreateContactFromDocument} />
                    </div>
                  </div>
                  {!isAgentMode && (
                    <div className="rounded-xl border border-border/60 p-4">
                      <p className="text-sm font-medium">Crear con IA</p>
                      <p className="text-xs text-muted-foreground mt-1">Levantar un contacto a partir de texto guiado por IA.</p>
                      <Button variant="outline" className="mt-3 w-full hover-lift" onClick={() => setAiDialogOpen(true)}>
                        <Bot className="h-4 w-4 mr-2" />Crear con IA
                      </Button>
                    </div>
                  )}
                  {!isAgentMode && (
                    <div className="rounded-xl border border-border/60 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium">Importación y portales</p>
                        <p className="text-xs text-muted-foreground mt-1">Subir leads externos o lotes de contactos.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <PortalLeadUploadDialog />
                        {canBulkImport && (
                          <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
                            <Users className="h-4 w-4 mr-2" />Importar contactos
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}

      {/* ── Mini-funnel summary ── */}
      {!isMobile && (
        <MiniFunnel typeCounts={typeCounts} activeTab={pipelineTab} onTabChange={(t) => setPipelineTab(t as any)} />
      )}

      {/* ── Search & filter ── */}
      <div className="flex flex-wrap gap-2 md:gap-3">
        {!isMobile && !isAgentMode && (
          <Select value={searchField} onValueChange={(v: any) => setSearchField(v)}>
            <SelectTrigger className="w-[130px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="phone">Teléfono</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="city">Ciudad</SelectItem>
              <SelectItem value="id_number">DNI/NIE</SelectItem>
              <SelectItem value="tags">Etiqueta</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar persona..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Tabs: 4 consolidated tabs (desktop only) ── */}
      {!isMobile && (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <Tabs value={pipelineTab} onValueChange={v => setPipelineTab(v as any)}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="captacion">🏠 Captación ({captacionCount})</TabsTrigger>
              <TabsTrigger value="compradores">🛒 Compradores ({compradoresCount})</TabsTrigger>
              <TabsTrigger value="cerrados">✅ Cerrados ({cerradosCount})</TabsTrigger>
              <TabsTrigger value="red">🤝 Círculo de influencia ({redCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {pipelineTab === 'captacion' && (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">La exclusiva se gana en la relacion</p>
                <p className="text-sm text-muted-foreground">
                  Si el dueño confia en ti, te da la exclusiva sin pelear honorarios. Si te centras solo en el piso, compites como uno mas y solo te elegira si eres mas barato.
                </p>
              </div>
              <Badge className="bg-amber-500 text-white border-0">Captacion</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Que construir</p>
                <p className="mt-2 text-sm font-medium">Confianza, credibilidad y seguimiento</p>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Que evitar</p>
                <p className="mt-2 text-sm font-medium">Pelear honorarios antes de haber ganado la relacion</p>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Siguiente paso sano</p>
                <p className="mt-2 text-sm font-medium">Llevar prospecto a visita de captacion y de ahi a exclusiva</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Stage sub-filter badges (desktop only) ── */}
      {!isMobile && (
        <StageSubFilter
          stages={pipelineStages}
          contacts={pipelineContacts}
          activeStage={stageFilter}
          onStageChange={setStageFilter}
        />
      )}

      {!isMobile && isCircleView && (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground border-0">Círculo de influencia</Badge>
                <Badge variant="outline">Personas clave</Badge>
              </div>
              <p className="text-sm font-semibold">Base relacional con potencial real de referral</p>
              <p className="text-xs text-muted-foreground">
                Trabaja aqui los contactos con mas potencial de referral y segmentalos por valor relacional y validacion real.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Base util visible</p>
                <p className="mt-2 text-2xl font-bold">{pipelineContacts.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Contactos del circulo en esta bandeja despues de filtros.</p>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Distribucion relacional</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-amber-500 text-white border-0">Oro {circleTierCounts.oro}</Badge>
                  <Badge className="bg-slate-400 text-white border-0">Plata {circleTierCounts.plata}</Badge>
                  <Badge className="bg-orange-700 text-white border-0">Bronce {circleTierCounts.bronce}</Badge>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Validacion CRM</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-emerald-500 text-white border-0">Validados {circleValidationCounts.validado}</Badge>
                  <Badge className="bg-blue-500 text-white border-0">Potenciales {circleValidationCounts.potencial}</Badge>
                  <Badge variant="outline">Sin validar {circleValidationCounts.sin_validar}</Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Filtro relacional</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'oro', label: `Oro (${circleTierCounts.oro})` },
                    { key: 'plata', label: `Plata (${circleTierCounts.plata})` },
                    { key: 'bronce', label: `Bronce (${circleTierCounts.bronce})` },
                  ].map((option) => (
                    <Button
                      key={option.key}
                      variant={circleTierFilter === option.key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCircleTierFilter(option.key as typeof circleTierFilter)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Filtro de validacion</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'validado', label: `Validados (${circleValidationCounts.validado})` },
                    { key: 'potencial', label: `Potenciales (${circleValidationCounts.potencial})` },
                    { key: 'sin_validar', label: `Sin validar (${circleValidationCounts.sin_validar})` },
                  ].map((option) => (
                    <Button
                      key={option.key}
                      variant={circleValidationFilter === option.key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCircleValidationFilter(option.key as typeof circleValidationFilter)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* ── Mobile FAB ── */}
      {isMobile && (
        <button
          onClick={() => setDialogOpen(true)}
          className="fixed right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 4px 20px hsl(var(--primary) / 0.4)' }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

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
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open && searchParams.get('quickCreate') === '1') {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('quickCreate');
              return next;
            }, { replace: true });
          }
          if (!open) {
            setDialogStep('type');
            setForm(emptyForm);
            setFormTags([]);
            setFormTagInput('');
          }
        }}
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

      {/* AI Contact Creator Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Crear contacto con IA
            </DialogTitle>
          </DialogHeader>
          <AIContactCreator
            onCreated={(id) => { setAiDialogOpen(false); navigate(`/contacts/${id}`); }}
            onCancel={() => setAiDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {canBulkImport && (
        <BulkImportContacts
          open={bulkImportOpen}
          onClose={() => setBulkImportOpen(false)}
          onImported={refreshContactsFirstPage}
          agentId={user?.id ?? ''}
        />
      )}
    </div>
  );
};

export default Contacts;
