import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, CheckCircle2, Clock, AlertTriangle, Calendar,
  User, ExternalLink, Landmark, HandCoins, Handshake, ArrowRight, ShieldAlert, CircleCheckBig,
  Send, Link, Loader2, X
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import ArrasBuyerField from '@/components/ArrasBuyerField';
import ClosingTransactionalDialogs from '@/components/closing/ClosingTransactionalDialogs';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  buildClosingOperationalBlockers,
  CLOSING_DOC_LABELS,
  CLOSING_REQUIRED_DOCS,
  getClosingActiveStep,
  isClosingStepComplete,
  type ClosingStepKey,
} from '@/lib/closing-ops';
import {
  buildArrasStatusUpdates,
  buildClosingStageAdvanceUpdates,
} from '@/lib/closing-workflow';
import { type TransactionalTemplateKind } from '@/lib/contract-generation';
import {
  type TransactionalContract,
  useClosingTransactionalContracts,
} from '@/hooks/useClosingTransactionalContracts';
import { useClosingPostSale } from '@/hooks/useClosingPostSale';

interface ClosingWorkflowProps {
  property: {
    id: string;
    status?: string | null;
    reservation_date?: string | null;
    reservation_amount?: number | string | null;
    arras_status?: string | null;
    arras_date?: string | null;
    arras_amount?: number | string | null;
    arras_buyer_id?: string | null;
    deed_date?: string | null;
    deed_notary?: string | null;
    closing_notes?: string | null;
    legal_risk_level?: string | null;
  };
  propertyOwners: Array<{
    id: string;
    contact_id?: string | null;
    contact?: {
      id?: string | null;
      full_name?: string | null;
    } | null;
  }>;
  onCommitField: (updates: Record<string, string | number | null>) => void;
  onSetProperty: (fn: (p: ClosingWorkflowProps['property']) => ClosingWorkflowProps['property']) => void;
}

const STEPS = [
  { key: 'reserva', label: 'Reserva', icon: HandCoins },
  { key: 'arras', label: 'Arras', icon: Handshake },
  { key: 'escritura', label: 'Escritura', icon: Landmark },
] as const;

type ClosingOpsSnapshot = {
  requiredDocs: string[];
  uploadedDocTypes: string[];
  pendingSignatureCount: number;
  signedContractsCount: number;
};

