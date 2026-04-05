import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Mic, PhoneCall, PhoneForwarded, Sparkles, UserCheck } from 'lucide-react';

type VoiceCampaign = Tables<'voice_campaigns'>;
type VoiceCampaignContact = Tables<'voice_campaign_contacts'>;

type SourceScope = 'database' | 'statefox';

type ContactCandidate = {
  id: string;
  full_name: string;
  phone: string | null;
  phone2: string | null;
  city: string | null;
  source_ref: string | null;
  status: string;
};

const EMPTY_QUEUE_ROWS: VoiceCampaignContact[] = [];

const PURPOSE_PRESETS = [
  {
    code: 'statefox_disposicion_positiva',
    label: 'StateFox: detectar disposición positiva',
    prompt: 'Detecta si el propietario muestra apertura suficiente para que un humano llame y busque cita. No expliques el servicio ni discutas objeciones.',
    successSignals: ['apertura', 'escucha', 'acepta contacto humano'],
    exclusionSignals: ['inmobiliaria', 'numero_erroneo', 'hostilidad', 'no_contactar'],
    sourceScope: 'statefox' as SourceScope,
  },
  {
    code: 'sanitize_validar_decisor',
    label: 'Sanear BBDD: validar decisor',
    prompt: 'Confirma si el teléfono sigue siendo válido, si hablas con la persona correcta y si merece seguimiento humano. Conversación breve, sin vender.',
    successSignals: ['telefono_valido', 'persona_correcta', 'apertura_minima'],
    exclusionSignals: ['numero_erroneo', 'hostilidad', 'no_contactar'],
    sourceScope: 'database' as SourceScope,
  },
];

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  queued: 'bg-blue-100 text-blue-800',
  running: 'bg-amber-100 text-amber-800',
  paused: 'bg-slate-100 text-slate-700',
  completed: 'bg-green-100 text-green-800',
  archived: 'bg-zinc-100 text-zinc-700',
  pending: 'bg-muted text-muted-foreground',
  calling: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  excluded: 'bg-zinc-100 text-zinc-700',
};

function getPrimaryPhone(contact: ContactCandidate) {
  return contact.phone?.trim() || contact.phone2?.trim() || null;
}

