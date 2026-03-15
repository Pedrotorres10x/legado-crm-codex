import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type HorusDoc = {
  type: string;
  label: string;
  required_phases: string[];
  has_expiry: boolean;
};

type LegalTrafficLight = {
  level: 'alto' | 'medio' | 'bajo' | 'sin_analisis';
  label: string;
  description: string;
  affectedDocs: number;
};

type AiSummary = {
  summary: string;
  hasIssues: boolean;
  isValidated: boolean;
  inconsistencyCount: number;
  pendingOwnersCount: number;
  autofillCount: number;
  legalHighlights: string[];
  legalWarnings: string[];
  catastroCrossCheck: string[];
  dniCrmCrossCheck: string[];
  pendingOwners: string[];
};

type PropertyDocumentsChecklistPanelProps = {
  completionPct: number;
  reanalyzingAll: boolean;
  handleReanalyzeAll: () => void;
  onAddDocument: () => void;
  legalTrafficLight: LegalTrafficLight;
  expiredDocs: any[];
  expiringDocs: any[];
  missingRequired: string[];
  horusDocs: HorusDoc[];
  docsWithAiIssues: Array<{ doc: any; ai: AiSummary | null }>;
  docsValidatedByAi: Array<{ doc: any; ai: AiSummary | null }>;
  docs: any[];
  propertyStatus: string;
  getAiSummary: (notes?: string | null) => AiSummary | null;
  reanalyzingDocId: string | null;
  handleReanalyzeDocument: (doc: any) => void;
  handleDelete: (doc: any) => void;
  onUploadMissing: (docType: string, label: string) => void;
  resolvingHolder: string | null;
  openLinkExistingDialog: (doc: any, ownerName: string) => void;
  handleCreatePendingOwner: (doc: any, ownerName: string) => void;
};

