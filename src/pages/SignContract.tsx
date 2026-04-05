import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import SignaturePad from '@/components/SignaturePad';
import { CheckCircle, FileText, Loader2, AlertCircle, Shield, Mail, KeyRound, Eye, ChevronRight, Lock, CalendarClock, MapPin, UserRound } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const DNI_NIE_REGEX = /^[0-9XYZ]\d{7}[A-Z]$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'otp_email' | 'otp_code' | 'review' | 'sign' | 'done';

type SignContractPayload = {
  content?: string;
  content_hash?: string;
  signer_label?: string;
  signature_status?: 'firmado' | 'revocado' | string;
  signer_id?: string | null;
  otp_verified?: boolean;
  signer_email?: string | null;
  signer_name?: string | null;
};

type VisitSheetSections = {
  title: string;
  metadata: Array<{ label: string; value: string }>;
  declaration: string[];
  internalNote: string[];
  other: string[];
};

const parseVisitSheetContent = (content: string): VisitSheetSections | null => {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines[0] !== 'HOJA DE VISITA') return null;

  const sections: VisitSheetSections = {
    title: 'Hoja de visita',
    metadata: [],
    declaration: [],
    internalNote: [],
    other: [],
  };

  let activeSection: 'declaration' | 'internalNote' | 'other' = 'other';

  for (const line of lines.slice(1)) {
    if (line === 'DECLARACIÓN') {
      activeSection = 'declaration';
      continue;
    }

    if (line === 'NOTA INTERNA DE LA VISITA') {
      activeSection = 'internalNote';
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex > 0 && activeSection === 'other') {
      const label = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      sections.metadata.push({ label, value });
      continue;
    }

    sections[activeSection].push(line);
  }

  return sections;
};

// ── Branding header ──
const BrandHeader = () => (
  <div className="mb-3 text-center sm:mb-6">
    <div className="inline-flex items-center gap-2 mb-1">
      <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center sm:h-9 sm:w-9">
        <FileText className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="text-base font-bold tracking-tight text-foreground sm:text-lg">Legado</span>
    </div>
    <p className="text-xs text-muted-foreground">Firma electrónica segura</p>
  </div>
);