function formatDate(value: string | null) {
  if (!value) return 'n/d';
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VoiceCampaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPresetCode, setSelectedPresetCode] = useState(PURPOSE_PRESETS[0].code);
  const selectedPreset = useMemo(
    () => PURPOSE_PRESETS.find((preset) => preset.code === selectedPresetCode) ?? PURPOSE_PRESETS[0],
    [selectedPresetCode],
  );

  const [campaignName, setCampaignName] = useState('StateFox saneamiento inicial');
  const [sourceScope, setSourceScope] = useState<SourceScope>(selectedPreset.sourceScope);
  const [purposePrompt, setPurposePrompt] = useState(selectedPreset.prompt);
  const [batchSize, setBatchSize] = useState('75');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  useEffect(() => {
    setSourceScope(selectedPreset.sourceScope);
    setPurposePrompt(selectedPreset.prompt);
    setCampaignName(selectedPreset.label);
  }, [selectedPreset]);

  const previewQuery = useQuery({
    queryKey: ['voice-campaign-preview', sourceScope, batchSize],
    queryFn: async () => {
      const limit = Math.min(Math.max(Number(batchSize || '75'), 1), 500);
      let query = supabase
        .from('contacts')
        .select('id, full_name, phone, phone2, city, source_ref, status', { count: 'exact' })
        .eq('opt_out', false)
        .or('phone.not.is.null,phone2.not.is.null')
        .order('updated_at', { ascending: false })
        .limit(Math.min(limit, 8));

      if (sourceScope === 'statefox') {
        query = query.ilike('source_ref', 'statefox:%');
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        count: count ?? 0,
        sample: (data ?? []) as ContactCandidate[],
      };
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ['voice-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as VoiceCampaign[];
    },
  });

  useEffect(() => {
    if (!selectedCampaignId && campaignsQuery.data?.length) {
      setSelectedCampaignId(campaignsQuery.data[0].id);
    }
  }, [campaignsQuery.data, selectedCampaignId]);

  const campaignQueueQuery = useQuery({
    queryKey: ['voice-campaign-queue', selectedCampaignId],
    enabled: Boolean(selectedCampaignId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_campaign_contacts')
        .select('*')
        .eq('campaign_id', selectedCampaignId as string)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as VoiceCampaignContact[];
    },
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sesión no disponible');

      const limit = Math.min(Math.max(Number(batchSize || '75'), 1), 500);
      let contactsQuery = supabase
        .from('contacts')
        .select('id, full_name, phone, phone2, city, source_ref, status')
        .eq('opt_out', false)
        .or('phone.not.is.null,phone2.not.is.null')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (sourceScope === 'statefox') {
        contactsQuery = contactsQuery.ilike('source_ref', 'statefox:%');
      }

      const { data: contacts, error: contactsError } = await contactsQuery;
      if (contactsError) throw contactsError;

      const eligibleContacts = ((contacts ?? []) as ContactCandidate[])
        .map((contact) => ({
          ...contact,
          primaryPhone: getPrimaryPhone(contact),
        }))
        .filter((contact) => Boolean(contact.primaryPhone));

      if (eligibleContacts.length === 0) {
        throw new Error('No hay contactos elegibles con teléfono para esta campaña');
      }

      const campaignInsert = {
        name: campaignName.trim() || selectedPreset.label,
        purpose_code: selectedPreset.code,
        purpose_prompt: purposePrompt.trim() || null,
        provider: 'elevenlabs',
        source_scope: sourceScope,
        status: 'queued',
        created_by: user.id,
        target_filter: {
          source_scope: sourceScope,
          max_contacts: limit,
        } satisfies Json,
        success_criteria: {
          signals: selectedPreset.successSignals,
          handoff_threshold: 'positive_disposition',
        } satisfies Json,
        exclusion_criteria: {
          signals: selectedPreset.exclusionSignals,
          stop_on_hostility: true,
        } satisfies Json,
      };

      const { data: campaign, error: campaignError } = await supabase
        .from('voice_campaigns')
        .insert(campaignInsert)
        .select('*')
        .single();

      if (campaignError) throw campaignError;

      const queueRows = eligibleContacts.map((contact, index) => ({
        campaign_id: campaign.id,
        contact_id: contact.id,
        display_name: contact.full_name,
        phone: contact.primaryPhone as string,
        source_ref: contact.source_ref,
        city: contact.city,
        priority: index + 1,
        payload: {
          contact_status: contact.status,
          source_scope: sourceScope,
          purpose_code: selectedPreset.code,
        } satisfies Json,
      }));

      const { error: queueError } = await supabase.from('voice_campaign_contacts').insert(queueRows);
      if (queueError) throw queueError;

      return campaign as VoiceCampaign;
    },
    onSuccess: (campaign) => {
      toast({
        title: 'Campaña creada',
        description: `Se ha dejado en cola "${campaign.name}" para el siguiente paso de integración con ElevenLabs.`,
      });
      setSelectedCampaignId(campaign.id);
      queryClient.invalidateQueries({ queryKey: ['voice-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['voice-campaign-queue'] });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo crear la campaña',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    },
  });

  const dispatchCampaign = useMutation({
    mutationFn: async () => {
      if (!selectedCampaignId) throw new Error('Selecciona una campaña');
      const { data, error } = await supabase.functions.invoke('voice-campaign-dispatch', {
        body: {
          campaign_id: selectedCampaignId,
          limit: Math.min(Math.max(Number(batchSize || '10'), 1), 50),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { dispatched: number; skipped: number };
    },
    onSuccess: (data) => {
      toast({
        title: 'Dispatch lanzado',
        description: `${data.dispatched} llamada(s) enviadas al proveedor y ${data.skipped} excluida(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ['voice-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['voice-campaign-queue'] });
    },
    onError: (error) => {
      toast({
        title: 'No se pudo lanzar el dispatch',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    },
  });

  const queueRows = campaignQueueQuery.data ?? EMPTY_QUEUE_ROWS;
  const queueStats = useMemo(() => {
    return queueRows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.handoff_to_human) acc.handoff += 1;
        if (row.status === 'completed') acc.completed += 1;
        if (row.status === 'excluded') acc.excluded += 1;
        return acc;
      },
      { total: 0, handoff: 0, completed: 0, excluded: 0 },
    );
  }, [queueRows]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Campaign Engine de voz
            </CardTitle>
            <CardDescription>
              Núcleo reutilizable para sanear BBDD, detectar disposición positiva y dejar el pase al humano dentro del CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Propósito inicial</Label>
                <Select value={selectedPresetCode} onValueChange={setSelectedPresetCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSE_PRESETS.map((preset) => (
                      <SelectItem key={preset.code} value={preset.code}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Origen de la cola</Label>
                <Select value={sourceScope} onValueChange={(value) => setSourceScope(value as SourceScope)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="statefox">StateFox</SelectItem>
                    <SelectItem value="database">BBDD general</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_160px]">
              <div className="space-y-2">
                <Label>Nombre de campaña</Label>
                <Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tamaño máximo</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={batchSize}
                  onChange={(event) => setBatchSize(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Instrucción operativa</Label>
              <Textarea
                value={purposePrompt}
                onChange={(event) => setPurposePrompt(event.target.value)}
                className="min-h-[110px]"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {selectedPreset.successSignals.map((signal) => (
                <Badge key={signal} variant="outline">{signal}</Badge>
              ))}
              {selectedPreset.exclusionSignals.map((signal) => (
                <Badge key={signal} className="bg-red-50 text-red-700 hover:bg-red-50">{signal}</Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending || previewQuery.isLoading}>
                {createCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
                Crear campaña base
              </Button>
              <div className="text-sm text-muted-foreground">
                Esta fase crea la cola y el modelo de datos. La llamada real a ElevenLabs se conecta encima de esta estructura.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Previsualización
            </CardTitle>
            <CardDescription>
              Contactos elegibles con teléfono y sin `opt_out`, según el segmento elegido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Elegibles</div>
                <div className="text-2xl font-semibold">{previewQuery.data?.count ?? '—'}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Proveedor objetivo</div>
                <div className="text-2xl font-semibold">ElevenLabs</div>
              </div>
            </div>

            <div className="space-y-2">
              {(previewQuery.data?.sample ?? []).map((contact) => (
                <div key={contact.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{contact.full_name}</span>
                    <Badge className={STATUS_STYLES.pending}>{contact.status}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {getPrimaryPhone(contact) || 'sin teléfono'} · {contact.city || 'sin ciudad'} · {contact.source_ref || 'sin origen'}
                  </div>
                </div>
              ))}
              {previewQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando muestra...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Campañas creadas</CardTitle>
            <CardDescription>Base reutilizable por propósito. La conversación real se enchufa después.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(campaignsQuery.data ?? []).map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => setSelectedCampaignId(campaign.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedCampaignId === campaign.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{campaign.name}</span>
                  <Badge className={STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft}>{campaign.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {campaign.purpose_code} · {campaign.source_scope} · {formatDate(campaign.created_at)}
                </div>
              </button>
            ))}
            {!campaignsQuery.isLoading && (campaignsQuery.data?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Aún no hay campañas. Crea la primera cola y luego conectamos el dispatch a ElevenLabs.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneForwarded className="h-5 w-5 text-primary" />
              Cola de campaña
            </CardTitle>
            <CardDescription>
              Contactos listos para ser despachados por el proveedor de voz. El pase a humano se apoyará en `handoff_to_human`.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">En cola</div>
                <div className="text-2xl font-semibold">{queueStats.total}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Handoff</div>
                <div className="text-2xl font-semibold">{queueStats.handoff}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Completados</div>
                <div className="text-2xl font-semibold">{queueStats.completed}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Excluidos</div>
                <div className="text-2xl font-semibold">{queueStats.excluded}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => dispatchCampaign.mutate()}
                disabled={!selectedCampaignId || dispatchCampaign.isPending}
              >
                {dispatchCampaign.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PhoneCall className="mr-2 h-4 w-4" />
                )}
                Lanzar dispatch
              </Button>
              <span className="text-sm text-muted-foreground">
                Envía los pendientes al endpoint de ElevenLabs configurado.
              </span>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead className="text-right">Intentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.display_name}</div>
                        <div className="text-xs text-muted-foreground">{row.source_ref || 'sin origen'}</div>
                      </TableCell>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[row.status] ?? STATUS_STYLES.pending}>{row.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {row.handoff_to_human ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700">
                            <UserCheck className="h-4 w-4" />
                            Pasa a humano
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{row.outcome_code || 'pendiente'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{row.attempt_count}</TableCell>
                    </TableRow>
                  ))}
                  {!campaignQueueQuery.isLoading && queueRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        Selecciona una campaña para ver la cola. Todavía no hay ejecuciones ni resultados conectados al proveedor.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
