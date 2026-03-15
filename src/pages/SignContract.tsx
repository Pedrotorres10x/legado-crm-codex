import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import SignaturePad from '@/components/SignaturePad';
import { CheckCircle, FileText, Loader2, AlertCircle, Shield, Mail, KeyRound, Eye, ChevronRight, Lock } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const DNI_NIE_REGEX = /^[0-9XYZ]\d{7}[A-Z]$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'otp_email' | 'otp_code' | 'review' | 'sign' | 'done';

// ── Branding header ──
const BrandHeader = () => (
  <div className="text-center mb-6">
    <div className="inline-flex items-center gap-2 mb-1">
      <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
        <FileText className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="text-lg font-bold tracking-tight text-foreground">Legado</span>
    </div>
    <p className="text-xs text-muted-foreground">Firma electrónica segura</p>
  </div>
);

// ── Progress indicator ──
const ProgressBar = ({ stepIndex }: { stepIndex: number }) => {
  const stepLabels = ['Verificación', 'Documento', 'Firma'];
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
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
            <span className="text-xs font-medium hidden sm:inline">{label}</span>
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
  <div className="mt-8 text-center">
    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60">
      <Lock className="h-3 w-3" />
      <span>Protegido por cifrado SSL · Conforme al Reglamento eIDAS</span>
    </div>
  </div>
);

const SignContract = () => {
  const { token } = useParams<{ token: string }>();
  const [contract, setContract] = useState<any>(null);
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

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-contract?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Error al cargar el contrato');
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
        setError(data.error || 'Error al firmar');
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
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
          <CardContent className="py-10 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold">¡Contrato firmado!</h2>
            <p className="text-muted-foreground">
              La firma de <span className="font-medium text-foreground">{contract?.signer_name || signerFullName || 'el firmante'}</span> ha sido registrada correctamente.
            </p>
            {documentHash && (
              <div className="mt-4 p-4 bg-muted/50 rounded-xl text-left border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">Certificado de integridad</span>
                </div>
                <p className="text-[11px] text-muted-foreground break-all font-mono leading-relaxed">SHA-256: {documentHash}</p>
                <p className="text-[11px] text-muted-foreground mt-2">Este hash garantiza que el documento no ha sido modificado tras la firma.</p>
              </div>
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8 px-4 flex flex-col items-center justify-center">
        <BrandHeader />
        <div className="max-w-md w-full">
          <ProgressBar stepIndex={stepIndex} />
          <Card className="shadow-lg shadow-primary/5 border-primary/10">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Verificación de identidad</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8 px-4 flex flex-col items-center justify-center">
        <BrandHeader />
        <div className="max-w-md w-full">
          <ProgressBar stepIndex={stepIndex} />
          <Card className="shadow-lg shadow-primary/5 border-primary/10">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                <KeyRound className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">Introduce el código</CardTitle>
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <BrandHeader />
          <ProgressBar stepIndex={stepIndex} />
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
              <Eye className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Revisión del contrato</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {signerLabel ? <span className="font-medium text-foreground">{signerLabel}</span> : null}
              {signerLabel ? ' — ' : ''}Lee el documento completo antes de continuar
            </p>
          </div>

          <Card className="shadow-lg shadow-primary/5 border-primary/10">
            <CardHeader><CardTitle className="text-base">Contenido del contrato</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const urlMatch = contract.content?.match(/https?:\/\/[^\s]+\.(pdf|PDF)(?:\?[^\s]*)?/);
                const pdfUrl = urlMatch?.[0];

                if (pdfUrl) {
                  return (
                    <div className="space-y-3">
                      <iframe
                        src={pdfUrl}
                        className="w-full border rounded-xl bg-white"
                        style={{ height: '70vh', minHeight: '500px' }}
                        title="Documento a firmar"
                      />
                      <div className="flex justify-center">
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          Abrir documento en nueva pestaña ↗
                        </a>
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
                <p className="text-xs text-muted-foreground font-mono">Hash: {documentHash}</p>
              )}
              <Button className="w-full h-12 text-base" size="lg" onClick={() => setStep('sign')}>
                He leído el contrato — Continuar a la firma
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <BrandHeader />
        <ProgressBar stepIndex={stepIndex} />
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Firma del contrato</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {signerLabel ? <span className="font-medium text-foreground">{signerLabel}</span> : null}
            {signerLabel ? ' — ' : ''}Introduce tus datos y firma
          </p>
        </div>

        <Card className="shadow-lg shadow-primary/5 border-primary/10">
          <CardContent className="pt-6 space-y-5">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <div className="flex items-start space-x-3 p-4 border rounded-xl bg-muted/30">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked === true)}
              />
              <label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer text-muted-foreground">
                Declaro que he leído íntegramente el contrato, que los datos facilitados son correctos,
                y acepto firmar electrónicamente este documento conforme al Reglamento (UE) 910/2014 (eIDAS)
                y la Ley 6/2020 de servicios electrónicos de confianza. Entiendo que se registrará mi IP,
                dispositivo y fecha como evidencia de la firma.
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('review')} className="flex-shrink-0 h-11">
                ← Volver
              </Button>
              <Button className="flex-1 h-12 text-base" size="lg" onClick={handleSign} disabled={signing || !canSign}>
                {signing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Firmando...</> : '✍️ Firmar contrato'}
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
