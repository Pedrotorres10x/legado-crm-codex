import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { List, Loader2, RefreshCw, Timer, Trash2, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { FOTOCASA_FN, fetchWithTimeout, resolvePropertyId, type FotocasaSyncResult } from './portal-feed-shared';

function hasAuthorizationDenied(results: Array<{ message?: string }> | undefined): boolean {
  return (results || []).some((item) => (item.message || '').toLowerCase().includes('authorization has been denied'));
}

function getFotocasaErrorMessage(data: unknown): string {
  const payload = (data || {}) as {
    error?: string;
    message?: string;
    results?: Array<{ message?: string }>;
  };

  if (payload.error === 'Unauthorized') {
    return 'Llamada no autorizada a la pasarela de Fotocasa';
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (hasAuthorizationDenied(payload.results)) {
    return 'Fotocasa ha rechazado la credencial API';
  }

  return 'Error al sincronizar con Fotocasa';
}

export function FotocasaApiCard() {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<FotocasaSyncResult | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [bulkSyncState, setBulkSyncState] = useState<{ status: string; sync_run_id?: string | null } | null>(null);
  const [singleRef, setSingleRef] = useState('');
  const [syncProgress, setSyncProgress] = useState<{ offset: number; total: number; succeeded: number; failed: number } | null>(null);
  const [activeSyncRunId, setActiveSyncRunId] = useState<string | null>(null);
  const stagnantPollsRef = useRef(0);
  const lastProcessedRef = useRef<number | null>(null);

  const fetchBulkSyncState = async () => {
    const { data } = await supabase
      .from('portal_sync_state')
      .select('status, metadata')
      .eq('sync_key', 'fotocasa_bulk_sync')
      .maybeSingle();

    const metadata = (data?.metadata || {}) as { sync_run_id?: string | null };
    setBulkSyncState({
      status: data?.status || 'idle',
      sync_run_id: typeof metadata.sync_run_id === 'string' ? metadata.sync_run_id : null,
    });
  };

  useEffect(() => {
    supabase
      .from('erp_sync_logs')
      .select('created_at')
      .eq('target', 'fotocasa')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setLastSync(data[0].created_at);
      });

    supabase
      .from('erp_sync_logs')
      .select('payload')
      .eq('target', 'fotocasa')
      .eq('event', 'sync_batch_summary')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!data?.[0]?.payload) return;
        const payload = data[0].payload as Record<string, unknown>;
        setLastResult({
          ok: true,
          action: 'sync_all',
          total: Number(payload.batch_size ?? 0),
          succeeded: Number(payload.succeeded ?? 0),
          failed: Number(payload.failed ?? 0),
          has_more: payload.has_more === true,
          total_available: Number(payload.total_available ?? 0),
          sync_run_id: typeof payload.sync_run_id === 'string' ? payload.sync_run_id : undefined,
        });
      });

    void fetchBulkSyncState();
  }, []);

  useEffect(() => {
    if (!syncing) {
      setSyncProgress(null);
      stagnantPollsRef.current = 0;
      lastProcessedRef.current = null;
      setActiveSyncRunId(null);
      return;
    }

    const poll = async () => {
      const query = supabase
        .from('erp_sync_logs')
        .select('payload')
        .eq('target', 'fotocasa')
        .eq('event', 'sync_batch_summary')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data } = activeSyncRunId
        ? await query.contains('payload', { sync_run_id: activeSyncRunId })
        : await query;

      const matchingRow = data?.find((row) => {
        if (!activeSyncRunId) return true;
        const payload = row.payload as Record<string, unknown>;
        return payload.sync_run_id === activeSyncRunId;
      });

      if (matchingRow?.payload) {
        const payload = matchingRow.payload as Record<string, unknown>;
        const offset = Number(payload.offset ?? 0);
        const total = Number(payload.total_available ?? 0);
        const hasMore = payload.has_more === true;
        const processed = offset + Number(payload.succeeded ?? 0) + Number(payload.failed ?? 0);
        const succeeded = Number(payload.succeeded ?? 0);
        const failed = Number(payload.failed ?? 0);

        if (lastProcessedRef.current === processed) stagnantPollsRef.current += 1;
        else {
          stagnantPollsRef.current = 0;
          lastProcessedRef.current = processed;
        }

        setSyncProgress({ offset: processed, total, succeeded: processed - failed, failed });
        setLastResult({
          ok: failed === 0,
          action: 'sync_all',
          total: Number(payload.batch_size ?? 0),
          succeeded: offset + succeeded,
          failed,
          has_more: hasMore,
          total_available: total,
          sync_run_id: typeof payload.sync_run_id === 'string' ? payload.sync_run_id : undefined,
        });

        if (!hasMore) {
          setSyncing(false);
          void fetchBulkSyncState();
          toast.success(`Fotocasa: sincronización completa (${total} inmuebles)`);
          return;
        }

        if (stagnantPollsRef.current >= 6) {
          setSyncing(false);
          void fetchBulkSyncState();
          toast.warning('Fotocasa sigue procesando en segundo plano. Revisa de nuevo en 1-2 minutos.');
        }
      }
    };

    const interval = setInterval(poll, 5000);
    poll();
    return () => clearInterval(interval);
  }, [activeSyncRunId, syncing]);

  const callFotocasa = async (action: string) => {
    setSyncing(true);
    setSyncProgress(null);
    try {
      const response = await fetchWithTimeout(
        FOTOCASA_FN,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        },
        45000,
      );
      const data = await response.json();

      if (!response.ok) {
        toast.error(getFotocasaErrorMessage(data));
        setSyncing(false);
        return;
      }

      if (action === 'sync_all') {
        setLastResult(data);
        setActiveSyncRunId(typeof data.sync_run_id === 'string' ? data.sync_run_id : null);
        setBulkSyncState({
          status: data.has_more ? 'running' : 'idle',
          sync_run_id: typeof data.sync_run_id === 'string' ? data.sync_run_id : null,
        });
        if (data.has_more) toast.success(`Fotocasa: lote ${data.succeeded}/${data.total_available} enviado, sincronizando el resto automáticamente…`);
        else if (data.succeeded > 0) {
          toast.success(`Fotocasa: ${data.succeeded} sincronizados, ${data.failed} errores`);
          setSyncing(false);
          void fetchBulkSyncState();
        } else if (hasAuthorizationDenied(data.results)) {
          toast.error('Fotocasa ha rechazado la credencial API');
          setSyncing(false);
          void fetchBulkSyncState();
        } else if (data.failed > 0) {
          toast.error(`Fotocasa: ${data.failed} errores de ${data.total}`);
          setSyncing(false);
          void fetchBulkSyncState();
        } else {
          toast.info('Fotocasa: sin inmuebles para sincronizar');
          setSyncing(false);
          void fetchBulkSyncState();
        }
        setLastSync(new Date().toISOString());
      } else {
        const ads = Array.isArray(data.ads) ? data.ads : [];
        toast.info(`Fotocasa: ${ads.length} anuncios publicados`);
        setSyncing(false);
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.message === 'timeout';
      if (timedOut && action === 'sync_all') {
        toast.info('Petición larga: Fotocasa sigue en segundo plano, monitorizando progreso…');
        return;
      }
      toast.error('Error al conectar con Fotocasa');
      setSyncing(false);
    }
  };

  const isBackendStillRunning =
    bulkSyncState?.status === 'running' &&
    !!lastResult?.sync_run_id &&
    bulkSyncState.sync_run_id === lastResult.sync_run_id;

  const handleSingleAction = async (action: 'sync_one' | 'delete') => {
    setSyncing(true);
    try {
      const propertyId = await resolvePropertyId(singleRef);
      if (!propertyId) {
        toast.error('Inmueble no encontrado con esa referencia o ID');
        return;
      }
      const response = await fetch(FOTOCASA_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, property_id: propertyId }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(getFotocasaErrorMessage(data));
      } else if (data.ok || data.success) {
        toast.success(action === 'delete' ? `Eliminado de Fotocasa: ${singleRef}` : `Enviado a Fotocasa: ${singleRef}`);
      } else {
        toast.error(`Error Fotocasa: ${getFotocasaErrorMessage(data)}`);
      }
    } catch {
      toast.error('Error al conectar con Fotocasa');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)] border-l-4 border-l-primary">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Fotocasa</h3>
              <Badge className="text-xs bg-primary/10 text-primary border-0">API REST</Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              <span>Cada 12h + tiempo real</span>
            </div>
            <p className="text-xs text-muted-foreground">Sincronización directa vía API · Push en tiempo real</p>
          </div>
          <Zap className="h-5 w-5 text-primary" />
        </div>

        <div className="text-xs text-muted-foreground">
          {lastSync ? <>Última sincronización: {formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: es })}</> : 'Sin sincronizaciones aún'}
        </div>

        {syncing && syncProgress && syncProgress.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Sincronizando…</span>
              <span>{syncProgress.offset} / {syncProgress.total}</span>
            </div>
            <Progress value={(syncProgress.offset / syncProgress.total) * 100} className="h-2" />
          </div>
        )}

        {!syncing && lastResult && (
          <div className="flex gap-2 text-xs">
            <Badge variant="secondary">{lastResult.total_available ?? lastResult.total} inmuebles</Badge>
            <Badge variant={isBackendStillRunning ? 'outline' : 'default'}>
              {isBackendStillRunning ? 'En progreso' : `${lastResult.succeeded} ok`}
            </Badge>
            {lastResult.failed > 0 && <Badge variant="destructive">{lastResult.failed} errores</Badge>}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" className="h-8 text-xs gap-1.5" disabled={syncing} onClick={() => callFotocasa('sync_all')}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar todo
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={syncing} onClick={() => callFotocasa('list_ads')}>
            <List className="h-3.5 w-3.5" />
            Ver anuncios
          </Button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Prueba individual</label>
          <div className="flex gap-1">
            <Input placeholder="Ref. o ID del inmueble" value={singleRef} onChange={(event) => setSingleRef(event.target.value)} className="text-xs h-8" />
            <Button size="sm" className="h-8 text-xs gap-1 shrink-0" disabled={syncing || !singleRef.trim()} onClick={() => handleSingleAction('sync_one')}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Enviar 1
            </Button>
            <Button variant="destructive" size="sm" className="h-8 px-2 shrink-0" disabled={syncing || !singleRef.trim()} onClick={() => handleSingleAction('delete')}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
