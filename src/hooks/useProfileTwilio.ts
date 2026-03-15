import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

const STORAGE_KEY = 'twilio_pending_verification';

export const useProfileTwilio = ({
  profile,
  toast,
  onVerified,
}: {
  profile: any;
  toast: ToastFn;
  onVerified: () => Promise<void> | void;
}) => {
  const [twilioPhone, setTwilioPhone] = useState('');
  const [twilioStep, setTwilioStep] = useState<'idle' | 'waiting' | 'verifying'>('idle');
  const [twilioValidationCode, setTwilioValidationCode] = useState<string | null>(null);
  const [twilioLoading, setTwilioLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const { phone, code, ts } = JSON.parse(saved);
      if (Date.now() - ts < 30 * 60 * 1000) {
        setTwilioPhone(phone || '');
        setTwilioValidationCode(code || null);
        setTwilioStep('waiting');
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const normalizePhone = (raw: string): string => {
    let phone = raw.trim().replace(/\s+/g, '');
    if (!phone.startsWith('+')) {
      if (/^[6789]/.test(phone)) phone = `+34${phone}`;
      else if (phone.startsWith('0034')) phone = `+${phone.slice(2)}`;
      else phone = `+34${phone}`;
    }
    return phone;
  };

  const clearPending = () => {
    setTwilioStep('idle');
    setTwilioValidationCode(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleTwilioStart = async () => {
    const phone = normalizePhone(twilioPhone);
    if (!phone) return;
    setTwilioPhone(phone);
    setTwilioLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-verify-caller`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start', phone_number: phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Error Twilio (${data.code ?? ''}): ${data.error}`);

      if (data.already_verified) {
        toast({
          title: '✅ Número ya verificado en Twilio',
          description: 'Se ha activado directamente como tu caller ID.',
        });
        await onVerified();
        return;
      }

      const code = data.validation_code ?? null;
      setTwilioValidationCode(code);
      setTwilioStep('waiting');
      if (code) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ phone, code, ts: Date.now() }));
      }
      toast({
        title: '📞 Twilio llamará a tu número',
        description: `Código de verificación: ${code ?? '(pendiente)'}. Introdúcelo cuando te llamen.`,
      });
    } catch (error: any) {
      toast({ title: 'Error al iniciar verificación', description: error.message, variant: 'destructive' });
    } finally {
      setTwilioLoading(false);
    }
  };

  const handleTwilioCheck = async () => {
    setTwilioLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-verify-caller`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'check', phone_number: twilioPhone.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error');

      if (data.verified) {
        toast({
          title: '✅ Número verificado',
          description: 'Tu número personal se usará como caller ID en tus llamadas.',
        });
        clearPending();
        await onVerified();
      } else {
        toast({
          title: 'Aún no verificado',
          description: 'Introduce el código en el teclado del teléfono cuando Twilio te llame. El código sigue en pantalla.',
        });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setTwilioLoading(false);
    }
  };

  const handleTwilioReset = async () => {
    const phone = profile?.twilio_caller_id || twilioPhone;
    if (!phone) return;
    setTwilioLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-verify-caller`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reset', phone_number: normalizePhone(phone) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error');
      toast({
        title: 'Número eliminado de Twilio',
        description: 'Ahora puedes volver a verificarlo.',
      });
      setTwilioPhone('');
      clearPending();
      await onVerified();
    } catch (error: any) {
      toast({ title: 'Error al resetear', description: error.message, variant: 'destructive' });
    } finally {
      setTwilioLoading(false);
    }
  };

  const prepareReplace = () => {
    setTwilioPhone(profile?.twilio_caller_id || '');
    clearPending();
  };

  return {
    twilioPhone,
    setTwilioPhone,
    twilioStep,
    twilioValidationCode,
    twilioLoading,
    clearPending,
    handleTwilioStart,
    handleTwilioCheck,
    handleTwilioReset,
    prepareReplace,
  };
};
