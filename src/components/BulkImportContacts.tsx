import { useState, useRef, useCallback } from 'react';
import { Upload, Download, X, Check, AlertTriangle, Loader2, Users, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

type ContactType = 'comprador' | 'propietario' | 'ambos' | 'prospecto' | 'colaborador';
type ContactStatus = 'nuevo' | 'en_seguimiento' | 'activo' | 'cerrado';

interface ParsedRow {
  raw: Record<string, string>;
  mapped: Partial<ContactRow>;
  errors: string[];
  duplicate?: boolean;
}

interface ContactRow {
  full_name: string;
  contact_type: ContactType;
  status: ContactStatus;
  phone: string;
  phone2: string;
  email: string;
  city: string;
  address: string;
  notes: string;
  tags: string;
  nationality: string;
  id_number: string;
  needs_mortgage: boolean;
}

// ─── Column field options ────────────────────────────────────────────────────

const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: '__skip', label: '— Ignorar columna —' },
  { value: 'full_name', label: 'Nombre completo *' },
  { value: 'contact_type', label: 'Tipo de contacto' },
  { value: 'status', label: 'Estado' },
  { value: 'phone', label: 'Teléfono principal' },
  { value: 'phone2', label: 'Teléfono 2' },
  { value: 'email', label: 'Email' },
  { value: 'city', label: 'Ciudad' },
  { value: 'address', label: 'Dirección' },
  { value: 'notes', label: 'Notas' },
  { value: 'tags', label: 'Etiquetas (separadas por coma)' },
  { value: 'nationality', label: 'Nacionalidad' },
  { value: 'id_number', label: 'DNI / NIE / Pasaporte' },
  { value: 'needs_mortgage', label: 'Necesita hipoteca (sí/no)' },
];

// ─── Type mapping helper ──────────────────────────────────────────────────────

const TYPE_MAP: Record<string, ContactType> = {
  comprador: 'comprador', buyer: 'comprador', compradora: 'comprador', cliente: 'comprador',
  propietario: 'propietario', propietaria: 'propietario', owner: 'propietario',
  vendedor: 'prospecto', vendedora: 'prospecto',
  ambos: 'ambos', both: 'ambos',
  prospecto: 'prospecto', prospect: 'prospecto', lead: 'prospecto',
  colaborador: 'colaborador', colaboradora: 'colaborador', partner: 'colaborador', notaría: 'colaborador', banco: 'colaborador',
};

const STATUS_MAP: Record<string, ContactStatus> = {
  nuevo: 'nuevo', new: 'nuevo', alta: 'nuevo',
  'en seguimiento': 'en_seguimiento', seguimiento: 'en_seguimiento', 'en_seguimiento': 'en_seguimiento',
  activo: 'activo', active: 'activo',
  cerrado: 'cerrado', closed: 'cerrado', inactivo: 'cerrado',
};

// ─── CSV / TSV parser ────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter: tab, semicolon, or comma
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const parse = (line: string) => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === delimiter && !inQuote) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  return {
    headers: parse(lines[0]),
    rows: lines.slice(1).filter(l => l.trim()).map(parse),
  };
}

// ─── Auto-map column headers ─────────────────────────────────────────────────

