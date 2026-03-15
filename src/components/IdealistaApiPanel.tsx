import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Upload, BarChart3, AlertCircle, Link2, Trash2, ShieldCheck, Search } from 'lucide-react';
import { toast } from 'sonner';

interface MappingStats {
  total_send_to_idealista: number;
  total_mapped: number;
  total_synced: number;
  total_error: number;
  total_deactivated: number;
  total_contact_mappings: number;
  pending: number;
}

interface ValidationResult {
  total: number;
  valid: number;
  invalid: number;
  details: { id: string; ref: string; title: string; errors: string[] }[];
}

const IdealistaApiPanel = () => {
  const [stats, setStats] = useState<MappingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [singleRef, setSingleRef] = useState('');
  const [singleAction, setSingleAction] = useState(false);

  const callIdealista = async (action: string, extra?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('idealista-api', {
      body: { action, ...extra },
    });
    if (error) throw error;
    return data;
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await callIdealista('mapping_stats');
      setStats(data);
    } catch (err: any) {
      toast.error('Error al obtener estadísticas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncExisting = async () => {
    setSyncing(true);
    try {
      const data = await callIdealista('sync_existing');
      toast.success(
        `Sincronización completada: ${data.properties_new_mappings} propiedades y ${data.contacts_new_mappings} contactos vinculados`
      );
      fetchStats();
    } catch (err: any) {
      toast.error('Error en sincronización: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handlePublishPending = async () => {
    setPublishing(true);
    try {
      const data = await callIdealista('publish_pending');
      if (data.total === 0) {
        toast.info('No hay inmuebles pendientes de publicar');
      } else {
        toast.success(`Publicados: ${data.ok} ok, ${data.errors} errores de ${data.total}`);
      }
      fetchStats();
    } catch (err: any) {
      toast.error('Error al publicar: ' + err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleValidatePending = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const data = await callIdealista('validate_pending');
      setValidationResult(data);
      if (data.invalid === 0) {
        toast.success(`✅ ${data.valid} inmuebles listos para publicar`);
      } else {
        toast.warning(`${data.valid} válidos, ${data.invalid} con errores`);
      }
    } catch (err: any) {
      toast.error('Error al validar: ' + err.message);
    } finally {
      setValidating(false);
    }
  };

  const resolvePropertyId = async (ref: string): Promise<string | null> => {
    const trimmed = ref.trim();
    if (!trimmed) return null;
    for (const col of ['crm_reference', 'reference', 'id'] as const) {
      const { data } = await supabase
        .from('properties')
        .select('id')
        .eq(col, trimmed)
        .limit(1);
      if (data && data.length > 0) return data[0].id;
    }
    return null;
  };

  const handleSinglePublish = async () => {
    setSingleAction(true);
    try {
      const propertyId = await resolvePropertyId(singleRef);
      if (!propertyId) {
        toast.error('Inmueble no encontrado');
        return;
      }
      const data = await callIdealista('publish_from_crm', { property_id: propertyId });
      toast.success(`${data.action === 'created' ? 'Publicado' : 'Actualizado'} en Idealista: ${singleRef}`);
      fetchStats();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSingleAction(false);
    }
  };

  const handleSingleDelete = async () => {
    setSingleAction(true);
    try {
      const propertyId = await resolvePropertyId(singleRef);
      if (!propertyId) {
        toast.error('Inmueble no encontrado');
        return;
      }
      await callIdealista('delete_from_idealista', { property_id: propertyId });
      toast.success(`Eliminado de Idealista: ${singleRef}`);
      fetchStats();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSingleAction(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)] border-l-4 border-l-orange-500">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Idealista</h3>
              <Badge className="text-xs bg-orange-500/10 text-orange-600 border-0">API REST</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Publicación directa vía API Partners · Control bidireccional
            </p>
          </div>
          <img src="https://st3.idealista.com/static/common/img/brand/idealista-logo.svg" alt="Idealista" className="h-5 opacity-60" />
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-md bg-muted/50">
              <div className="text-lg font-bold">{stats.total_send_to_idealista}</div>
              <div className="text-[10px] text-muted-foreground">Marcados</div>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <div className="text-lg font-bold text-green-600">{stats.total_synced}</div>
              <div className="text-[10px] text-muted-foreground">Publicados</div>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <div className="text-lg font-bold text-orange-600">{stats.pending}</div>
              <div className="text-[10px] text-muted-foreground">Pendientes</div>
            </div>
          </div>
        )}

        {/* Error/deactivated/contact badges */}
        {stats && (stats.total_error > 0 || stats.total_deactivated > 0 || stats.total_contact_mappings > 0) && (
          <div className="flex gap-2 flex-wrap">
            {stats.total_error > 0 && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertCircle className="h-3 w-3" />
                {stats.total_error} con error
              </Badge>
            )}
            {stats.total_deactivated > 0 && (
              <Badge variant="secondary" className="text-xs">
                {stats.total_deactivated} desactivados
              </Badge>
            )}
            {stats.total_contact_mappings > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Link2 className="h-3 w-3" />
                {stats.total_contact_mappings} contactos vinculados
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={syncing}
            onClick={handleSyncExisting}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar existentes'}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={publishing || (stats?.pending === 0)}
            onClick={handlePublishPending}
          >
            <Upload className={`h-3.5 w-3.5 ${publishing ? 'animate-pulse' : ''}`} />
            {publishing ? 'Publicando...' : `Publicar pendientes${stats?.pending ? ` (${stats.pending})` : ''}`}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            disabled={validating}
            onClick={handleValidatePending}
          >
            <ShieldCheck className={`h-3.5 w-3.5 ${validating ? 'animate-spin' : ''}`} />
            {validating ? 'Validando...' : 'Validar campos'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1.5"
            disabled={loading}
            onClick={fetchStats}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>

        {/* Validation results */}
        {validationResult && validationResult.invalid > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            <div className="text-xs font-medium text-destructive">
              {validationResult.invalid} inmuebles con errores:
            </div>
            {validationResult.details.map((d) => (
              <div key={d.id} className="text-[11px] p-2 rounded bg-destructive/5 border border-destructive/20">
                <span className="font-medium">{d.ref || d.id.substring(0, 8)}</span>
                {d.title && <span className="text-muted-foreground"> — {d.title}</span>}
                <ul className="mt-1 space-y-0.5 text-destructive">
                  {d.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Single property actions */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Gestión individual</label>
          <div className="flex gap-1">
            <Input
              placeholder="Ref. CRM o ID"
              value={singleRef}
              onChange={(e) => setSingleRef(e.target.value)}
              className="text-xs h-8"
            />
            <Button
              size="sm"
              className="h-8 text-xs gap-1 shrink-0"
              disabled={singleAction || !singleRef.trim()}
              onClick={handleSinglePublish}
            >
              <Upload className="h-3.5 w-3.5" />
              Publicar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 px-2 shrink-0"
              disabled={singleAction || !singleRef.trim()}
              onClick={handleSingleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IdealistaApiPanel;
