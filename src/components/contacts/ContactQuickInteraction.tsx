import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type InteractionLabels = Record<string, string>;

export default function ContactQuickInteraction({
  contactId,
  userId,
  onAdded,
  interactionLabels,
}: {
  contactId: string;
  userId?: string;
  onAdded: () => void;
  interactionLabels: InteractionLabels;
}) {
  const { toast } = useToast();
  const [type, setType] = useState('llamada');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim() || text.trim().length < 8) {
      toast({
        title: 'Falta resultado breve',
        description: 'Resume que paso o cual es el siguiente paso para que este toque tenga valor real.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('interactions').insert({
      contact_id: contactId,
      interaction_type: type as any,
      subject: text.trim(),
      agent_id: userId,
    });
    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setText('');
    toast({ title: 'Interacción registrada' });
    onAdded();
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(interactionLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="flex-1"
        placeholder="Resultado breve o siguiente paso..."
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
      />
      <Button size="icon" onClick={submit} disabled={saving || !text.trim()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}