function autoMapHeader(header: string): string {
  const h = header.toLowerCase().replace(/[_\-\s]+/g, '');
  if (['nombre', 'name', 'fullname', 'nombrecompleto'].some(k => h.includes(k))) return 'full_name';
  if (['tipo', 'type', 'contacttype', 'tipodecontacto'].some(k => h.includes(k))) return 'contact_type';
  if (['estado', 'status'].some(k => h.includes(k))) return 'status';
  if (['telefono2', 'phone2', 'tel2', 'movil2', 'celular2', 'telefono3'].some(k => h.includes(k))) return 'phone2';
  if (['telefono', 'phone', 'tel', 'movil', 'celular', 'tlf'].some(k => h.includes(k))) return 'phone';
  if (['email', 'correo', 'mail'].some(k => h.includes(k))) return 'email';
  if (['ciudad', 'city', 'poblacion', 'municipio'].some(k => h.includes(k))) return 'city';
  if (['direccion', 'address', 'domicilio'].some(k => h.includes(k))) return 'address';
  if (['notas', 'notes', 'observaciones', 'comentarios'].some(k => h.includes(k))) return 'notes';
  if (['etiquetas', 'tags', 'labels'].some(k => h.includes(k))) return 'tags';
  if (['nacionalidad', 'nationality'].some(k => h.includes(k))) return 'nationality';
  if (['dni', 'nie', 'pasaporte', 'idnumber', 'id_number', 'documento'].some(k => h.includes(k))) return 'id_number';
  if (['hipoteca', 'mortgage', 'needsmortgage'].some(k => h.includes(k))) return 'needs_mortgage';
  return '__skip';
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(raw: Record<string, string>, mapping: Record<string, string>, agentId: string): { mapped: Partial<ContactRow>; errors: string[] } {
  const mapped: Partial<ContactRow & { agent_id: string }> = {};
  const errors: string[] = [];

  for (const [col, field] of Object.entries(mapping)) {
    if (field === '__skip') continue;
    const val = (raw[col] || '').trim();
    if (!val) continue;

    switch (field) {
      case 'full_name': mapped.full_name = val; break;
      case 'contact_type': {
        const t = TYPE_MAP[val.toLowerCase()];
        mapped.contact_type = t || 'comprador';
        if (!t) errors.push(`Tipo "${val}" no reconocido → asignado "comprador"`);
        break;
      }
      case 'status': {
        const s = STATUS_MAP[val.toLowerCase()];
        mapped.status = s || 'nuevo';
        if (!s) errors.push(`Estado "${val}" no reconocido → asignado "nuevo"`);
        break;
      }
      case 'needs_mortgage':
        mapped.needs_mortgage = ['sí', 'si', 'yes', '1', 'true'].includes(val.toLowerCase());
        break;
      default:
        (mapped as any)[field] = val;
    }
  }

  if (!mapped.full_name || !mapped.full_name.trim()) {
    errors.push('Nombre completo requerido');
  }

  mapped.agent_id = agentId;
  return { mapped, errors };
}

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const rows = [
    ['Nombre completo', 'Tipo', 'Estado', 'Teléfono', 'Email', 'Ciudad', 'Notas'],
    ['Juan García López', 'comprador', 'nuevo', '600123456', 'juan@email.com', 'Alicante', 'Busca piso 3 hab'],
    ['María Sánchez', 'prospecto', 'activo', '650987654', 'maria@email.com', 'Benidorm', 'Quiere vender su piso en Avda. del Mar'],
    ['Pedro Martínez', 'prospecto', 'nuevo', '623456789', '', 'Altea', 'Posible captación'],
    ['Notaría López', 'colaborador', 'activo', '965123456', 'info@notaria.com', 'Calpe', ''],
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'plantilla_importacion_contactos.csv';
  a.click();
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  agentId: string;
}

type Step = 'upload' | 'map' | 'preview' | 'result';

export default function BulkImportContacts({ open, onClose, onImported, agentId }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; skipped: number; errors: string[] } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [defaultType, setDefaultType] = useState<ContactType>('comprador');

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setParsed([]);
    setImporting(false);
    setProgress(0);
    setResult(null);
    setShowErrors(false);
    setDefaultType('comprador');
  };

  const handleClose = () => { reset(); onClose(); };

  // ── File parse ─────────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows } = parseCSV(text);
      if (!h.length) {
        toast({ title: 'Archivo vacío o sin cabecera', variant: 'destructive' });
        return;
      }
      setHeaders(h);
      setRawRows(rows);
      // Auto-map columns
      const auto: Record<string, string> = {};
      h.forEach(col => { auto[col] = autoMapHeader(col); });
      setMapping(auto);
      setStep('map');
    };
    reader.readAsText(file, 'UTF-8');
  }, [toast]);

  // ── Preview / validation ───────────────────────────────────────────────────
  const handlePreview = () => {
    const hasName = Object.values(mapping).includes('full_name');
    if (!hasName) {
      toast({ title: 'Debes mapear al menos la columna "Nombre completo"', variant: 'destructive' });
      return;
    }
    const rows: ParsedRow[] = rawRows.map(row => {
      const raw: Record<string, string> = {};
      headers.forEach((h, i) => { raw[h] = row[i] || ''; });
      const { mapped, errors } = mapRow(raw, mapping, agentId);
      // Apply default type if not mapped
      if (!mapped.contact_type) mapped.contact_type = defaultType;
      if (!mapped.status) mapped.status = 'nuevo';
      return { raw, mapped, errors };
    });
    setParsed(rows);
    setStep('preview');
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    let ok = 0;
    let skipped = 0;
    const errors: string[] = [];
    const BATCH = 50;

    const validRows = parsed.filter(r => r.mapped.full_name);

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH);
      const inserts = batch.map(r => ({
        full_name: r.mapped.full_name!,
        contact_type: r.mapped.contact_type ?? defaultType,
        status: r.mapped.status ?? 'nuevo',
        phone: r.mapped.phone ?? null,
        phone2: r.mapped.phone2 ?? null,
        email: r.mapped.email ?? null,
        city: r.mapped.city ?? null,
        address: r.mapped.address ?? null,
        notes: r.mapped.notes ?? null,
        tags: r.mapped.tags ? r.mapped.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        nationality: r.mapped.nationality ?? null,
        id_number: r.mapped.id_number ?? null,
        needs_mortgage: r.mapped.needs_mortgage ?? false,
        agent_id: agentId,
      }));

      const { error } = await supabase.from('contacts').insert(inserts as any);
      if (error) {
        skipped += batch.length;
        errors.push(`Lote ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        ok += batch.length;
      }
      setProgress(Math.round(((i + batch.length) / validRows.length) * 100));
    }

    setResult({ ok, skipped, errors });
    setImporting(false);
    setStep('result');
    if (ok > 0) onImported();
  };

  const validCount = parsed.filter(r => r.mapped.full_name).length;
  const errorCount = parsed.filter(r => r.errors.length > 0).length;
  const warnCount = parsed.filter(r => !r.mapped.full_name).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Importación masiva de contactos
          </DialogTitle>
        </DialogHeader>

        {/* ── Steps indicator ── */}
        <div className="flex items-center gap-2 py-2">
          {(['upload', 'map', 'preview', 'result'] as Step[]).map((s, idx) => {
            const labels = ['Archivo', 'Mapear', 'Revisar', 'Resultado'];
            const active = s === step;
            const done = ['upload', 'map', 'preview', 'result'].indexOf(step) > idx;
            return (
              <div key={s} className="flex items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                  ${active ? 'bg-primary text-primary-foreground' : done ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {done ? <Check className="h-3 w-3" /> : idx + 1}
                </div>
                <span className={`text-xs hidden sm:block ${active ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{labels[idx]}</span>
                {idx < 3 && <div className={`flex-1 h-px ${done ? 'bg-success' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-primary/30 rounded-xl p-10 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <Upload className="h-10 w-10 mx-auto text-primary/40 mb-3" />
                <p className="font-medium text-foreground">Arrastra tu archivo CSV aquí</p>
                <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionarlo</p>
                <p className="text-xs text-muted-foreground mt-2">Formatos: CSV, TSV · Separadores: coma, punto y coma, tabulación</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              {/* Info + template */}
              <div className="rounded-lg bg-muted/50 border p-4 space-y-2 text-sm">
                <p className="font-medium flex items-center gap-2"><Info className="h-4 w-4 text-primary" />Tipos de contacto reconocidos automáticamente:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['comprador', 'bg-blue-500/10 text-blue-700 border-blue-200'],
                    ['propietario', 'bg-emerald-500/10 text-emerald-700 border-emerald-200'],
                    ['prospecto', 'bg-amber-500/10 text-amber-700 border-amber-200'],
                    ['colaborador', 'bg-purple-500/10 text-purple-700 border-purple-200'],
                    ['ambos', 'bg-primary/10 text-primary border-primary/20'],
                  ].map(([label, cls]) => (
                    <span key={label} className={`inline-flex px-2 py-0.5 rounded-full text-xs border font-medium ${cls}`}>{label}</span>
                  ))}
                </div>
                <p className="text-muted-foreground">También: buyer, vendedor, lead, prospect, partner, banco, notaría...</p>
              </div>

              <Button variant="outline" onClick={downloadTemplate} className="w-full gap-2">
                <Download className="h-4 w-4" />Descargar plantilla de ejemplo
              </Button>
            </div>
          )}

          {/* STEP 2: Map columns */}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{rawRows.length} filas detectadas · {headers.length} columnas</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tipo por defecto:</span>
                  <Select value={defaultType} onValueChange={v => setDefaultType(v as ContactType)}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comprador">Comprador</SelectItem>
                      <SelectItem value="prospecto">Prospecto vendedor</SelectItem>
                      <SelectItem value="propietario">Propietario (cliente)</SelectItem>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">Columna del archivo</TableHead>
                      <TableHead>Muestra de datos</TableHead>
                      <TableHead className="w-56">Mapear a campo CRM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {headers.map((h, idx) => (
                      <TableRow key={h}>
                        <TableCell className="font-medium text-sm">{h}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {rawRows.slice(0, 2).map(r => r[idx]).filter(Boolean).join(' · ') || '—'}
                        </TableCell>
                        <TableCell>
                          <Select value={mapping[h] || '__skip'} onValueChange={v => setMapping(m => ({ ...m, [h]: v }))}>
                            <SelectTrigger className={`h-8 text-xs ${mapping[h] && mapping[h] !== '__skip' ? 'border-primary/50 bg-primary/5' : ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map(o => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* STEP 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default" className="gap-1"><Check className="h-3 w-3" />{validCount} válidos</Badge>
                {warnCount > 0 && <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" />{warnCount} sin nombre (se omitirán)</Badge>}
                {errorCount > 0 && <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />{errorCount} con avisos</Badge>}
              </div>

              <div className="rounded-lg border overflow-hidden max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((row, i) => (
                      <TableRow key={i} className={!row.mapped.full_name ? 'opacity-40' : ''}>
                        <TableCell className="font-medium text-sm">{row.mapped.full_name || <span className="text-destructive text-xs">Sin nombre</span>}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium
                            ${row.mapped.contact_type === 'comprador' ? 'bg-blue-500/10 text-blue-700 border-blue-200' :
                              row.mapped.contact_type === 'propietario' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' :
                              row.mapped.contact_type === 'prospecto' ? 'bg-amber-500/10 text-amber-700 border-amber-200' :
                              row.mapped.contact_type === 'colaborador' ? 'bg-purple-500/10 text-purple-700 border-purple-200' :
                              'bg-muted text-muted-foreground border-border'}`}>
                            {row.mapped.contact_type ?? defaultType}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.mapped.phone || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.mapped.email || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.mapped.city || '—'}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 && (
                            <span title={row.errors.join('\n')}>
                              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {importing && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Importando…</span><span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Result */}
          {step === 'result' && result && (
            <div className="space-y-4 py-4 text-center">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${result.ok > 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                {result.ok > 0 ? <Check className="h-8 w-8 text-success" /> : <X className="h-8 w-8 text-destructive" />}
              </div>
              <div>
                <p className="text-lg font-bold">{result.ok} contactos importados correctamente</p>
                {result.skipped > 0 && <p className="text-sm text-muted-foreground">{result.skipped} filas omitidas por errores</p>}
              </div>
              {result.errors.length > 0 && (
                <div className="text-left">
                  <button
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setShowErrors(e => !e)}
                  >
                    {showErrors ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    Ver detalle de errores
                  </button>
                  {showErrors && (
                    <ul className="mt-2 space-y-1 text-xs text-destructive bg-destructive/5 rounded-lg p-3">
                      {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 pt-2">
          {step === 'upload' && (
            <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          )}
          {step === 'map' && (
            <>
              <Button variant="ghost" onClick={() => setStep('upload')}>Atrás</Button>
              <Button onClick={handlePreview}>Previsualizar →</Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="ghost" onClick={() => setStep('map')} disabled={importing}>Atrás</Button>
              <Button onClick={handleImport} disabled={importing || validCount === 0}>
                {importing
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importando…</>
                  : <>Importar {validCount} contactos</>}
              </Button>
            </>
          )}
          {step === 'result' && (
            <>
              <Button variant="ghost" onClick={reset}>Nueva importación</Button>
              <Button onClick={handleClose}>Cerrar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
