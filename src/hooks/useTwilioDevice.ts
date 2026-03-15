import { useState, useEffect, useRef, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { DialContext } from '@/contexts/TwilioContext';

export type DeviceStatus = 'loading' | 'ready' | 'calling' | 'in-call' | 'incoming' | 'error' | 'unconfigured';

export interface CallState {
  status: DeviceStatus;
  duration: number;
  muted: boolean;
  currentNumber: string | null;
  contactName: string | null;
  contactId: string | null;
  callSid: string | null;
  error: string | null;
  transferring: boolean;
}

export const useTwilioDevice = () => {
  const { user } = useAuth();
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const callerIdRef = useRef<string | null>(null);
  // parentCallSid: the customer's call leg SID — needed to redirect to conference on transfer
  const parentCallSidRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const [callState, setCallState] = useState<CallState>({
    status: 'loading',
    duration: 0,
    muted: false,
    currentNumber: null,
    contactName: null,
    contactId: null,
    callSid: null,
    error: null,
    transferring: false,
  });


  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-token`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!res.ok) {
          const err = await res.json();
          if (err.error === 'Twilio not configured') {
            if (mounted) setCallState(s => ({ ...s, status: 'unconfigured' }));
            return;
          }
          throw new Error(err.error || 'Token error');
        }

        const { token, callerId } = await res.json();

        // Store callerId so dial() can pass it to the TwiML webhook
        callerIdRef.current = callerId || null;

        const device = new Device(token, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        });

        device.on('registered', () => {
          console.log('[TwilioDevice] Registered successfully');
          if (mounted) setCallState(s => ({ ...s, status: 'ready', error: null }));
        });

        device.on('unregistered', () => {
          console.warn('[TwilioDevice] Unregistered');
        });

        device.on('tokenWillExpire', () => {
          console.warn('[TwilioDevice] Token will expire soon');
        });

        device.on('error', (err) => {
          console.error('[TwilioDevice] Error:', err);
          if (mounted) setCallState(s => ({ ...s, status: 'error', error: err.message }));
        });

        // ── Incoming call ──────────────────────────────────────────────
        device.on('incoming', async (call: Call) => {
          if (!mounted) return;
          incomingCallRef.current = call;
          const from = call.parameters?.From ?? null;

          // Read custom parameters injected by the Twilio webhook
          const customName      = call.customParameters?.get('contactName') ?? null;
          const customId        = call.customParameters?.get('contactId') ?? null;
          const customParentSid = call.customParameters?.get('parentCallSid') ?? null;

          // Store parentCallSid for transfer use
          parentCallSidRef.current = customParentSid;

          // Show overlay immediately with whatever we already know
          setCallState(s => ({
            ...s,
            status: 'incoming',
            currentNumber: from,
            contactName: customName,
            contactId: customId,
          }));

          // Fallback: if the webhook didn't recognise the number (e.g. new contact
          // added after the call arrived), do a live DB lookup by caller number.
          if (!customName && from) {
            const normalized = from.replace(/[^0-9]/g, '');
            const last9 = normalized.slice(-9);
            const { data: contacts } = await supabase
              .from('contacts')
              .select('id, full_name')
              .or(`phone.ilike.%${last9}%,phone2.ilike.%${last9}%`)
              .limit(1);

            if (mounted && contacts && contacts.length > 0) {
              setCallState(s => ({
                ...s,
                contactName: contacts[0].full_name,
                contactId: contacts[0].id,
              }));
            }
          }

          // If the caller hangs up before we answer
          call.on('cancel', () => {
            incomingCallRef.current = null;
            parentCallSidRef.current = null;
            if (mounted) setCallState(s => ({
              ...s, status: 'ready', currentNumber: null, contactName: null, contactId: null, callSid: null,
            }));
          });
          call.on('disconnect', () => {
            clearInterval(timerRef.current);
            incomingCallRef.current = null;
            callRef.current = null;
            parentCallSidRef.current = null;
            if (mounted) setCallState(s => ({
              ...s, status: 'ready', duration: 0, muted: false, currentNumber: null, contactName: null, contactId: null, callSid: null, transferring: false,
            }));
          });
        });

        await device.register();
        deviceRef.current = device;
      } catch (err: any) {
        console.error('Twilio init error:', err);
        if (mounted) setCallState(s => ({ ...s, status: 'error', error: err.message }));
      }
    };

    init();

    return () => {
      mounted = false;
      clearInterval(timerRef.current);
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, [user]);

  const dial = useCallback(async (number: string, context?: DialContext) => {
    if (!deviceRef.current || callState.status !== 'ready') {
      console.warn('[TwilioDial] Cannot dial: device not ready or missing. Status:', callState.status, 'Device:', !!deviceRef.current);
      return;
    }

    // ── Normalize number to E.164 ──────────────────────────────────
    const normalized = number.replace(/[\s\-().]/g, '');
    let e164: string;
    if (normalized.startsWith('+')) {
      e164 = normalized;
    } else if (normalized.startsWith('34') && normalized.length >= 11) {
      e164 = '+' + normalized;
    } else if (/^[67]\d{8}$/.test(normalized)) {
      e164 = '+34' + normalized;
    } else if (/^[89]\d{8}$/.test(normalized)) {
      // Spanish landlines
      e164 = '+34' + normalized;
    } else {
      e164 = '+' + normalized;
    }
    console.log('[TwilioDial] Normalized number:', number, '→', e164);

    setCallState(s => ({
      ...s,
      status: 'calling',
      currentNumber: e164,
      contactId: context?.contactId ?? null,
      contactName: context?.contactName ?? null,
      callSid: null,
      error: null,
    }));

    try {
      // On mobile, ensure microphone permission is available before connecting
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // release immediately, Twilio will request its own
        console.log('[TwilioDial] Microphone access confirmed');
      } catch (micErr: any) {
        console.error('[TwilioDial] Microphone access denied:', micErr.message);
        setCallState(s => ({ ...s, status: 'ready', error: 'Permiso de micrófono denegado. Actívalo en los ajustes del dispositivo.', currentNumber: null, contactName: null, contactId: null, callSid: null }));
        return;
      }

      const params: Record<string, string> = { To: e164 };
      if (callerIdRef.current) params.CallerIdOverride = callerIdRef.current;
      console.log('[TwilioDial] Connecting to:', e164);
      const call = await deviceRef.current.connect({ params });
      callRef.current = call;

      call.on('ringing', (hasEarlyMedia: boolean) => {
        console.log('[TwilioDial] Ringing, earlyMedia:', hasEarlyMedia);
      });

      call.on('accept', () => {
        console.log('[TwilioDial] Call accepted');
        setCallState(s => ({ ...s, status: 'in-call', callSid: call.parameters?.CallSid ?? s.callSid }));
        const start = Date.now();
        timerRef.current = setInterval(() => {
          setCallState(s => ({ ...s, duration: Math.floor((Date.now() - start) / 1000) }));
        }, 1000);
      });

      call.on('warning', (name: string, data: any) => {
        console.warn('[TwilioDial] Warning:', name, data);
      });

      call.on('reconnecting', (err: any) => {
        console.warn('[TwilioDial] Reconnecting:', err?.message);
      });

      let reachedInCall = false;
      const callStartedAt = Date.now();

      const cleanup = (reason: string) => {
        console.log('[TwilioDial] Cleanup, reason:', reason);
        clearInterval(timerRef.current);
        parentCallSidRef.current = null;
        setCallState(s => ({ ...s, status: 'ready', duration: 0, muted: false, currentNumber: null, contactName: null, contactId: null, callSid: null, transferring: false }));
        callRef.current = null;
      };

      call.on('accept', () => { reachedInCall = true; });

      call.on('disconnect', () => {
        console.log('[TwilioDial] Call disconnected, reachedInCall:', reachedInCall, 'elapsed:', Date.now() - callStartedAt, 'ms');
        // Silent failure detection is handled in TwilioDialer via status transition
        cleanup('disconnect');
      });
      call.on('cancel', () => { console.log('[TwilioDial] Call cancelled'); cleanup('cancel'); });
      call.on('reject', () => { console.log('[TwilioDial] Call rejected'); cleanup('reject'); });
      call.on('error', (err) => {
        console.error('[TwilioDial] Call error:', err.message);
        cleanup('error');
        setCallState(s => ({ ...s, error: err.message }));
      });
    } catch (err: any) {
      console.error('[TwilioDial] Connect error:', err.message);
      setCallState(s => ({ ...s, status: 'ready', error: err.message, currentNumber: null, contactName: null, contactId: null, callSid: null }));
    }
  }, [callState.status]);

  const hangUp = useCallback(() => {
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
  }, []);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const newMuted = !callState.muted;
    callRef.current.mute(newMuted);
    setCallState(s => ({ ...s, muted: newMuted }));
  }, [callState.muted]);

  // ── Incoming call controls ─────────────────────────────────────────
  const answerCall = useCallback(() => {
    const call = incomingCallRef.current;
    if (!call) return;
    call.accept();
    callRef.current = call;
    incomingCallRef.current = null;
    setCallState(s => ({ ...s, status: 'in-call', callSid: call.parameters?.CallSid ?? s.callSid }));
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setCallState(s => ({ ...s, duration: Math.floor((Date.now() - start) / 1000) }));
    }, 1000);
  }, []);

  const rejectCall = useCallback(() => {
    incomingCallRef.current?.reject();
    incomingCallRef.current = null;
    parentCallSidRef.current = null;
    setCallState(s => ({ ...s, status: 'ready', currentNumber: null, contactName: null, contactId: null, callSid: null }));
  }, []);

  // ── Transfer to another agent via Conference ───────────────────────────
  const transferCall = useCallback(async (targetAgentUserId: string): Promise<{ ok: boolean; error?: string }> => {
    const parentCallSid = parentCallSidRef.current;
    if (!parentCallSid) return { ok: false, error: 'No hay parentCallSid disponible (solo llamadas entrantes)' };

    setCallState(s => ({ ...s, transferring: true }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { ok: false, error: 'Sin sesión' };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-transfer`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ parentCallSid, targetAgentUserId }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setCallState(s => ({ ...s, transferring: false }));
        return { ok: false, error: data.error || 'Error al transferir' };
      }

      // Transfer succeeded — hang up the transferring agent's leg
      callRef.current?.disconnect();
      deviceRef.current?.disconnectAll();
      return { ok: true };
    } catch (err: any) {
      setCallState(s => ({ ...s, transferring: false }));
      return { ok: false, error: err.message };
    }
  }, []);

  return { callState, dial, hangUp, toggleMute, answerCall, rejectCall, transferCall };
};
