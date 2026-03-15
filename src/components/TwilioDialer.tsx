import { useState, useRef, useEffect } from 'react';
import { Phone, Search, X, User, Loader2, Wifi, WifiOff, AlertCircle, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTwilio } from '@/contexts/TwilioContext';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { toast } from '@/hooks/use-toast';
import QuickCreateContact from './QuickCreateContact';

interface Contact {
  id: string;
  full_name: string;
  phone: string | null;
  phone2?: string | null;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const StatusIndicator = ({ status }: { status: string }) => {
  if (status === 'loading') return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      Conectando con Twilio...
    </div>
  );
  if (status === 'ready') return (
    <div className="flex items-center gap-1.5 text-xs text-primary">
      <Wifi className="h-3 w-3" />
      Listo para llamar
    </div>
  );
  if (status === 'calling') return (
    <div className="flex items-center gap-1.5 text-xs text-warning font-medium">
      <Loader2 className="h-3 w-3 animate-spin" />
      Llamando...
    </div>
  );
  if (status === 'in-call') return (
    <div className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse">
      <Phone className="h-3 w-3" />
      En llamada
    </div>
  );
  if (status === 'error') return (
    <div className="flex items-center gap-1.5 text-xs text-destructive">
      <WifiOff className="h-3 w-3" />
      Error de conexión
    </div>
  );
  return null;
};

const TwilioDialer = () => {
  const { callState, dial, hangUp, toggleMute } = useTwilio();
  const [number, setNumber] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [createContactPhone, setCreateContactPhone] = useState('');
  const searchRef = useRef<ReturnType<typeof setTimeout>>();
  const prevStatusRef = useRef(callState.status);

  // Detect silent call failures: calling → ready without going through in-call
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === 'calling' && callState.status === 'ready') {
      toast({
        title: 'Llamada no conectada',
        description: callState.error || 'La llamada se cortó antes de conectar. Revisa la conexión o permisos del micrófono.',
        variant: 'destructive',
      });
    }
    prevStatusRef.current = callState.status;
  }, [callState.status, callState.error]);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    clearTimeout(searchRef.current);
    setSearching(true);
    searchRef.current = setTimeout(async () => {
      const q = search.trim();
      const { data } = await supabase
        .from('contacts')
        .select('id, full_name, phone, phone2')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,phone2.ilike.%${q}%`)
        .limit(8);
      setResults(data || []);
      setSearching(false);
    }, 300);
  }, [search]);

  const handleKey = (key: string) => {
    hapticLight();
    setNumber(prev => prev + key);
  };

  const handleDial = (phone: string, contact?: Contact) => {
    hapticMedium();
    dial(phone, contact ? { contactId: contact.id, contactName: contact.full_name } : undefined);
  };

  // ── Unconfigured state ──────────────────────────────────────────────────
  if (callState.status === 'unconfigured') {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center px-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Twilio no configurado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Para habilitar llamadas VoIP, añade las credenciales de Twilio en la configuración del proyecto.
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-left text-xs space-y-1 w-full">
          <p className="font-medium text-foreground">Secretos necesarios:</p>
          <p className="text-muted-foreground font-mono">TWILIO_ACCOUNT_SID</p>
          <p className="text-muted-foreground font-mono">TWILIO_API_KEY</p>
          <p className="text-muted-foreground font-mono">TWILIO_API_SECRET</p>
          <p className="text-muted-foreground font-mono">TWILIO_TWIML_APP_SID</p>
          <p className="text-muted-foreground font-mono">TWILIO_PHONE_NUMBER</p>
        </div>
      </div>
    );
  }

  // ── In-call: the overlay handles the full-screen UI, show a minimal placeholder ──
  if (callState.status === 'in-call' || callState.status === 'calling') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Phone className="h-7 w-7 text-primary animate-pulse" />
        </div>
        <p className="text-sm text-muted-foreground">
          {callState.status === 'calling' ? 'Llamando...' : 'Llamada en curso'}
        </p>
      </div>
    );
  }

  // ── Normal dialer UI ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <StatusIndicator status={callState.status} />
        {callState.error && (
          <p className="text-xs text-destructive truncate max-w-[60%]">{callState.error}</p>
        )}
      </div>

      {/* Contact search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contacto por nombre o teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-9"
        />
        {search && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => { setSearch(''); setResults([]); }}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Contact results */}
      {results.length > 0 && (
        <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
          {results.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.full_name}</p>
                <p className="text-xs text-muted-foreground">{c.phone || c.phone2 || 'Sin teléfono'}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {c.phone && (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                    onClick={() => handleDial(c.phone!, c)}
                    disabled={callState.status !== 'ready'}>
                    <Phone className="h-3.5 w-3.5" />
                    {c.phone}
                  </Button>
                )}
                {c.phone2 && (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                    onClick={() => handleDial(c.phone2!, c)}
                    disabled={callState.status !== 'ready'}>
                    <Phone className="h-3.5 w-3.5" />
                    {c.phone2}
                  </Button>
                )}
                {!c.phone && !c.phone2 && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled>
                    Sin teléfono
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {search && results.length === 0 && !searching && (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-sm text-muted-foreground">No se encontraron contactos</p>
          {/^[\d\s\+\-()]{3,}$/.test(search.trim()) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => { setCreateContactPhone(search.trim()); setCreateContactOpen(true); }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Dar de alta como contacto
            </Button>
          )}
        </div>
      )}

      {/* Numeric pad (only when not searching) */}
      {!search && (
        <>
          <div className="relative flex items-center justify-center min-h-[52px]">
            <span className={cn(
              "text-3xl font-mono tracking-widest text-foreground transition-all",
              !number && "text-muted-foreground/30 text-lg"
            )}>
              {number || 'Marca un número'}
            </span>
            {number && (
              <button
                onClick={() => { hapticLight(); setNumber(prev => prev.slice(0, -1)); }}
                className="absolute right-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                ⌫
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {KEYS.map(key => (
              <button
                key={key}
                onClick={() => handleKey(key)}
                className="flex items-center justify-center h-14 rounded-2xl border border-border/50 bg-card text-xl font-semibold text-foreground hover:bg-accent/60 active:scale-95 transition-all duration-100 select-none"
              >
                {key}
              </button>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full h-14 text-base gap-2 rounded-2xl"
            disabled={!number || callState.status !== 'ready'}
            onClick={() => handleDial(number)}
          >
            <Phone className="h-5 w-5" />
            {callState.status === 'loading' ? 'Conectando...' : `Llamar ${number}`}
          </Button>

          {number.length >= 6 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 text-muted-foreground"
              onClick={() => { setCreateContactPhone(number); setCreateContactOpen(true); }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Dar de alta como contacto
            </Button>
          )}
        </>
      )}
      <QuickCreateContact
        open={createContactOpen}
        onOpenChange={setCreateContactOpen}
        phone={createContactPhone}
        onCreated={() => {
          setCreateContactOpen(false);
          // Refresh search if active
          if (search) setSearch(search + ' ');
        }}
      />
    </div>
  );
};

export default TwilioDialer;
