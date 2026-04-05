import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Phone, Loader2, PhoneIncoming, PhoneOutgoing, Mic, MicOff, Sparkles, ClipboardList } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface LogCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  phone: string;
  onLogged?: () => void;
  defaultDirection?: 'entrante' | 'saliente';
}

const RESULTS = [
  { value: 'conectada', label: 'Conectada' },
  { value: 'no_contesta', label: 'No contesta' },
  { value: 'buzon', label: 'Buzón de voz' },
  { value: 'ocupado', label: 'Ocupado' },
  { value: 'equivocado', label: 'Equivocado' },
];

const DURATIONS = [
  { value: '1', label: '1 min' },
  { value: '5', label: '5 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30+ min' },
];

type SpeechRecognitionResultLike = {
  transcript: string;
};

type SpeechRecognitionAlternativeListLike = {
  0: SpeechRecognitionResultLike;
};

type SpeechRecognitionEntryLike = {
  isFinal: boolean;
  0: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionEntryLike>;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const LogCallDialog = ({ open, onOpenChange, contactId, contactName, phone, onLogged, defaultDirection = 'saliente' }: LogCallDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [direction, setDirection] = useState<'entrante' | 'saliente'>(defaultDirection);
  const [result, setResult] = useState('conectada');
  const [duration, setDuration] = useState('5');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [createTask, setCreateTask] = useState(true);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const toggleDictation = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: 'No soportado', description: 'Tu navegador no soporta dictado por voz.', variant: 'destructive' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim = transcript;
        }
      }
      setNotes(prev => {
        const base = prev.replace(/\[dictando\.\.\.\].*$/, '').trimEnd();
        const combined = base ? `${base} ${finalTranscript}` : finalTranscript;
        return interim ? `${combined}[dictando...] ${interim}` : combined.trimEnd();
      });
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setNotes(prev => prev.replace(/\[dictando\.\.\.\].*$/, '').trimEnd());
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, toast]);

  const handleSummarize = async () => {
    if (!notes.trim()) {
      toast({ title: 'Sin notas', description: 'Escribe o dicta notas primero.', variant: 'destructive' });
      return;
    }
    setSummarizing(true);
    try {
      const resultLabel = RESULTS.find(r => r.value === result)?.label || result;
      const dirLabel = direction === 'entrante' ? 'Entrante' : 'Saliente';
      const { data, error } = await supabase.functions.invoke('ai-call-summary', {
        body: { rawNotes: notes, contactName, direction: dirLabel, result: resultLabel },
      });
      if (error) throw error;
      if (data?.summary) {
        setNotes(data.summary);
        toast({ title: 'Resumen generado', description: 'Las notas han sido resumidas por IA.' });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Inténtalo de nuevo.';
      toast({ title: 'Error al resumir', description: message, variant: 'destructive' });
    } finally {
      setSummarizing(false);
    }
  };

  const handleSave = async () => {
    if (!notes.trim() || notes.trim().length < 12) {
      toast({
        title: 'Falta resultado de la llamada',
        description: 'Resume lo hablado y deja el siguiente paso para que la llamada tenga valor comercial real.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const durationLabel = DURATIONS.find(d => d.value === duration)?.label || duration;
    const resultLabel = RESULTS.find(r => r.value === result)?.label || result;
    const directionLabel = direction === 'entrante' ? 'Entrante' : 'Saliente';
    const description = [
      `Dirección: ${directionLabel}`,
      `Duración: ${durationLabel}`,
      `Teléfono: ${phone}`,
      notes ? `Notas: ${notes}` : '',
    ].filter(Boolean).join('\n');

    const { error } = await supabase.from('interactions').insert({
      contact_id: contactId,
      interaction_type: 'llamada',
      subject: resultLabel,
      description,
      agent_id: user?.id,
    });

    if (error) {
      setSaving(false);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Create follow-up task if requested
    if (createTask && user?.id) {
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 24);
      await supabase.from('tasks').insert({
        agent_id: user.id,
        contact_id: contactId,
        title: `Seguimiento llamada: ${contactName}`,
        description: [
          `📞 Llamada ${directionLabel.toLowerCase()} — ${durationLabel}`,
          notes ? `\nNotas:\n${notes}` : '',
        ].filter(Boolean).join(''),
        task_type: 'llamada',
        priority: 'media',
        due_date: dueDate.toISOString(),
        completed: false,
      });
    }

    setSaving(false);
    toast({ title: 'Llamada registrada', description: `${contactName} — ${resultLabel}` });
    setDirection(defaultDirection);
    setResult('conectada');
    setDuration('5');
    setNotes('');
    onOpenChange(false);
    onLogged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Registrar llamada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm font-semibold">Llamada con resultado defendible</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Si no anotas que paso y cual es el siguiente movimiento, la llamada pesa menos en seguimiento y Horus.
            </p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{contactName}</p>
              <p className="text-xs text-muted-foreground">{phone}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Dirección</Label>
            <ToggleGroup type="single" value={direction} onValueChange={(v) => v && setDirection(v as 'entrante' | 'saliente')} className="justify-start">
              <ToggleGroupItem value="saliente" className="flex items-center gap-1.5 px-3 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                <PhoneOutgoing className="h-4 w-4" />
                <span className="text-sm">Saliente</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="entrante" className="flex items-center gap-1.5 px-3 data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
                <PhoneIncoming className="h-4 w-4" />
                <span className="text-sm">Entrante</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Resultado</Label>
            <Select value={result} onValueChange={setResult}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESULTS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Duración</Label>
            <RadioGroup value={duration} onValueChange={setDuration} className="flex gap-2">
              {DURATIONS.map(d => (
                <label key={d.value} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:border-primary">
                  <RadioGroupItem value={d.value} className="sr-only" />
                  <span className="text-sm">{d.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Resultado y siguiente paso *</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={listening ? 'destructive' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs"
                  onClick={toggleDictation}
                >
                  {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {listening ? 'Parar' : 'Dictar'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs"
                  onClick={handleSummarize}
                  disabled={summarizing || !notes.trim()}
                >
                  {summarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Resumir IA
                </Button>
              </div>
            </div>
              <Textarea
              placeholder={listening ? 'Escuchando...' : 'Ej: Queda en revisar propuesta hoy y volver a llamar el jueves para cerrar visita de captacion.'}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className={listening ? 'border-destructive/50 animate-pulse' : ''}
            />
          </div>

          {/* Create task toggle */}
          <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/30">
            <Checkbox
              id="create-task"
              checked={createTask}
              onCheckedChange={(v) => setCreateTask(!!v)}
            />
            <label htmlFor="create-task" className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span>Crear tarea de seguimiento (24h)</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogCallDialog;
