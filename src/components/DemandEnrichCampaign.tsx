import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Eye, RefreshCw, Target, MapPin, Banknote, Loader2, AlertTriangle, MessageSquare, Snowflake } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface EnrichStats {
  total_incomplete: number;
  missing_budget: number;
  missing_zone: number;
  pending_response: number;
  enriched: number;
  no_response: number;
  nevera: number;
}

interface ActiveConversation {
  contact_id: string;
  contact_name: string;
  last_message: string;
  last_date: string;
  direction: string;
  turns: number;
  missing: string[];
}

const DemandEnrichCampaign = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['demand-enrich-stats'],
    queryFn: async (): Promise<EnrichStats> => {
      const { data: demands } = await supabase
        .from('demands')
        .select('id, max_price, cities')
        .eq('is_active', true);

      const allDemands = demands || [];
      const incomplete = allDemands.filter(d => d.max_price == null || !d.cities?.length);
      const missingBudget = allDemands.filter(d => d.max_price == null).length;
      const missingZone = allDemands.filter(d => !d.cities?.length).length;

      const [
        { count: pendingResponse },
        { count: enriched },
        { count: noResponse },
        { count: nevera },
      ] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['demanda-enrich-pendiente']),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['demanda-enriquecida']),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['demanda-enrich-sin-respuesta']),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['nevera']),
      ]);

      return {
        total_incomplete: incomplete.length,
        missing_budget: missingBudget,
        missing_zone: missingZone,
        pending_response: pendingResponse || 0,
        enriched: enriched || 0,
        no_response: noResponse || 0,
        nevera: nevera || 0,
      };
    },
    refetchInterval: 30000,
  });

  // Active conversations query
  const { data: activeConversations, isLoading: convsLoading } = useQuery({
    queryKey: ['demand-enrich-conversations'],
    queryFn: async (): Promise<ActiveConversation[]> => {
      // Get contacts with pending tag
      const { data: pendingContacts } = await supabase
        .from('contacts')
        .select('id, full_name')
        .contains('tags', ['demanda-enrich-pendiente'])
        .limit(50);

      if (!pendingContacts?.length) return [];

      const conversations: ActiveConversation[] = [];

      for (const contact of pendingContacts) {
        const { data: logs } = await supabase
          .from('communication_logs')
          .select('direction, body_preview, created_at, metadata')
          .eq('contact_id', contact.id)
          .eq('source', 'campaign_demand_enrich')
          .neq('channel', 'system')
          .order('created_at', { ascending: false })
          .limit(20);

        if (!logs?.length) continue;

        const outboundCount = logs.filter(l => l.direction === 'outbound').length;
        const lastLog = logs[0];

        // Get what's still missing from system logs
        const { data: systemLogs } = await supabase
          .from('communication_logs')
          .select('metadata')
          .eq('contact_id', contact.id)
          .eq('source', 'campaign_demand_enrich')
          .eq('channel', 'system')
          .order('created_at', { ascending: false })
          .limit(1);

        const stillMissing = (systemLogs?.[0]?.metadata as any)?.still_missing || [];

        conversations.push({
          contact_id: contact.id,
          contact_name: contact.full_name,
          last_message: lastLog.body_preview || '',
          last_date: lastLog.created_at,
          direction: lastLog.direction,
          turns: outboundCount,
          missing: stillMissing,
        });
      }

      return conversations.sort((a, b) => new Date(b.last_date).getTime() - new Date(a.last_date).getTime());
    },
    refetchInterval: 30000,
  });

  const sendBatch = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('campaign-demand-enrich', {
        body: { batch_size: 200 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Lote enviado: ${data.sent} mensajes`);
      if (data.errors?.length) toast.warning(`${data.errors.length} errores`);
      queryClient.invalidateQueries({ queryKey: ['demand-enrich-stats'] });
      queryClient.invalidateQueries({ queryKey: ['demand-enrich-conversations'] });
    },
    onError: (error: any) => toast.error(`Error: ${error.message}`),
  });

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('campaign-demand-enrich', {
        body: { preview: true },
      });
      if (error) throw error;
      setPreviewData(data);
    } catch (e: any) {
      toast.error(`Error generando preview: ${e.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const pendingSend = (stats?.total_incomplete || 0) - (stats?.pending_response || 0) - (stats?.enriched || 0) - (stats?.no_response || 0) - (stats?.nevera || 0);
  const pendingSendClamped = Math.max(0, pendingSend);

  const statCards = [
    { label: 'Sin presupuesto', value: stats?.missing_budget || 0, icon: Banknote, color: 'text-amber-500' },
    { label: 'Sin zona', value: stats?.missing_zone || 0, icon: MapPin, color: 'text-blue-500' },
    { label: 'Pendientes envío', value: pendingSendClamped, icon: Target, color: 'text-muted-foreground' },
    { label: 'Esperando respuesta', value: stats?.pending_response || 0, icon: Send, color: 'text-indigo-500' },
    { label: 'Enriquecidas', value: stats?.enriched || 0, icon: Target, color: 'text-emerald-500' },
    { label: 'Sin respuesta', value: stats?.no_response || 0, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Nevera ❄️', value: stats?.nevera || 0, icon: Snowflake, color: 'text-cyan-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
              <p className="text-2xl font-bold">{statsLoading ? '—' : stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Enriquecimiento de demandas</CardTitle>
          <CardDescription>
            Envía mensajes personalizados a compradores con demandas incompletas para obtener su presupuesto y zona preferida.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handlePreview} disabled={previewLoading || !pendingSendClamped}>
            {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview mensaje
          </Button>
          <Button
            onClick={() => {
              if (confirm(`¿Enviar lote de hasta 200 mensajes? Quedan ${pendingSendClamped} demandas.`)) {
                sendBatch.mutate();
              }
            }}
            disabled={sendBatch.isPending || !pendingSendClamped}
          >
            {sendBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar lote
          </Button>
          <Button variant="ghost" size="icon" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['demand-enrich-stats'] });
            queryClient.invalidateQueries({ queryKey: ['demand-enrich-conversations'] });
          }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Active Conversations */}
      {(activeConversations?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Conversaciones activas ({activeConversations?.length})
            </CardTitle>
            <CardDescription>
              Hilos de enriquecimiento en curso. Haz clic en un contacto para ver el detalle.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {activeConversations?.map((conv) => (
                <button
                  key={conv.contact_id}
                  onClick={() => navigate(`/contacts/${conv.contact_id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{conv.contact_name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {conv.turns} {conv.turns === 1 ? 'mensaje' : 'mensajes'}
                      </Badge>
                      {conv.missing.map((m) => (
                        <Badge key={m} variant="secondary" className="text-[10px]">
                          {m === 'presupuesto' ? '💰' : '📍'} {m}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {conv.direction === 'inbound' ? '← ' : '→ '}
                      {conv.last_message}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(conv.last_date), "dd MMM HH:mm", { locale: es })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview: {previewData.contact_name}</CardTitle>
            <CardDescription>
              Canal: {previewData.channel} · Falta: {previewData.missing?.budget ? '💰 presupuesto' : ''} {previewData.missing?.zone ? '📍 zona' : ''} · Quedan {previewData.remaining}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewData.channel === 'email' && previewData.message?.html ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Asunto: {previewData.message.subject}</p>
                <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto" dangerouslySetInnerHTML={{ __html: previewData.message.html }} />
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-4 max-w-md">
                <p className="text-sm whitespace-pre-wrap">{previewData.message?.text}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DemandEnrichCampaign;
