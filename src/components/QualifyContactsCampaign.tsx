import { useState } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Send, Eye, RefreshCw, Users, UserCheck, UserX, HelpCircle, Loader2, Home, Ban } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ReviewItem {
  id: string;
  contact_id: string;
  contact_name: string;
  original_text: string;
  classification: string;
  created_at: string;
}

const QualifyContactsCampaign = () => {
  const queryClient = useQueryClient();
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Fetch stats from edge function
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['qualify-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('campaign-qualify', {
        body: { stats_only: true },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Fetch reassignment log
  const { data: reassignments } = useQuery({
    queryKey: ['qualify-reassignments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('communication_logs')
        .select('id, contact_id, body_preview, metadata, created_at')
        .eq('source', 'campaign_qualify')
        .in('status', ['clasificado', 'revision_manual'])
        .order('created_at', { ascending: false })
        .limit(100);

      return (data || []).map((item: any) => ({
        id: item.id,
        contact_id: item.contact_id,
        contact_name: item.metadata?.contact_name || 'Desconocido',
        original_text: item.metadata?.original_text || item.body_preview || '',
        classification: item.metadata?.classification || (item.status === 'revision_manual' ? 'revision' : '?'),
        created_at: item.created_at,
      }));
    },
    refetchInterval: 30000,
  });

  // Send batch mutation
  const sendBatch = useMutation({
    mutationFn: async (mode: string) => {
      const { data, error } = await supabase.functions.invoke('campaign-qualify', {
        body: { batch_size: 200, mode },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Lote enviado: ${data.sent} mensajes`);
      if (data.errors?.length) toast.warning(`${data.errors.length} errores`);
      queryClient.invalidateQueries({ queryKey: ['qualify-stats'] });
    },
    onError: (error: any) => toast.error(`Error: ${error.message}`),
  });

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('campaign-qualify', {
        body: { preview: true },
      });
      if (error) throw error;
      setPreviewData(data);
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Manual classification
  const manualClassify = async (contactId: string, classification: string, logId: string) => {
    const updateData: any = {};
    const { data: contact } = await supabase
      .from('contacts')
      .select('tags')
      .eq('id', contactId)
      .single();

    const currentTags = ((contact?.tags as string[]) || []).filter(
      (t: string) => t !== 'qualify-pendiente'
    );
    currentTags.push('qualify-done');

    if (classification === 'comprador') {
      updateData.contact_type = 'comprador';
      updateData.pipeline_stage = 'nuevo';
      currentTags.push('qualify-comprador');
    } else if (classification === 'prospecto') {
      updateData.contact_type = 'prospecto';
      updateData.pipeline_stage = 'nuevo';
      currentTags.push('qualify-prospecto');
    } else if (classification === 'inactivo') {
      updateData.pipeline_stage = 'sin_interes';
      updateData.status = 'inactivo';
      currentTags.push('no-contactar');
    }

    updateData.tags = currentTags;
    await supabase.from('contacts').update(updateData).eq('id', contactId);
    await supabase.from('communication_logs').update({
      status: 'clasificado',
      metadata: { classification, manual: true } as any,
    }).eq('id', logId);

    toast.success('Contacto reclasificado manualmente');
    queryClient.invalidateQueries({ queryKey: ['qualify-stats'] });
    queryClient.invalidateQueries({ queryKey: ['qualify-reassignments'] });
  };

  const classificationBadge = (c: string) => {
    const map: Record<string, { label: string; class: string }> = {
      comprador: { label: '🏠 Comprador', class: 'bg-green-100 text-green-800' },
      prospecto: { label: '🔑 Prospecto', class: 'bg-amber-100 text-amber-800' },
      inactivo: { label: '❌ Inactivo', class: 'bg-red-100 text-red-800' },
      ambiguo: { label: '❓ Ambiguo', class: 'bg-orange-100 text-orange-800' },
      revision: { label: '🔍 Revisión', class: 'bg-orange-100 text-orange-800' },
    };
    const info = map[c] || { label: c, class: 'bg-muted text-muted-foreground' };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.class}`}>{info.label}</span>;
  };

  const statCards = [
    { label: 'Pendientes envío', value: stats?.pending_send || 0, icon: Users, color: 'text-muted-foreground' },
    { label: 'Esperando respuesta', value: stats?.pending_response || 0, icon: Send, color: 'text-blue-500' },
    { label: '→ Compradores', value: stats?.converted_comprador || 0, icon: UserCheck, color: 'text-green-500' },
    { label: '→ Prospectos', value: stats?.converted_prospecto || 0, icon: Home, color: 'text-amber-500' },
    { label: 'No contactar', value: stats?.no_contactar || 0, icon: Ban, color: 'text-red-400' },
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
          <CardTitle>Campaña de cualificación</CardTitle>
          <CardDescription>
            Contacta a propietarios y contactos para identificar compradores y prospectos.
            Lotes de hasta 200, con 2s entre cada envío. No se repite a contactos ya procesados.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handlePreview} disabled={previewLoading || !stats?.pending_send}>
            {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Preview
          </Button>
          <Button
            onClick={() => {
              if (confirm(`¿Enviar lote de hasta 200 mensajes? Quedan ${stats?.pending_send || 0} contactos.`)) {
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
              if (confirm('¿Enviar seguimientos a contactos sin respuesta?')) {
                sendBatch.mutate("followup");
              }
            }}
            disabled={sendBatch.isPending || !stats?.pending_response}
          >
            {sendBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Enviar follow-ups
          </Button>
          <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['qualify-stats'] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview: {previewData.contact_name}</CardTitle>
            <CardDescription>
              Tipo: {previewData.contact_type} · Canal: {previewData.channel} · Quedan {previewData.remaining}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewData.channel === 'email' && previewData.message?.html ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Asunto: {previewData.message.subject}</p>
                <div
                  className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewData.message.html) }}
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

      {/* Reassignment Log */}
      {reassignments && reassignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de reasignaciones</CardTitle>
            <CardDescription>{reassignments.length} resultados de la campaña</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reassignments.map((item: ReviewItem) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{item.contact_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{item.original_text}</p>
                    </TableCell>
                    <TableCell>{classificationBadge(item.classification)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {(item.classification === 'ambiguo' || item.classification === 'revision') && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => manualClassify(item.contact_id, 'comprador', item.id)}>
                            Comprador
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => manualClassify(item.contact_id, 'prospecto', item.id)}>
                            Prospecto
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => manualClassify(item.contact_id, 'inactivo', item.id)}>
                            Inactivo
                          </Button>
                        </>
                      )}
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

export default QualifyContactsCampaign;
