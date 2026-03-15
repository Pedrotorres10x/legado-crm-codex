import { useEffect, useRef, useState } from 'react';
import { PhoneOff, PhoneIncoming, Mic, MicOff, Volume2, User, ExternalLink, ArrowRightLeft, ChevronDown, Check, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTwilio } from '@/contexts/TwilioContext';
import { hapticMedium, hapticLight } from '@/lib/haptics';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import QuickCreateContact from './QuickCreateContact';

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

/** Returns initials from a name or phone number */
const getInitials = (nameOrNumber: string) => {
  const parts = nameOrNumber.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length > 0) return parts[0][0].toUpperCase();
  return '?';
};

/** Full-screen call overlay — shown for incoming, calling and active calls */
const ActiveCallOverlay = () => {
  const { callState, hangUp, toggleMute, answerCall, rejectCall, transferCall } = useTwilio();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dots, setDots] = useState('');
  const [showTransferMenu, setShowTransferMenu] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const lastAutoOpenedKeyRef = useRef<string | null>(null);

  // Animated dots for "calling..." state
  useEffect(() => {
    if (callState.status !== 'calling') { setDots(''); return; }
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(id);
  }, [callState.status]);

  // Close transfer menu when call ends
  useEffect(() => {
    if (callState.status !== 'in-call') setShowTransferMenu(false);
  }, [callState.status]);

  // When the call is already linked to a CRM contact, open that ficha automatically.
  useEffect(() => {
    const shouldAutoOpen =
      (callState.status === 'calling' || callState.status === 'incoming' || callState.status === 'in-call') &&
      callState.contactId;

    if (!shouldAutoOpen) {
      if (callState.status === 'ready' || callState.status === 'error' || callState.status === 'loading' || callState.status === 'unconfigured') {
        lastAutoOpenedKeyRef.current = null;
      }
      return;
    }

    const autoOpenKey = `${callState.contactId}:${callState.callSid ?? callState.currentNumber ?? callState.status}`;
    if (lastAutoOpenedKeyRef.current === autoOpenKey) return;
    lastAutoOpenedKeyRef.current = autoOpenKey;
    navigate(`/contacts/${callState.contactId}`);
  }, [callState.callSid, callState.contactId, callState.currentNumber, callState.status, navigate]);

  // Load agents for the transfer menu
  const { data: agents = [] } = useQuery({
    queryKey: ['profiles-for-transfer'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');
      return (data ?? []).filter(p => p.user_id !== user?.id);
    },
    enabled: showTransferMenu,
  });

  const handleTransfer = async (targetAgentUserId: string, targetName: string) => {
    hapticMedium();
    setShowTransferMenu(false);
    const result = await transferCall(targetAgentUserId);
    if (result.ok) {
      toast.success(`Llamada transferida a ${targetName}`);
    } else {
      toast.error(result.error ?? 'Error al transferir la llamada');
    }
  };

  const isVisible =
    callState.status === 'calling' ||
    callState.status === 'in-call' ||
    callState.status === 'incoming';

  if (!isVisible) return null;

  // Show contact name if known, otherwise fall back to raw number
  const displayName = callState.contactName ?? callState.currentNumber ?? '—';
  const isKnownContact = Boolean(callState.contactName);
  const isConnected = callState.status === 'in-call';
  const isIncoming = callState.status === 'incoming';
  // Transfer only available for incoming answered calls (parentCallSid is set)
  const canTransfer = isConnected;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col backdrop-blur-xl',
        isIncoming
          ? 'bg-gradient-to-b from-green-800/95 to-green-900/90'
          : 'bg-gradient-to-b from-primary/95 to-primary/75',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── Status label ── */}
      <div className="flex justify-center pt-12 pb-4">
        <span className="text-white/80 text-sm font-medium tracking-wide">
          {isIncoming
            ? 'Llamada entrante'
            : isConnected
              ? callState.transferring ? 'Transfiriendo...' : 'Llamada activa'
              : `Llamando${dots}`}
        </span>
      </div>

      {/* ── Avatar ── */}
      <div className="flex flex-col items-center gap-6 flex-1 justify-center">
        {/* Pulsing rings */}
        <div className="relative flex items-center justify-center">
          {(isConnected || isIncoming) && (
            <>
              <div className="absolute h-44 w-44 rounded-full bg-white/10 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute h-36 w-36 rounded-full bg-white/15 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }} />
            </>
          )}
          <div className="relative h-28 w-28 rounded-full bg-white/20 flex items-center justify-center shadow-2xl ring-4 ring-white/30">
            {isIncoming && !isKnownContact
              ? <PhoneIncoming className="h-12 w-12 text-white" />
              : isKnownContact
                ? <User className="h-12 w-12 text-white" />
                : <span className="text-white text-4xl font-bold select-none">{getInitials(displayName)}</span>
            }
          </div>
        </div>

        {/* Name / number */}
        <div className="text-center px-8">
          <p className="text-white text-3xl font-bold tracking-tight leading-tight">{displayName}</p>

          {/* Known contact badge or create-contact button */}
          {isKnownContact ? (
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white/20 text-white/80 text-xs font-medium">
              <User className="h-3 w-3" /> Contacto CRM
            </span>
          ) : callState.currentNumber ? (
            <button
              onClick={() => { hapticLight(); setShowCreateContact(true); }}
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium hover:bg-white/30 transition-colors active:scale-95"
            >
              <UserPlus className="h-3.5 w-3.5" /> Dar de alta como contacto
            </button>
          ) : null}

          {/* Timer or status */}
          <div className="mt-3 flex flex-col items-center gap-1">
            {isConnected ? (
              <>
                <span className="text-white/90 text-2xl font-mono font-semibold tabular-nums">
                  {formatDuration(callState.duration)}
                </span>
                {callState.contactId && (
                  <button
                    onClick={() => { hapticLight(); navigate(`/contacts/${callState.contactId}`); }}
                    className="flex items-center gap-1 text-white/70 text-xs font-medium hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver ficha
                  </button>
                )}
              </>
            ) : isIncoming ? (
              <>
                <span className="text-white/80 text-base font-medium">Toca para responder</span>
                {callState.contactId && (
                  <button
                    onClick={() => { hapticLight(); navigate(`/contacts/${callState.contactId}`); }}
                    className="flex items-center gap-1 text-white/70 text-xs font-medium hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver ficha
                  </button>
                )}
              </>
            ) : (
              <div className="flex gap-1.5 items-center h-9">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-white/70 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Transfer agent picker (shown when menu is open) ── */}
        {showTransferMenu && (
          <div className="w-full max-w-xs mx-auto bg-white/15 backdrop-blur rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/20">
              <span className="text-white text-sm font-semibold">Transferir a...</span>
              <button onClick={() => setShowTransferMenu(false)} className="text-white/60 hover:text-white p-1">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {agents.length === 0 ? (
                <p className="text-white/60 text-sm text-center py-4">Sin agentes disponibles</p>
              ) : (
                agents.map(agent => (
                  <button
                    key={agent.user_id}
                    onClick={() => handleTransfer(agent.user_id, agent.full_name)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/10 transition-colors active:bg-white/20"
                  >
                    <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">
                        {agent.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    </div>
                    <span className="text-white text-sm font-medium">{agent.full_name}</span>
                    <Check className="h-4 w-4 text-white/40 ml-auto opacity-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="pb-16 px-10">
        {isIncoming ? (
          /* ── Incoming: reject (left) + answer (right) ── */
          <div className="flex items-end justify-center gap-16">
            {/* Reject */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => { hapticMedium(); rejectCall(); }}
                className="h-20 w-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 active:scale-90 transition-all"
              >
                <PhoneOff className="h-8 w-8 text-white" />
              </button>
              <span className="text-white/70 text-xs font-medium">Rechazar</span>
            </div>

            {/* Answer */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => { hapticMedium(); answerCall(); }}
                className="h-20 w-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/40 active:scale-90 transition-all animate-pulse"
              >
                <PhoneIncoming className="h-8 w-8 text-white" />
              </button>
              <span className="text-white/70 text-xs font-medium">Aceptar</span>
            </div>
          </div>
        ) : isConnected ? (
          /* ── Connected: mute + transfer + hang up + speaker ── */
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-end justify-center gap-8">
              {/* Mute */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => { hapticLight(); toggleMute(); }}
              className={cn(
                  'h-16 w-16 rounded-full flex items-center justify-center transition-all active:scale-90',
                  callState.muted
                    ? 'bg-white text-primary'
                    : 'bg-white/20 text-white',
                )}
              >
                {callState.muted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
              </button>
              <span className="text-white/70 text-xs font-medium">
                  {callState.muted ? 'Silenciado' : 'Silenciar'}
              </span>
            </div>

            {/* Hang up */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => { hapticMedium(); hangUp(); }}
                className="h-20 w-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 active:scale-90 transition-all"
              >
                <PhoneOff className="h-8 w-8 text-white" />
              </button>
              <span className="text-white/70 text-xs font-medium">Colgar</span>
            </div>

            {/* Speaker */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => hapticLight()}
                className="h-16 w-16 rounded-full bg-white/20 text-white flex items-center justify-center active:scale-90 transition-all"
              >
                <Volume2 className="h-7 w-7" />
              </button>
              <span className="text-white/70 text-xs font-medium">Altavoz</span>
            </div>
          </div>

          {/* Transfer button */}
          {canTransfer && (
            <button
              onClick={() => { hapticLight(); setShowTransferMenu(v => !v); }}
              disabled={callState.transferring}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95',
                showTransferMenu
                  ? 'bg-white text-primary'
                  : 'bg-white/20 text-white hover:bg-white/30',
                callState.transferring && 'opacity-60 cursor-not-allowed',
              )}
              >
                <ArrowRightLeft className="h-4 w-4" />
                {callState.transferring ? 'Transfiriendo...' : 'Transferir'}
              </button>
            )}
          </div>
        ) : (
          /* ── Calling (outbound ringing) — only hang up ── */
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => { hapticMedium(); hangUp(); }}
              className="h-20 w-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 active:scale-90 transition-all"
            >
              <PhoneOff className="h-8 w-8 text-white" />
            </button>
            <span className="text-white/70 text-xs font-medium">Cancelar</span>
          </div>
        )}
      </div>
      {/* Quick create contact dialog */}
      {callState.currentNumber && (
        <QuickCreateContact
          open={showCreateContact}
          onOpenChange={setShowCreateContact}
          phone={callState.currentNumber}
          onCreated={(contactId) => { setShowCreateContact(false); navigate(`/contacts/${contactId}`); }}
        />
      )}
    </div>
  );
};

export default ActiveCallOverlay;
