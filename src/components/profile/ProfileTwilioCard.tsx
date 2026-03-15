import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle, Loader2, Phone, PhoneCall } from 'lucide-react';

export const ProfileTwilioCard = ({
  profile,
  twilioPhone,
  setTwilioPhone,
  twilioStep,
  twilioValidationCode,
  twilioLoading,
  onStart,
  onCheck,
  onReset,
  onPrepareReplace,
  onCancel,
}: {
  profile: any;
  twilioPhone: string;
  setTwilioPhone: (value: string) => void;
  twilioStep: 'idle' | 'waiting' | 'verifying';
  twilioValidationCode: string | null;
  twilioLoading: boolean;
  onStart: () => void;
  onCheck: () => void;
  onReset: () => void;
  onPrepareReplace: () => void;
  onCancel: () => void;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">
        <PhoneCall className="h-5 w-5 text-primary" />
        Número de llamadas VoIP (Caller ID)
      </CardTitle>
      <CardDescription>
        Verifica tu número de móvil para que tus clientes vean tu número personal cuando les llames desde el CRM, en lugar del número de la agencia.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      {profile?.twilio_caller_id_verified && profile?.twilio_caller_id ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <CheckCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">✅ Número verificado</p>
            <p className="text-sm font-mono text-primary/80">{profile.twilio_caller_id}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tus clientes verán este número cuando les llames por VoIP</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onPrepareReplace}>
              Cambiar
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onReset} disabled={twilioLoading}>
              {twilioLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Eliminar'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15">
            <PhoneCall className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">Número no verificado</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tus llamadas VoIP saldrán con el número de la agencia</p>
          </div>
          {profile?.twilio_caller_id && (
            <Button size="sm" variant="ghost" className="text-muted-foreground shrink-0" onClick={onReset} disabled={twilioLoading}>
              {twilioLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Limpiar'}
            </Button>
          )}
        </div>
      )}

      {(!profile?.twilio_caller_id_verified || twilioStep !== 'idle') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cómo verificar</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className={`flex gap-3 rounded-xl border p-4 transition-colors ${twilioStep === 'idle' ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30 opacity-60'}`}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${twilioStep !== 'idle' ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'}`}>
              {twilioStep !== 'idle' ? '✓' : '1'}
            </div>
            <div className="flex-1 space-y-2.5">
              <div>
                <p className="text-sm font-semibold">Introduce tu número de móvil</p>
                <p className="text-xs text-muted-foreground mt-0.5">En formato internacional. Ej: <span className="font-mono">+34612345678</span></p>
              </div>
              {twilioStep === 'idle' && (
                <div className="flex gap-2">
                  <Input
                    placeholder="+34612345678"
                    value={twilioPhone}
                    onChange={(event) => setTwilioPhone(event.target.value)}
                    className="font-mono text-sm"
                    disabled={twilioLoading}
                  />
                  <Button onClick={onStart} disabled={twilioLoading || !twilioPhone.trim()} className="shrink-0 gap-2">
                    {twilioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                    {twilioLoading ? 'Enviando...' : 'Iniciar'}
                  </Button>
                </div>
              )}
              {twilioStep !== 'idle' && <p className="text-sm font-mono font-semibold text-foreground">{twilioPhone}</p>}
            </div>
          </div>

          <div className={`flex gap-3 rounded-xl border p-4 transition-colors ${twilioStep === 'waiting' ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30 opacity-50'}`}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${twilioStep === 'waiting' ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
              2
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold">Recibe la llamada de verificación</p>
                <p className="text-xs text-muted-foreground mt-0.5">Twilio te llamará y te pedirá que introduzcas este código por el teclado del teléfono:</p>
              </div>
              {twilioStep === 'waiting' && (
                <>
                  {twilioValidationCode ? (
                    <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-primary bg-primary/5 px-6 py-5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Código que debes marcar en el teléfono</p>
                      <p className="text-6xl font-black font-mono tracking-[0.4em] text-primary">{twilioValidationCode}</p>
                      <p className="text-xs text-muted-foreground">Cuando Twilio te llame, pulsa estas teclas en el teclado numérico</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 px-4 py-3 space-y-2">
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">⚠️ Código no disponible</p>
                      <p className="text-xs text-muted-foreground">El código de verificación se perdió al recargar la página. Relanza la llamada para recibir un código nuevo.</p>
                      <Button size="sm" onClick={onStart} disabled={twilioLoading} className="gap-2 mt-1">
                        {twilioLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
                        {twilioLoading ? 'Enviando...' : 'Relanzar llamada'}
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                    <p className="text-xs font-medium text-primary">Esperando llamada entrante a <span className="font-mono">{twilioPhone}</span>…</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={`flex gap-3 rounded-xl border p-4 transition-colors ${twilioStep === 'waiting' ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30 opacity-50'}`}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${twilioStep === 'waiting' ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
              3
            </div>
            <div className="flex-1 space-y-2.5">
              <div>
                <p className="text-sm font-semibold">Confirma que recibiste la llamada</p>
                <p className="text-xs text-muted-foreground mt-0.5">Una vez hayas atendido la llamada e introducido el código en el teclado, pulsa el botón de abajo.</p>
              </div>
              {twilioStep === 'waiting' && twilioValidationCode && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">Tu código:</span>
                  <span className="text-2xl font-black font-mono tracking-widest text-primary">{twilioValidationCode}</span>
                </div>
              )}
              {twilioStep === 'waiting' && (
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={onCheck} disabled={twilioLoading} className="gap-2">
                    {twilioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    {twilioLoading ? 'Verificando...' : 'Ya recibí la llamada — Confirmar'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onCancel}>
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);
