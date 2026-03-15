import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, RefreshCw, User, Building2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  record_snapshot: any;
  user_id: string | null;
  created_at: string;
}

const fieldLabels: Record<string, string> = {
  status: 'Estado',
  agent_id: 'Agente asignado',
  owner_id: 'Propietario',
  contact_type: 'Tipo contacto',
  pipeline_stage: 'Etapa pipeline',
};

const tableLabels: Record<string, string> = {
  properties: 'Inmueble',
  contacts: 'Contacto',
};

const AuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [filterTable, setFilterTable] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setEntries((data as any[]) || []);

      // Fetch profiles for user names
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name');
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      setProfiles(map);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = entries.filter(e => {
    if (filterTable !== 'all' && e.table_name !== filterTable) return false;
    if (filterAction !== 'all' && e.action !== filterAction) return false;
    return true;
  });

  const getIcon = (tableName: string) => {
    if (tableName === 'properties') return <Building2 className="h-3.5 w-3.5" />;
    if (tableName === 'contacts') return <User className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  };

  const resolveValue = (field: string | null, value: string | null) => {
    if (!value || value === 'null') return '—';
    if (field === 'agent_id' || field === 'owner_id') return profiles[value] || value.slice(0, 8);
    return value;
  };

  const getDeletedName = (e: AuditEntry) => {
    if (!e.record_snapshot) return e.record_id.slice(0, 8);
    return e.record_snapshot.title || e.record_snapshot.full_name || e.record_id.slice(0, 8);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Tabla" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las tablas</SelectItem>
            <SelectItem value="properties">Inmuebles</SelectItem>
            <SelectItem value="contacts">Contactos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Acción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="update">Cambios</SelectItem>
            <SelectItem value="delete">Eliminaciones</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} registros</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No hay registros de auditoría</p>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {filtered.map(e => (
              <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card text-sm">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  e.action === 'delete' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                }`}>
                  {e.action === 'delete' ? <Trash2 className="h-3.5 w-3.5" /> : getIcon(e.table_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{tableLabels[e.table_name] || e.table_name}</Badge>
                    {e.action === 'delete' ? (
                      <span className="font-medium text-destructive">
                        Eliminado: <span className="font-semibold">{getDeletedName(e)}</span>
                      </span>
                    ) : (
                      <span>
                        <span className="text-muted-foreground">{fieldLabels[e.field_name || ''] || e.field_name}:</span>{' '}
                        <span className="line-through text-muted-foreground">{resolveValue(e.field_name, e.old_value)}</span>
                        {' → '}
                        <span className="font-semibold">{resolveValue(e.field_name, e.new_value)}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.user_id ? (profiles[e.user_id] || 'Usuario') : 'Sistema'}
                    {' · '}
                    {format(new Date(e.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default AuditLog;