export function PropertyDocumentsChecklistPanel({
  completionPct,
  reanalyzingAll,
  handleReanalyzeAll,
  onAddDocument,
  legalTrafficLight,
  expiredDocs,
  expiringDocs,
  missingRequired,
  horusDocs,
  docsWithAiIssues,
  docsValidatedByAi,
  docs,
  propertyStatus,
  getAiSummary,
  reanalyzingDocId,
  handleReanalyzeDocument,
  handleDelete,
  onUploadMissing,
  resolvingHolder,
  openLinkExistingDialog,
  handleCreatePendingOwner,
}: PropertyDocumentsChecklistPanelProps) {
  const visibleHorusDocs = horusDocs.filter((h) => h.required_phases.includes(propertyStatus));
  const otherDocs = docs.filter((d) => !horusDocs.some((h) => h.type === d.doc_type));

  const renderAiSummary = (doc: any, aiSummary: AiSummary | null) => {
    if (!aiSummary) return null;

    return (
      <div className="space-y-1">
        <p className={`text-xs ${aiSummary.hasIssues ? 'text-destructive' : 'text-muted-foreground'}`}>
          {aiSummary.summary}
        </p>
        {aiSummary.legalHighlights.length > 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/70 px-2 py-2">
            <p className="text-[11px] font-medium text-emerald-700">Informe legal</p>
            {aiSummary.legalHighlights.slice(0, 3).map((line) => (
              <p key={line} className="mt-1 text-xs text-emerald-700">{line}</p>
            ))}
          </div>
        ) : null}
        {aiSummary.legalWarnings.length > 0 ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-2 py-2">
            <p className="text-[11px] font-medium text-destructive">Warnings legales</p>
            {aiSummary.legalWarnings.slice(0, 3).map((line) => (
              <p key={line} className="mt-1 text-xs text-destructive">{line}</p>
            ))}
          </div>
        ) : null}
        {aiSummary.catastroCrossCheck.length > 0 ? (
          <div className="rounded-md border border-sky-200 bg-sky-50/70 px-2 py-2">
            <p className="text-[11px] font-medium text-sky-700">Cruce con catastro</p>
            {aiSummary.catastroCrossCheck.slice(0, 3).map((line) => (
              <p key={line} className="mt-1 text-xs text-sky-700">{line}</p>
            ))}
          </div>
        ) : null}
        {aiSummary.dniCrmCrossCheck.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50/70 px-2 py-2">
            <p className="text-[11px] font-medium text-amber-700">Cruce con DNI/CRM</p>
            {aiSummary.dniCrmCrossCheck.slice(0, 3).map((line) => (
              <p key={line} className="mt-1 text-xs text-amber-700">{line}</p>
            ))}
          </div>
        ) : null}
        {aiSummary.pendingOwners.map((ownerName) => {
          const actionKey = `${doc.id}:${ownerName}`;
          return (
            <div key={ownerName} className="flex items-center justify-between gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-2 py-2">
              <p className="text-xs text-destructive">
                Titular pendiente: <strong>{ownerName}</strong>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={resolvingHolder === `${actionKey}:search`}
                  onClick={() => openLinkExistingDialog(doc, ownerName)}
                >
                  {resolvingHolder === `${actionKey}:search` ? 'Buscando...' : 'Vincular existente'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={resolvingHolder === actionKey}
                  onClick={() => handleCreatePendingOwner(doc, ownerName)}
                >
                  {resolvingHolder === actionKey ? 'Creando...' : 'Crear contacto'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            Documentación Horus
            <Badge variant={completionPct === 100 ? 'default' : 'secondary'} className="ml-2 text-xs">
              {completionPct}%
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleReanalyzeAll} disabled={reanalyzingAll}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${reanalyzingAll ? 'animate-spin' : ''}`} /> Reanalizar IA
            </Button>
            <Button size="sm" variant="outline" onClick={onAddDocument}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className={`rounded-xl border px-4 py-3 ${
          legalTrafficLight.level === 'alto'
            ? 'border-destructive/30 bg-destructive/10'
            : legalTrafficLight.level === 'medio'
              ? 'border-amber-300 bg-amber-50'
              : legalTrafficLight.level === 'bajo'
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-muted bg-muted/40'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${
                legalTrafficLight.level === 'alto'
                  ? 'text-destructive'
                  : legalTrafficLight.level === 'medio'
                    ? 'text-amber-700'
                    : legalTrafficLight.level === 'bajo'
                      ? 'text-emerald-700'
                      : 'text-muted-foreground'
              }`}>
                Semaforo legal
              </p>
              <p className="text-sm font-medium">{legalTrafficLight.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{legalTrafficLight.description}</p>
            </div>
            <Badge variant={legalTrafficLight.level === 'alto' ? 'destructive' : 'secondary'} className="shrink-0">
              {legalTrafficLight.affectedDocs} doc.
            </Badge>
          </div>
        </div>

        {(expiredDocs.length > 0 || expiringDocs.length > 0 || missingRequired.length > 0 || docsWithAiIssues.length > 0 || docsValidatedByAi.length > 0) && (
          <div className="space-y-2">
            {expiredDocs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span><strong>{d.label}</strong> — vencido {format(new Date(d.expires_at), 'dd MMM yyyy', { locale: es })}</span>
              </div>
            ))}
            {expiringDocs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-700 text-sm">
                <Clock className="h-4 w-4 shrink-0" />
                <span><strong>{d.label}</strong> — vence en {differenceInDays(new Date(d.expires_at), new Date())} días</span>
              </div>
            ))}
            {missingRequired.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Faltan {missingRequired.length} doc. obligatorios: {missingRequired.map((t) => horusDocs.find((h) => h.type === t)?.label).join(', ')}</span>
              </div>
            )}
            {docsWithAiIssues.map(({ doc, ai }) => (
              <div key={`${doc.id}-ai-issue`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{doc.label}</strong>
                  {' — '}
                  {ai?.pendingOwnersCount
                    ? `faltan ${ai.pendingOwnersCount} titular(es) por dar de alta o vincular en CRM`
                    : `${ai?.inconsistencyCount || 0} inconsistencia(s) detectada(s) por IA`}
                </span>
              </div>
            ))}
            {docsValidatedByAi.map(({ doc, ai }) => (
              <div key={`${doc.id}-ai-ok`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{doc.label}</strong>
                  {' — '}
                  validado por IA
                  {ai?.autofillCount ? ` · ${ai.autofillCount} campo(s) completado(s)` : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1">
          {visibleHorusDocs.map((horus) => {
            const doc = docs.find((d) => d.doc_type === horus.type);
            const aiSummary = getAiSummary(doc?.notes);
            const expired = doc?.expires_at && isPast(new Date(doc.expires_at));
            const expiring = doc?.expires_at && !expired && differenceInDays(new Date(doc.expires_at), new Date()) <= 30;
            return (
              <div key={horus.type} className="py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {doc ? (
                      expired ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
                      expiring ? <Clock className="h-4 w-4 text-amber-500" /> :
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={`text-sm ${doc ? 'font-medium' : 'text-muted-foreground'}`}>{horus.label}</span>
                    {doc?.expires_at && (
                      <span className={`text-xs ${expired ? 'text-destructive' : expiring ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        ({format(new Date(doc.expires_at), 'dd/MM/yyyy')})
                      </span>
                    )}
                    {aiSummary && (
                      <Badge variant={aiSummary.hasIssues ? 'destructive' : 'secondary'} className="text-[10px]">
                        IA {aiSummary.hasIssues ? `· ${aiSummary.inconsistencyCount} alerta(s)` : 'OK'}
                      </Badge>
                    )}
                    {aiSummary?.pendingOwnersCount ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Titulares pendientes · {aiSummary.pendingOwnersCount}
                      </Badge>
                    ) : null}
                    {aiSummary?.autofillCount ? (
                      <Badge variant="outline" className="text-[10px]">
                        Autofill · {aiSummary.autofillCount}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    {doc?.file_url && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                    {doc?.file_url && ['nota_simple', 'catastro', 'escritura'].includes(doc.doc_type) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleReanalyzeDocument(doc)}
                        disabled={reanalyzingDocId === doc.id || reanalyzingAll}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${reanalyzingDocId === doc.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    {doc && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => handleDelete(doc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!doc && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onUploadMissing(horus.type, horus.label)}>
                        <Upload className="h-3 w-3 mr-1" /> Subir
                      </Button>
                    )}
                  </div>
                </div>
                {renderAiSummary(doc, aiSummary)}
              </div>
            );
          })}
        </div>

        {otherDocs.length > 0 && (
          <div className="border-t pt-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium mb-2">Otros documentos</p>
            {otherDocs.map((doc) => {
              const aiSummary = getAiSummary(doc.notes);
              return (
                <div key={doc.id} className="py-2 px-3 rounded-lg hover:bg-accent/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{doc.label}</span>
                      {doc.file_name && <span className="text-xs text-muted-foreground">({doc.file_name})</span>}
                      {aiSummary && (
                        <Badge variant={aiSummary.hasIssues ? 'destructive' : 'secondary'} className="text-[10px]">IA</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {doc.file_url && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /></a>
                        </Button>
                      )}
                      {doc.file_url && ['nota_simple', 'catastro', 'escritura'].includes(doc.doc_type) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleReanalyzeDocument(doc)}
                          disabled={reanalyzingDocId === doc.id || reanalyzingAll}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${reanalyzingDocId === doc.id ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => handleDelete(doc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {renderAiSummary(doc, aiSummary)}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </>
  );
}
