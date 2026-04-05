import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Send, Eye, RefreshCw, Users, UserCheck, UserX, HelpCircle, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface CampaignStats {
  total_unclassified: number;
  pending_send: number;
  sent_pending_response: number;
  classified_comprador: number;
  classified_prospecto: number;
  classified_inactivo: number;
  needs_review: number;
}

interface ReviewItem {
  id: string;
  contact_id: string;
  contact_name: string;
  original_text: string;
  created_at: string;
}

interface CampaignPreviewData {
  contact_name: string;
  channel: string;
  remaining: number;
  message?: {
    html?: string;
    text?: string;
    subject?: string;
  };
}

interface CampaignBatchResponse {
  sent?: number;
  errors?: unknown[];
}

type CommunicationLogRow = Database["public"]["Tables"]["communication_logs"]["Row"];
type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];
type CommunicationLogUpdate = Database["public"]["Tables"]["communication_logs"]["Update"];
type CommunicationLogMetadata = Record<string, Database["public"]["Tables"]["communication_logs"]["Row"]["metadata"] | string | boolean | null>;

const ClassificationCampaign = () => {
  const queryClient = useQueryClient();
  const [previewData, setPreviewData] = useState<CampaignPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const classificationMetadata = (classification: string) =>
    ({ classification } as Record<string, string>);

  // Fetch campaign statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['campaign-stats'],
    queryFn: async (): Promise<CampaignStats> => {
      const [
        { count: totalUnclassified },
        { count: pendingSend },
        { count: sentPending },
        { count: comprador },
        { count: prospecto },
        { count: inactivo },
        { count: needsReview },
      ] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('contact_type', 'contacto'),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .eq('contact_type', 'contacto')
          .not('tags', 'cs', '{clasificacion-pendiente}')
          .not('tags', 'cs', '{clasificado-campana}'),
        supabase.from('contacts').select('id', { count: 'exact', head: true })
          .contains('tags', ['clasificacion-pendiente']),
        supabase.from('communication_logs').select('id', { count: 'exact', head: true })
          .eq('source', 'campaign_classify')
          .eq('status', 'clasificado')
          .contains('metadata', classificationMetadata('comprador')),
        supabase.from('communication_logs').select('id', { count: 'exact', head: true })
          .eq('source', 'campaign_classify')
          .eq('status', 'clasificado')
          .contains('metadata', classificationMetadata('prospecto')),
        supabase.from('communication_logs').select('id', { count: 'exact', head: true })
          .eq('source', 'campaign_classify')
          .eq('status', 'clasificado')
          .contains('metadata', classificationMetadata('inactivo')),
        supabase.from('communication_logs').select('id', { count: 'exact', head: true })
          .eq('source', 'campaign_classify')
          .eq('status', 'revision_manual'),
      ]);

      return {
        total_unclassified: totalUnclassified || 0,
        pending_send: pendingSend || 0,
        sent_pending_response: sentPending || 0,
        classified_comprador: comprador || 0,
        classified_prospecto: prospecto || 0,
        classified_inactivo: inactivo || 0,
        needs_review: needsReview || 0,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch items needing review
  const { data: reviewItems } = useQuery({
    queryKey: ['campaign-review'],
    queryFn: async (): Promise<ReviewItem[]> => {
      const { data } = await supabase
        .from('communication_logs')
        .select('id, contact_id, body_preview, metadata, created_at')
        .eq('source', 'campaign_classify')
        .eq('status', 'revision_manual')
        .order('created_at', { ascending: false })
        .limit(50);

      return (data || []).map((item: CommunicationLogRow) => ({
        id: item.id,
        contact_id: item.contact_id,
        contact_name: typeof item.metadata === 'object' && item.metadata && 'contact_name' in item.metadata && typeof item.metadata.contact_name === 'string'
          ? item.metadata.contact_name
          : 'Desconocido',
        original_text: typeof item.metadata === 'object' && item.metadata && 'original_text' in item.metadata && typeof item.metadata.original_text === 'string'
          ? item.metadata.original_text
          : item.body_preview || '',
        created_at: item.created_at,
      }));
    },
  });

  // Send batch mutation
  const sendBatch = useMutation({
    mutationFn: async (mode: string = "initial"): Promise<CampaignBatchResponse> => {
      const { data, error } = await supabase.functions.invoke('campaign-classify', {
        body: { batch_size: 50, mode },
      });
      if (error) throw error;
      return (data as CampaignBatchResponse | null) ?? {};
    },
    onSuccess: (data) => {
      toast.success(`Lote enviado: ${data.sent} mensajes`);
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} errores en el lote`);
      }
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error enviando lote: ${message}`);
    },
  });

  // Preview mutation
  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('campaign-classify', {
        body: { preview: true },
      });
      if (error) throw error;
      setPreviewData((data as CampaignPreviewData | null) ?? null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error desconocido';
      toast.error(`Error generando preview: ${message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Manual classify
  const manualClassify = async (contactId: string, classification: string, logId: string) => {
    const updateData: ContactUpdate = {};
    if (classification === 'comprador') {
      updateData.contact_type = 'comprador';
      updateData.pipeline_stage = 'nuevo';
    } else if (classification === 'prospecto') {
      updateData.contact_type = 'prospecto';
      updateData.pipeline_stage = 'nuevo';
    } else if (classification === 'inactivo') {
      updateData.pipeline_stage = 'sin_interes';
      updateData.status = 'inactivo';
    }

    await supabase.from('contacts').update(updateData).eq('id', contactId);
    const metadata: CommunicationLogMetadata = { classification, manual: true };
    const logUpdate: CommunicationLogUpdate = { status: 'clasificado', metadata };
    await supabase.from('communication_logs').update(logUpdate).eq('id', logId);
    toast.success('Contacto clasificado manualmente');
    queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
    queryClient.invalidateQueries({ queryKey: ['campaign-review'] });
  };

  const statCards = [
    { label: 'Pendientes de envío', value: stats?.pending_send || 0, icon: Users, color: 'text-muted-foreground' },
    { label: 'Esperando respuesta', value: stats?.sent_pending_response || 0, icon: Send, color: 'text-blue-500' },
    { label: 'Compradores', value: stats?.classified_comprador || 0, icon: UserCheck, color: 'text-green-500' },
    { label: 'Prospectos', value: stats?.classified_prospecto || 0, icon: UserCheck, color: 'text-amber-500' },
    { label: 'Inactivos', value: stats?.classified_inactivo || 0, icon: UserX, color: 'text-red-400' },
    { label: 'Revisión manual', value: stats?.needs_review || 0, icon: HelpCircle, color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
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
          <CardTitle>Envío de campaña</CardTitle>
          <CardDescription>
            Envía mensajes personalizados por IA a contactos sin clasificar. Cada lote procesa hasta 50 contactos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={previewLoading || !stats?.pending_send}
          >
            {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview mensaje
          </Button>
          <Button
            onClick={() => {
              if (confirm(`¿Enviar siguiente lote de hasta 50 mensajes iniciales? Quedan ${stats?.pending_send || 0} contactos.`)) {
                sendBatch.mutate("initial");
              }
            }}
            disabled={sendBatch.isPending || !stats?.pending_send}
          >
            {sendBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar lote inicial
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm(`¿Enviar seguimientos a contactos que no han respondido?`)) {
                sendBatch.mutate("followup");
              }
            }}
            disabled={sendBatch.isPending || !stats?.sent_pending_response}
          >
            {sendBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Enviar follow-ups
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['campaign-stats'] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview: {previewData.contact_name}</CardTitle>
            <CardDescription>Canal: {previewData.channel} · Quedan {previewData.remaining} contactos</CardDescription>
          </CardHeader>
          <CardContent>
            {previewData.channel === 'email' && previewData.message?.html ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Asunto: {previewData.message.subject}</p>
                <div
                  className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: previewData.message.html }}
                />
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-4 max-w-md">
                <p className="text-sm whitespace-pre-wrap">{previewData.message?.text}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Review Table */}
      {reviewItems && reviewItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Respuestas pendientes de revisión</CardTitle>
            <CardDescription>{reviewItems.length} respuestas necesitan clasificación manual</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Respuesta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{item.contact_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{item.original_text}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => manualClassify(item.contact_id, 'comprador', item.id)}>
                        Comprador
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => manualClassify(item.contact_id, 'prospecto', item.id)}>
                        Prospecto
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => manualClassify(item.contact_id, 'inactivo', item.id)}>
                        Inactivo
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClassificationCampaign;
