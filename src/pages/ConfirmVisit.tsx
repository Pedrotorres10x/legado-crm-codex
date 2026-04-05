import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle, Calendar as CalendarIcon, MapPin, Loader2, AlertCircle, Home, XCircle, CalendarClock } from 'lucide-react';
import { format, setHours, setMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type VisitConfirmationPayload = {
  contact_name: string;
  property_title: string;
  property_address: string | null;
  visit_date: string;
  notes: string | null;
  confirmation_status: 'pendiente' | 'confirmado' | 'cancelado' | 'reprogramado' | null;
  visitor_declared_name?: string | null;
  visitor_declared_dni?: string | null;
};

const ConfirmVisit = () => {
  const { token } = useParams<{ token: string }>();
  const [visit, setVisit] = useState<VisitConfirmationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [rescheduled, setRescheduled] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newHour, setNewHour] = useState('10');
  const [newMinute, setNewMinute] = useState('00');
  const [declaredName, setDeclaredName] = useState('');
  const [declaredDni, setDeclaredDni] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const fetchVisit = async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/confirm-visit?token=${token}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Error al cargar la visita');
        } else {
          setVisit(data);
          setDeclaredName(data.visitor_declared_name || data.contact_name || '');
          setDeclaredDni(data.visitor_declared_dni || '');
          if (data.confirmation_status === 'confirmado') setConfirmed(true);
          if (data.confirmation_status === 'cancelado') setCancelled(true);
          if (data.confirmation_status === 'reprogramado') setRescheduled(true);
        }
      } catch {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchVisit();
  }, [token]);

  const postAction = async (action: string, extra?: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/confirm-visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  };

  const handleConfirm = async () => {
    setConfirming(true);
    setError('');
    try {
      await postAction('confirm', {
        declared_name: declaredName,
        declared_dni: declaredDni,
        declaration_acknowledged: acknowledged,
      });
      setVisit((currentVisit) =>
        currentVisit
          ? {
              ...currentVisit,
              visitor_declared_name: declaredName.trim(),
              visitor_declared_dni: declaredDni.trim().toUpperCase(),
            }
          : currentVisit,
      );
      setConfirmed(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Error al confirmar la visita');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError('');
    try {
      await postAction('cancel');
      setCancelled(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Error al cancelar la visita');
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = async () => {
    if (!newDate) return;
    setRescheduling(true);
    setError('');
    try {
      const dateWithTime = setMinutes(setHours(newDate, parseInt(newHour)), parseInt(newMinute));
      await postAction('reschedule', { new_date: dateWithTime.toISOString() });
      setRescheduled(true);
      setVisit((currentVisit) =>
        currentVisit ? { ...currentVisit, visit_date: dateWithTime.toISOString() } : currentVisit,
      );
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Error al reprogramar la visita');
    } finally {
      setRescheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !visit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-medium">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">El enlace puede haber expirado o ser incorrecto.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Final states
  if (confirmed || cancelled || rescheduled) {
    const icon = cancelled
      ? <XCircle className="h-16 w-16 mx-auto text-destructive" />
      : rescheduled
        ? <CalendarClock className="h-16 w-16 mx-auto text-orange-500" />
        : <CheckCircle className="h-16 w-16 mx-auto text-green-600" />;
    const title = cancelled ? '❌ Visita cancelada' : rescheduled ? '📅 Visita reprogramada' : '✅ Hoja de visita registrada';
    const subtitle = cancelled
      ? 'La visita ha sido cancelada. El agente será notificado.'
      : rescheduled
        ? 'Has solicitado una nueva fecha. El agente será notificado.'
        : `Gracias ${visit?.visitor_declared_name || declaredName || visit?.contact_name}. Tu asistencia ha quedado registrada con los datos declarados.`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            {icon}
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{subtitle}</p>
            {confirmed && visit?.visitor_declared_dni && (
              <p className="text-sm text-muted-foreground">
                Documento declarado: <span className="font-medium text-foreground">{visit.visitor_declared_dni}</span>
              </p>
            )}
            {visit && (
              <div className="mt-4 p-4 bg-muted rounded-lg text-left space-y-2">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{visit.property_title}</span>
                </div>
                {visit.property_address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{visit.property_address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(visit.visit_date), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  </span>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">Puedes cerrar esta ventana.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main confirmation view
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-8 space-y-6">
          <div className="text-center">
            <CalendarIcon className="h-10 w-10 mx-auto mb-2 text-primary" />
            <h1 className="text-2xl font-bold">Hoja de visita</h1>
            <p className="text-muted-foreground mt-1">Hola {visit.contact_name}, registra tu asistencia a la visita</p>
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <span className="font-medium">{visit.property_title}</span>
            </div>
            {visit.property_address && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{visit.property_address}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {format(new Date(visit.visit_date), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}
              </span>
            </div>
            {visit.notes && (
              <p className="text-sm text-muted-foreground border-t pt-2">{visit.notes}</p>
            )}
          </div>

          <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-950">Antes de confirmar</p>
            <p className="text-sm text-amber-900">
              Para dejar constancia de la visita te pedimos que escribas correctamente tu nombre completo y tu DNI o NIE.
              No hace falta adjuntar foto del documento.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="declared-name">Nombre completo</Label>
              <Input
                id="declared-name"
                value={declaredName}
                onChange={(event) => setDeclaredName(event.target.value)}
                placeholder="Escribe tu nombre y apellidos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="declared-dni">DNI o NIE</Label>
              <Input
                id="declared-dni"
                value={declaredDni}
                onChange={(event) => setDeclaredDni(event.target.value.toUpperCase())}
                placeholder="Ej: 12345678Z o X1234567A"
              />
            </div>
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
              <Checkbox checked={acknowledged} onCheckedChange={(checked) => setAcknowledged(checked === true)} />
              <span className="text-sm text-muted-foreground">
                Confirmo que he escrito correctamente mi nombre completo y mi DNI o NIE para dejar constancia de la visita.
              </span>
            </label>
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          {/* Reschedule picker */}
          {showReschedule && (
            <div className="space-y-3 p-4 border rounded-lg">
              <p className="text-sm font-medium">Selecciona nueva fecha y hora:</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "PPP", { locale: es }) : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={setNewDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <div className="flex gap-2">
                <Select value={newHour} onValueChange={setNewHour}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 13 }, (_, i) => i + 8).map(h => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newMinute} onValueChange={setNewMinute}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['00', '15', '30', '45'].map(m => (
                      <SelectItem key={m} value={m}>{m} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowReschedule(false)}>Volver</Button>
                <Button className="flex-1" onClick={handleReschedule} disabled={!newDate || rescheduling}>
                  {rescheduling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : '📅 Confirmar nueva fecha'}
                </Button>
              </div>
            </div>
          )}

          {!showReschedule && (
            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handleConfirm}
                disabled={confirming || declaredName.trim().length < 5 || declaredDni.trim().length < 5 || !acknowledged}
              >
                {confirming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registrando...</> : '✅ Registrar hoja de visita'}
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowReschedule(true)}>
                  <CalendarClock className="h-4 w-4 mr-2" />Reprogramar
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="flex-1 text-destructive hover:text-destructive">
                      <XCircle className="h-4 w-4 mr-2" />Cancelar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Cancelar visita?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se notificará al agente de que no podrás asistir. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Volver</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancel} disabled={cancelling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {cancelling ? 'Cancelando...' : 'Sí, cancelar visita'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Al confirmar, cancelar o reprogramar, se registrará la fecha, hora, IP y navegador como evidencia.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmVisit;