// ── Progress indicator ──
const ProgressBar = ({ stepIndex }: { stepIndex: number }) => {
  const stepLabels = ['Verificación', 'Documento', 'Firma'];
  return (
    <div className="mb-4 flex items-center justify-center gap-1 overflow-x-auto px-1 sm:mb-8 sm:gap-2">
      {stepLabels.map((label, i) => (
        <div key={label} className="flex items-center gap-1 sm:gap-2">
          <div className={`flex items-center gap-1.5 transition-all ${i <= stepIndex ? 'text-primary' : 'text-muted-foreground/30'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
              i < stepIndex ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20' :
              i === stepIndex ? 'border-primary text-primary bg-primary/5' :
              'border-muted-foreground/20 text-muted-foreground/30'
            }`}>
              {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-[11px] font-medium sm:text-xs">{label}</span>
          </div>
          {i < stepLabels.length - 1 && (
            <div className={`w-8 sm:w-12 h-0.5 rounded-full transition-all duration-300 ${i < stepIndex ? 'bg-primary' : 'bg-muted-foreground/15'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

// ── Security footer ──
const SecurityFooter = () => (
  <div className="mt-6 text-center sm:mt-8">
    <div className="inline-flex max-w-[90vw] items-center gap-1.5 text-center text-[11px] text-muted-foreground/60 sm:text-xs">
      <Lock className="h-3 w-3" />
      <span>Protegido por cifrado SSL · Conforme al Reglamento eIDAS</span>
    </div>
  </div>
);

const SignContract = () => {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<SignContractPayload | null>(null);
  const [signerLabel, setSignerLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signerFirstName, setSignerFirstName] = useState('');
  const [signerLastName, setSignerLastName] = useState('');
  const [signerIdNumber, setSignerIdNumber] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [documentHash, setDocumentHash] = useState('');

  const [step, setStep] = useState<Step>('otp_email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const visitSheet = contract?.content ? parseVisitSheetContent(contract.content) : null;
  const documentLabel = visitSheet ? 'hoja de visita' : 'documento';

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-contract?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Error al cargar el documento');
        } else {
          setContract(data);
          if (data.content_hash) setDocumentHash(data.content_hash);
          if (data.signer_label) setSignerLabel(data.signer_label);
          if (data.signature_status === 'firmado') {
            setStep('done');
          } else if (data.signature_status === 'revocado') {
            setError('Este enlace de firma ha sido revocado.');
          } else if (data.signer_id) {
            if (data.otp_verified) {
              setStep('review');
            } else {
              setStep('otp_email');
            }
            if (data.signer_email) setOtpEmail(data.signer_email);
          } else {
            setStep('review');
          }
        }
      } catch {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchContract();
  }, [token]);

  const handleSendOtp = async () => {
    if (!EMAIL_REGEX.test(otpEmail.trim())) {
      setOtpError('Introduce un email válido');
      return;
    }
    setOtpSending(true);
    setOtpError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp', token, email: otpEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || 'Error al enviar código');
      } else {
        setStep('otp_code');
      }
    } catch {
      setOtpError('Error de conexión');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setOtpError('Introduce el código de 6 dígitos');
      return;
    }
    setOtpVerifying(true);
    setOtpError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', token, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || 'Código incorrecto');
      } else {
        setStep('review');
      }
    } catch {
      setOtpError('Error de conexión');
    } finally {
      setOtpVerifying(false);
    }
  };

  const cleanIdNumber = signerIdNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isIdValid = DNI_NIE_REGEX.test(cleanIdNumber);
  const signerFullName = `${signerFirstName.trim()} ${signerLastName.trim()}`.trim();
  const canSign = signerFirstName.trim().length >= 2 && signerLastName.trim().length >= 2 && isIdValid && signatureData && consent;

  const handleSign = async () => {
    if (!canSign) return;
    setSigning(true);
    setError('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signer_name: signerFullName,
          signer_id_number: cleanIdNumber,
          signature_base64: signatureData,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (visitSheet ? 'Error al firmar la hoja de visita' : 'Error al firmar el documento'));
      } else {
        setStep('done');
        if (data.document_hash) setDocumentHash(data.document_hash);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSigning(false);
    }
  };

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <BrandHeader />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-3">Cargando documento…</p>
      </div>
    );
  }

  // ── ERROR (no contract) ──
  if (error && !contract) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5 p-4">
        <BrandHeader />
        <Card className="max-w-md w-full border-destructive/20">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-lg font-semibold">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">El enlace puede haber expirado o ser incorrecto.</p>
          </CardContent>
        </Card>
        <SecurityFooter />
      </div>
    );
  }

  const stepIndex = step === 'otp_email' || step === 'otp_code' ? 0 : step === 'review' ? 1 : 2;

  // ── DONE ──
  if (step === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
        <BrandHeader />
        <Card className="max-w-md w-full border-accent/20 shadow-lg shadow-accent/5">
          <CardContent className="space-y-4 py-8 text-center sm:py-10">
            <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold sm:text-[2rem]">Documento firmado</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              La firma de <span className="font-medium text-foreground">{contract?.signer_name || signerFullName || 'la persona firmante'}</span> ha quedado registrada correctamente en la hoja de visita.
            </p>
            {documentHash && (
              <details className="mt-4 rounded-xl border border-border/50 bg-muted/50 p-4 text-left">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  Ver detalle técnico de integridad
                </summary>
                <p className="mt-3 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">SHA-256: {documentHash}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Este hash garantiza que el documento no ha sido modificado tras la firma.</p>
              </details>
            )}
            <p className="text-sm text-muted-foreground pt-2">Puedes cerrar esta ventana.</p>
          </CardContent>
        </Card>
        <SecurityFooter />
      </div>
    );
  }

  // ── OTP EMAIL ──
  if (step === 'otp_email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-6 sm:py-8 flex flex-col items-center justify-center">
        <BrandHeader />
        <div className="max-w-md w-full">
          <ProgressBar stepIndex={stepIndex} />
          <Card className="shadow-lg shadow-primary/5 border-primary/10">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-lg sm:text-xl">Verificación de identidad</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {signerLabel ? <span className="font-medium text-foreground">{signerLabel}</span> : null}
                {signerLabel ? ' — ' : ''}Introduce tu email para recibir un código de acceso
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {otpError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {otpError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={otpEmail}
                  onChange={e => { setOtpEmail(e.target.value); setOtpError(''); }}
                  placeholder="tu@email.com"
                  disabled={otpSending}
                  className="h-11"
                />
              </div>
              <Button className="w-full h-11" onClick={handleSendOtp} disabled={otpSending || !otpEmail.trim()}>
                {otpSending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : 'Enviar código de verificación'}
              </Button>
            </CardContent>
          </Card>
        </div>
        <SecurityFooter />
      </div>
    );
  }

  // ── OTP CODE ──
  if (step === 'otp_code') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-6 sm:py-8 flex flex-col items-center justify-center">
        <BrandHeader />
        <div className="max-w-md w-full">
          <ProgressBar stepIndex={stepIndex} />
          <Card className="shadow-lg shadow-primary/5 border-primary/10">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                <KeyRound className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-lg sm:text-xl">Introduce el código</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Hemos enviado un código de 6 dígitos a <span className="font-medium text-foreground">{otpEmail}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {otpError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {otpError}
                </div>
              )}
              <div className="flex justify-center py-2">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button className="w-full h-11" onClick={handleVerifyOtp} disabled={otpVerifying || otpCode.length !== 6}>
                {otpVerifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</> : 'Verificar código'}
              </Button>
              <div className="text-center">
                <Button variant="link" size="sm" className="text-muted-foreground" onClick={() => { setStep('otp_email'); setOtpCode(''); setOtpError(''); }}>
                  Cambiar email o reenviar código
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <SecurityFooter />
      </div>
    );
  }

  // ── REVIEW DOCUMENT ──
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        <BrandHeader />
        <ProgressBar stepIndex={stepIndex} />
        <div className="mb-5 text-center sm:mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 sm:h-14 sm:w-14">
            <Eye className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {visitSheet ? 'Revisa la hoja de visita' : 'Revisión del documento'}
          </h1>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            {signerLabel ? <span className="font-medium text-foreground">{signerLabel}</span> : null}
            {signerLabel ? ' — ' : ''}
            {visitSheet
              ? 'Comprueba los datos del inmueble y continúa cuando todo esté correcto.'
              : 'Lee el documento completo antes de continuar.'}
          </p>
        </div>

        <Card className="shadow-lg shadow-primary/5 border-primary/10">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-base sm:text-lg">
              {visitSheet ? 'Resumen de la hoja de visita' : 'Contenido del documento'}
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {visitSheet
                ? 'Verifica la dirección, la fecha prevista y la declaración antes de pasar a la firma.'
                : 'Revisa el contenido antes de continuar.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
              {(() => {
                const urlMatch = contract.content?.match(/https?:\/\/[^\s]+\.(pdf|PDF)(?:\?[^\s]*)?/);
                const pdfUrl = urlMatch?.[0];

                if (pdfUrl) {
                  return (
                    <div className="space-y-3">
                      <iframe
                        src={pdfUrl}
                        className="w-full border rounded-xl bg-white"
                        style={{ height: '70vh', minHeight: '360px' }}
                        title={visitSheet ? 'Hoja de visita para revisar' : 'Documento a firmar'}
                      />
                      <div className="flex justify-center">
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          Abrir documento en nueva pestaña ↗
                        </a>
                      </div>
                    </div>
                  );
                }

                if (visitSheet) {
                  return (
                    <div className="rounded-[28px] border border-primary/10 bg-gradient-to-b from-white via-white to-slate-50 p-4 shadow-sm sm:p-7">
                      <div className="flex flex-col gap-4 sm:gap-5">
                        <div className="rounded-2xl border border-primary/10 bg-gradient-to-r from-primary/[0.06] via-primary/[0.03] to-transparent p-4 sm:p-5">
                          <div className="inline-flex items-center rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary shadow-sm">
                            Constancia de visita
                          </div>
                          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                            {visitSheet.title}
                          </h2>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            Este documento deja constancia de la visita al inmueble y de la identificación declarada por la persona visitante en el momento de la firma.
                          </p>
                        </div>

                        {visitSheet.metadata.length > 0 && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {visitSheet.metadata.map((item) => {
                              const lowerLabel = item.label.toLowerCase();
                              const Icon = lowerLabel.includes('fecha')
                                ? CalendarClock
                                : lowerLabel.includes('dirección')
                                  ? MapPin
                                  : lowerLabel.includes('visitante')
                                    ? UserRound
                                    : FileText;

                              return (
                                <div
                                  key={`${item.label}-${item.value}`}
                                  className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm shadow-slate-200/40 sm:p-4"
                                >
                                  <div className="flex items-start gap-2.5 sm:gap-3">
                                    <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        {item.label}
                                      </p>
                                      <p className="mt-1 text-sm font-medium leading-6 text-slate-900 sm:text-[15px]">
                                        {item.value}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {visitSheet.declaration.length > 0 && (
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 sm:p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                              Declaración de la visita
                            </p>
                            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700 sm:leading-7">
                              {visitSheet.declaration.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {visitSheet.internalNote.length > 0 && (
                          <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 sm:p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                              Información adicional
                            </p>
                            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700 sm:leading-7">
                              {visitSheet.internalNote.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {visitSheet.other.length > 0 && (
                          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-700 sm:leading-7">
                            {visitSheet.other.map((paragraph) => (
                              <p key={paragraph}>{paragraph}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed border rounded-xl p-6 bg-card max-h-[60vh] overflow-y-auto">
                    {contract.content}
                  </div>
                );
              })()}
              {documentHash && (
                <details className="rounded-xl border border-border/50 bg-muted/40 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Ver detalle técnico</summary>
                  <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">Hash: {documentHash}</p>
                </details>
              )}
              <Button className="h-11 w-full text-sm sm:h-12 sm:text-base" size="lg" onClick={() => setStep('sign')}>
                <span className="sm:hidden">{visitSheet ? 'Continuar a la firma' : 'Continuar'}</span>
                <span className="hidden sm:inline">{visitSheet ? 'He revisado la hoja de visita — Continuar a la firma' : 'He leído el documento — Continuar a la firma'}</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
          <SecurityFooter />
        </div>
      </div>
    );
  }

  // ── SIGN ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        <BrandHeader />
        <ProgressBar stepIndex={stepIndex} />
        <div className="mb-5 text-center sm:mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 sm:h-14 sm:w-14">
            <FileText className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
          </div>
          <h1 className="text-xl font-bold sm:text-2xl">{visitSheet ? 'Firma de la hoja de visita' : 'Firma del documento'}</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            {signerLabel ? <span className="font-medium text-foreground">{signerLabel}</span> : null}
            {signerLabel ? ' — ' : ''}{visitSheet ? 'Confirma tus datos y firma para dejar constancia de la visita' : 'Introduce tus datos y firma'}
          </p>
        </div>

        <Card className="shadow-lg shadow-primary/5 border-primary/10">
          <CardContent className="space-y-5 px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={signerFirstName}
                  onChange={e => setSignerFirstName(e.target.value)}
                  placeholder="Nombre"
                  maxLength={80}
                  className="h-11"
                />
                {signerFirstName.length > 0 && signerFirstName.trim().length < 2 && (
                  <p className="text-xs text-destructive">Mínimo 2 caracteres</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Apellidos</Label>
                <Input
                  value={signerLastName}
                  onChange={e => setSignerLastName(e.target.value)}
                  placeholder="Apellidos"
                  maxLength={100}
                  className="h-11"
                />
                {signerLastName.length > 0 && signerLastName.trim().length < 2 && (
                  <p className="text-xs text-destructive">Mínimo 2 caracteres</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>DNI / NIE</Label>
                <Input
                  value={signerIdNumber}
                  onChange={e => setSignerIdNumber(e.target.value)}
                  placeholder="12345678A o X1234567B"
                  maxLength={12}
                  className="h-11"
                />
                {signerIdNumber.length > 0 && !isIdValid && (
                  <p className="text-xs text-destructive">Formato inválido. Ej: 12345678A</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Firma manuscrita</Label>
              <p className="text-xs text-muted-foreground">Dibuja tu firma con el dedo o ratón en el recuadro</p>
              <SignaturePad onSignatureChange={setSignatureData} />
            </div>

            <div className="flex items-start space-x-3 rounded-xl border bg-muted/30 p-4">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked === true)}
              />
              <label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer text-muted-foreground">
                Declaro que he leído íntegramente esta {documentLabel}, que los datos facilitados son correctos,
                y acepto firmar electrónicamente esta {documentLabel} conforme al Reglamento (UE) 910/2014 (eIDAS)
                y la Ley 6/2020 de servicios electrónicos de confianza. Entiendo que se registrará mi IP,
                dispositivo y fecha como evidencia de la firma.
              </label>
            </div>

            <div className="sticky bottom-0 flex flex-col gap-3 border-t bg-card/95 pt-3 backdrop-blur sm:static sm:border-t-0 sm:bg-transparent sm:pt-2 sm:flex-row">
              <Button variant="outline" onClick={() => setStep('review')} className="h-11 sm:flex-shrink-0">
                ← Volver
              </Button>
              <Button className="h-12 flex-1 text-sm sm:text-base" size="lg" onClick={handleSign} disabled={signing || !canSign}>
                {signing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Firmando...</> : visitSheet ? 'Firmar hoja de visita' : 'Firmar documento'}
              </Button>
            </div>
          </CardContent>
        </Card>
        <SecurityFooter />
      </div>
    </div>
  );
};

export default SignContract;