const ClosingWorkflow = ({ property, propertyOwners, onCommitField, onSetProperty }: ClosingWorkflowProps) => {
  const navigate = useNavigate();
  const activeStep = getClosingActiveStep(property);
  const [opsSnapshot, setOpsSnapshot] = useState<ClosingOpsSnapshot>({
    requiredDocs: [],
    uploadedDocTypes: [],
    pendingSignatureCount: 0,
    signedContractsCount: 0,
  });
  const [loadingOps, setLoadingOps] = useState(true);
  const {
    agentProfile,
    buyerContact,
    copyAllLinks,
    copySignLink,
    generatedLinks,
    generatingKind,
    getSignUrl,
    linksDialogOpen,
    openExistingLinks,
    openSignerDialog,
    revokeSignature,
    revokingContractId,
    searchContacts,
    sendTransactionalToSign,
    sendingToSign,
    setGeneratedLinks,
    setLinksDialogOpen,
    setSignerContacts,
    setSignerCountOpen,
    setSignerSearchResults,
    setSignerSearchTerms,
    signerContacts,
    signerCount,
    signerCountOpen,
    signerSearchResults,
    signerSearchTerms,
    signerSearching,
    transactionalContracts,
    transactionalReadiness,
    transactionalSummary,
    updateSignerCount,
    generateTransactionalDraft,
  } = useClosingTransactionalContracts({
    property,
    propertyOwners,
  });
  const { summary: postSaleSummary, loading: loadingPostSale } = useClosingPostSale({
    propertyId: property.id,
    propertyStatus: property.status,
  });

  const deedDaysLeft = property.deed_date
    ? differenceInDays(new Date(property.deed_date), new Date())
    : null;

  const deedOverdue = property.deed_date && isPast(new Date(property.deed_date))
    && property.status !== 'vendido' && property.status !== 'alquilado';

  useEffect(() => {
    let cancelled = false;

    const fetchOpsSnapshot = async () => {
      setLoadingOps(true);

      const [docsRes, contractsRes] = await Promise.all([
        supabase
          .from('property_documents')
          .select('doc_type')
          .eq('property_id', property.id),
        supabase
          .from('documents')
          .select(`
            id,
            generated_contracts(signature_status),
            document_properties!inner(property_id)
          `)
          .eq('document_properties.property_id', property.id),
      ]);

      if (cancelled) return;

      const uploadedDocTypes = Array.from(new Set((docsRes.data || []).map((doc: { doc_type?: string | null }) => doc.doc_type).filter(Boolean)));
      const contracts = (contractsRes.data || [])
        .map((doc: { generated_contracts?: { signature_status?: string | null } | null }) => doc.generated_contracts)
        .filter(Boolean);

      setOpsSnapshot({
        requiredDocs: CLOSING_REQUIRED_DOCS[activeStep],
        uploadedDocTypes,
        pendingSignatureCount: contracts.filter((contract) => contract.signature_status === 'pendiente').length,
        signedContractsCount: contracts.filter((contract) => contract.signature_status === 'firmado').length,
      });
      setLoadingOps(false);
    };

    fetchOpsSnapshot();

    return () => {
      cancelled = true;
    };
  }, [property.id, activeStep]);

  const missingRequiredDocs = useMemo(
    () => opsSnapshot.requiredDocs.filter((docType) => !opsSnapshot.uploadedDocTypes.includes(docType)),
    [opsSnapshot.requiredDocs, opsSnapshot.uploadedDocTypes],
  );

  const operationalAnalysis = useMemo(() => buildClosingOperationalBlockers({
    property,
    propertyOwnerCount: propertyOwners.length,
    uploadedDocTypes: opsSnapshot.uploadedDocTypes,
    pendingSignatureCount: opsSnapshot.pendingSignatureCount,
  }), [property, propertyOwners.length, opsSnapshot.uploadedDocTypes, opsSnapshot.pendingSignatureCount]);

  const operationalBlockers = operationalAnalysis.blockers;
  const primaryOwner = propertyOwners[0]?.contact || null;

  const stageReadiness = useMemo(() => {
    if (loadingOps) {
      return {
        label: 'Revisando expediente...',
        tone: 'secondary' as const,
        description: 'Estoy comprobando documentos, riesgo legal y firmas.',
      };
    }

    if (operationalBlockers.length > 0) {
      return {
        label: 'Bloqueado',
        tone: 'destructive' as const,
        description: operationalBlockers[0],
      };
    }

    if (activeStep === 'escritura' && (property.status === 'vendido' || property.status === 'alquilado')) {
      return {
        label: 'Cierre completado',
        tone: 'default' as const,
        description: 'La operacion ya figura como cerrada.',
      };
    }

    return {
      label: 'Listo para avanzar',
      tone: 'default' as const,
      description: activeStep === 'reserva'
        ? 'La reserva ya tiene base suficiente para pasar a arras.'
        : activeStep === 'arras'
          ? 'La operacion puede pasar a firma de arras sin bloqueos visibles.'
          : 'La escritura esta preparada a nivel operativo.',
    };
  }, [loadingOps, operationalBlockers, activeStep, property.status]);

  const nextAction = useMemo(() => {
    if (activeStep === 'reserva') {
      if (!property.reservation_date) return 'Registrar la reserva y la senal inicial.';
      return operationalBlockers.length > 0 ? 'Resolver bloqueos para pasar a arras.' : 'Pasar la operacion a arras.';
    }

    if (activeStep === 'arras') {
      return operationalBlockers.length > 0
        ? 'Completar comprador, fecha, importe o expediente antes de firmar.'
        : 'Dejar arras firmado y programar escritura.';
    }

    if (property.status === 'vendido' || property.status === 'alquilado') {
      return 'Operacion cerrada. Solo quedaria postventa o archivo.';
    }

    return operationalBlockers.length > 0
      ? 'Resolver bloqueos de escritura y firmas pendientes.'
      : 'Marcar cierre cuando se firme la escritura.';
  }, [activeStep, property.reservation_date, property.status, operationalBlockers.length]);

  const handleAdvanceStage = () => {
    onCommitField(buildClosingStageAdvanceUpdates(property, activeStep));
  };

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />Flujo de cierre
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className={`rounded-xl border px-4 py-3 ${
            stageReadiness.tone === 'destructive'
              ? 'border-destructive/30 bg-destructive/10'
              : 'border-emerald-300 bg-emerald-50'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado operativo</p>
                <p className="text-sm font-medium mt-1">{stageReadiness.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{stageReadiness.description}</p>
              </div>
              {stageReadiness.tone === 'destructive' ? (
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
              ) : (
                <CircleCheckBig className="h-5 w-5 text-emerald-600 shrink-0" />
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expediente</p>
            <p className="text-sm mt-1">
              {missingRequiredDocs.length > 0
                ? `${missingRequiredDocs.length} documento(s) clave pendiente(s)`
                : 'Documentacion clave cubierta'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {missingRequiredDocs.length > 0
                ? missingRequiredDocs.map((doc) => CLOSING_DOC_LABELS[doc] || doc).join(', ')
                : `${opsSnapshot.uploadedDocTypes.length} tipo(s) de documento subido(s)`}
            </p>
          </div>

          <div className="rounded-xl border bg-muted/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Firma y legal</p>
            <p className="text-sm mt-1">
              {opsSnapshot.pendingSignatureCount > 0
                ? `${opsSnapshot.pendingSignatureCount} firma(s) pendiente(s)`
                : opsSnapshot.signedContractsCount > 0
                  ? `${opsSnapshot.signedContractsCount} documento(s) firmado(s)`
                  : 'Sin firmas en curso'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Riesgo legal: {property.legal_risk_level ? property.legal_risk_level.replace('_', ' ') : 'sin analisis'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border px-4 py-3 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Siguiente paso</p>
              <p className="text-sm font-medium mt-1">{nextAction}</p>
            </div>
            <Button
              size="sm"
              variant={operationalBlockers.length > 0 ? 'outline' : 'default'}
              onClick={handleAdvanceStage}
              disabled={loadingOps || operationalBlockers.length > 0}
            >
              {activeStep === 'reserva'
                ? 'Pasar a arras'
                : activeStep === 'arras'
                  ? 'Marcar arras firmado'
                  : 'Marcar cierre'}
            </Button>
          </div>
        </div>

        {(property.status === 'vendido' || property.status === 'alquilado') && (
          <div className={`rounded-xl border px-4 py-3 ${
            postSaleSummary.tone === 'destructive'
              ? 'border-destructive/20 bg-destructive/5'
              : 'bg-card'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Postventa y cobro</p>
                <p className="text-sm font-medium mt-1">
                  {loadingPostSale ? 'Revisando comisión y facturación...' : postSaleSummary.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{postSaleSummary.nextAction}</p>
              </div>
              <Badge variant={postSaleSummary.tone === 'destructive' ? 'destructive' : 'outline'}>
                {postSaleSummary.invoicesCount} factura{postSaleSummary.invoicesCount === 1 ? '' : 's'}
              </Badge>
            </div>
            {!loadingPostSale && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
                <div className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="font-medium text-foreground">Comisión</p>
                  <p className="mt-1">
                    {postSaleSummary.hasCommission
                      ? `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(postSaleSummary.commissionAmount)} · ${postSaleSummary.commissionStatus || 'sin estado'}`
                      : 'Sin comisión registrada'}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="font-medium text-foreground">Facturación</p>
                  <p className="mt-1">
                    {postSaleSummary.invoicesCount > 0
                      ? `${postSaleSummary.paidInvoicesCount}/${postSaleSummary.invoicesCount} cerradas`
                      : 'Sin facturas generadas'}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="font-medium text-foreground">Importe</p>
                  <p className="mt-1">
                    {postSaleSummary.totalAmount > 0
                      ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(postSaleSummary.totalAmount)
                      : 'Sin importe facturado'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {operationalBlockers.length > 0 && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Bloqueos</p>
            <div className="mt-2 space-y-2">
              {operationalBlockers.map((blocker) => (
                <div key={blocker} className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{blocker}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const complete = isClosingStepComplete(step.key, property);
            const isCurrent = step.key === activeStep && !complete;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ring-2 transition-colors ${
                    complete
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 ring-green-300'
                      : isCurrent
                        ? 'bg-primary/10 text-primary ring-primary/40'
                        : 'bg-muted text-muted-foreground ring-border'
                  }`}>
                    {complete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs mt-1.5 font-medium ${
                    complete ? 'text-green-600' : isCurrent ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className={`h-4 w-4 shrink-0 mb-5 ${complete ? 'text-green-400' : 'text-border'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Deadline alert */}
        {deedDaysLeft !== null && property.arras_status === 'firmado' && property.status !== 'vendido' && property.status !== 'alquilado' && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            deedOverdue
              ? 'bg-destructive/10 text-destructive'
              : deedDaysLeft <= 7
                ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700'
                : 'bg-muted text-muted-foreground'
          }`}>
            {deedOverdue ? (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-medium">Escritura vencida hace {Math.abs(deedDaysLeft)} días</span>
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Escritura en <strong>{deedDaysLeft} días</strong> ({format(new Date(property.deed_date), "dd MMM yyyy", { locale: es })})</span>
              </>
            )}
          </div>
        )}

        {/* ── RESERVA ── */}
        <div className="space-y-3 border-l-2 border-border pl-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <HandCoins className="h-4 w-4" />Reserva (señal)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Fecha reserva</Label>
              <Input
                type="date"
                value={property.reservation_date || ''}
                onChange={e => onCommitField({ reservation_date: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Importe señal (€)</Label>
              <Input
                type="number"
                min={0}
                value={property.reservation_amount || ''}
                placeholder="0"
                onBlur={e => onCommitField({ reservation_amount: parseFloat(e.target.value) || null })}
                onChange={e => onSetProperty((p) => ({ ...p, reservation_amount: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* ── ARRAS ── */}
        <div className="space-y-3 border-l-2 border-border pl-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Handshake className="h-4 w-4" />Contrato de arras
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select
                value={property.arras_status || 'sin_arras'}
                onValueChange={v => {
                  onCommitField(buildArrasStatusUpdates(property, v));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_arras">Sin arras</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="firmado">Firmado</SelectItem>
                  <SelectItem value="resuelto">Resuelto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Fecha de firma</Label>
              <Input
                type="date"
                value={property.arras_date || ''}
                onChange={e => onCommitField({ arras_date: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Importe (€)</Label>
              <Input
                type="number"
                min={0}
                value={property.arras_amount || ''}
                placeholder="0"
                onBlur={e => onCommitField({ arras_amount: parseFloat(e.target.value) || 0 })}
                onChange={e => onSetProperty((p) => ({ ...p, arras_amount: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* ── ESCRITURA ── */}
        <div className="space-y-3 border-l-2 border-border pl-4">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4" />Escritura pública
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Fecha escritura</Label>
              <Input
                type="date"
                value={property.deed_date || ''}
                onChange={e => onCommitField({ deed_date: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notaría</Label>
              <Input
                value={property.deed_notary || ''}
                placeholder="Nombre de la notaría..."
                onBlur={e => onCommitField({ deed_notary: e.target.value || null })}
                onChange={e => onSetProperty((p) => ({ ...p, deed_notary: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* ── PARTES ── */}
        <div className="space-y-3 border-l-2 border-border pl-4">
          <p className="text-sm font-semibold">Partes</p>

          {/* Sellers */}
          {propertyOwners.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Vendedor(es)</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {propertyOwners.map((po) => (
                  <Badge
                    key={po.id}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-accent gap-1"
                    onClick={() => navigate(`/contacts/${po.contact?.id || po.contact_id}`)}
                  >
                    <User className="h-3 w-3" />
                    {po.contact?.full_name || 'Propietario'}
                    <ExternalLink className="h-2.5 w-2.5 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Buyer */}
          <ArrasBuyerField
            buyerId={property.arras_buyer_id}
            onSelect={id => onCommitField({ arras_buyer_id: id })}
            onClear={() => onCommitField({ arras_buyer_id: null })}
            onNavigate={id => navigate(`/contacts/${id}`)}
          />
        </div>

        <div className="space-y-3 border-l-2 border-border pl-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />Contratos transaccionales
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Genera borradores de reserva y arras con los datos actuales del inmueble, comprador y propietario.
              </p>
            </div>
            {buyerContact?.id && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/contacts/${buyerContact.id}`)}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Abrir comprador
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(['reserva', 'arras'] as TransactionalTemplateKind[]).map((kind) => {
              const latest = transactionalSummary[kind];
              const config = transactionalReadiness[kind];
              const disabled = !config.template || !!config.disabledReason || generatingKind !== null;
              const statusLabel = latest
                ? latest.signature_status === 'firmado'
                  ? 'Firmado'
                  : latest.signature_status === 'pendiente'
                    ? 'Pendiente de firma'
                    : 'Borrador generado'
                : 'Sin borrador';
              const signerStats = latest
                ? {
                    total: latest.contract_signers?.length || 0,
                    signed: (latest.contract_signers || []).filter((signer) => signer.signature_status === 'firmado').length,
                    pending: (latest.contract_signers || []).filter((signer) => signer.signature_status === 'pendiente').length,
                  }
                : null;

              return (
                <div key={kind} className="rounded-xl border bg-muted/20 px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{kind === 'reserva' ? 'Reserva' : 'Arras'}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {config.template ? config.template.name : 'No hay plantilla detectada'}
                      </p>
                    </div>
                    <Badge variant={latest ? 'default' : 'secondary'}>{statusLabel}</Badge>
                  </div>

                  {latest && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Ultimo movimiento: {format(new Date(latest.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </p>
                      {signerStats && signerStats.total > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Firmantes: {signerStats.signed}/{signerStats.total} firmados
                          {signerStats.pending > 0 ? ` · ${signerStats.pending} pendiente(s)` : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {(config.disabledReason || !config.template) && (
                    <p className="text-xs text-amber-700">
                      {config.disabledReason || `Crea una plantilla de ${kind} para activar esta accion.`}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      variant={latest ? 'outline' : 'default'}
                      disabled={disabled}
                      onClick={() => generateTransactionalDraft(kind)}
                    >
                      {generatingKind === kind ? 'Generando...' : latest ? 'Regenerar borrador' : 'Crear borrador'}
                    </Button>
                    {latest && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={latest.signature_status === 'firmado'}
                          onClick={() => openSignerDialog(latest)}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Firmar
                        </Button>
                        {latest.signature_status === 'pendiente' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openExistingLinks(latest)}>
                              <Link className="h-3.5 w-3.5 mr-1" />
                              Enlaces
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={revokingContractId === latest.id}
                              onClick={() => revokeSignature(latest.id)}
                            >
                              {revokingContractId === latest.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1" />}
                              Revocar
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── NOTAS ── */}
        <div>
          <Label className="text-xs text-muted-foreground">Notas de cierre</Label>
          <Textarea
            value={property.closing_notes || ''}
            placeholder="Observaciones sobre el proceso de cierre..."
            rows={2}
            onBlur={e => onCommitField({ closing_notes: e.target.value || null })}
            onChange={e => onSetProperty((p) => ({ ...p, closing_notes: e.target.value }))}
          />
        </div>

        <ClosingTransactionalDialogs
          signerCountOpen={signerCountOpen}
          setSignerCountOpen={setSignerCountOpen}
          signerCount={signerCount}
          updateSignerCount={updateSignerCount}
          signerContacts={signerContacts}
          setSignerContacts={setSignerContacts}
          signerSearchTerms={signerSearchTerms}
          setSignerSearchTerms={setSignerSearchTerms}
          signerSearchResults={signerSearchResults}
          setSignerSearchResults={setSignerSearchResults}
          signerSearching={signerSearching}
          searchContacts={searchContacts}
          sendTransactionalToSign={sendTransactionalToSign}
          sendingToSign={sendingToSign}
          linksDialogOpen={linksDialogOpen}
          setLinksDialogOpen={setLinksDialogOpen}
          generatedLinks={generatedLinks}
          getSignUrl={getSignUrl}
          copySignLink={copySignLink}
          copyAllLinks={copyAllLinks}
        />
      </CardContent>
    </Card>
  );
};

export default ClosingWorkflow;
