import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Trash2, RefreshCw, User, Building2, FileText, Download, Eye,
  ArrowRightLeft, UserPlus, Home, DollarSign, Calendar, Image,
  ScrollText, Search, ChevronDown
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface TimelineEvent {
  id: string;
  source: 'audit' | 'media' | 'notification';
  icon: typeof User;
  color: string;
  title: string;
  description: string;
  user_name: string;
  timestamp: string;
  entity_type?: string;
  entity_id?: string;
}

const AuditTimeline = () => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch profiles first
    const { data: profs } = await supabase.from('profiles').select('user_id, full_name');
    const nameMap: Record<string, string> = {};
    (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
    setProfiles(nameMap);

    // Fetch agents list
    const { data: roles } = await supabase.from('user_roles').select('user_id');
    const agentList = (roles || []).map((r: any) => ({
      id: r.user_id,
      name: nameMap[r.user_id] || r.user_id.slice(0, 8),
    }));
    setAgents(agentList.filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i));

    // Parallel fetch all sources
    const [auditRes, mediaRes] = await Promise.all([
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('media_access_logs').select('*').order('created_at', { ascending: false }).limit(300),
    ]);

    const timeline: TimelineEvent[] = [];

    // Audit log entries
    for (const e of (auditRes.data || []) as any[]) {
      const fieldLabels: Record<string, string> = {
        status: 'Estado', agent_id: 'Agente', owner_id: 'Propietario',
        contact_type: 'Tipo contacto', pipeline_stage: 'Etapa pipeline',
      };
      const resolveVal = (field: string | null, val: string | null) => {
        if (!val || val === 'null') return '—';
        if (field === 'agent_id' || field === 'owner_id') return nameMap[val] || val.slice(0, 8);
        return val;
      };

      if (e.action === 'delete') {
        const name = e.record_snapshot?.title || e.record_snapshot?.full_name || e.record_id.slice(0, 8);
        timeline.push({
          id: e.id,
          source: 'audit',
          icon: Trash2,
          color: 'text-destructive',
          title: `Eliminado: ${name}`,
          description: `${e.table_name === 'properties' ? 'Inmueble' : 'Contacto'} eliminado permanentemente`,
          user_name: nameMap[e.user_id] || 'Sistema',
          timestamp: e.created_at,
          entity_type: e.table_name === 'properties' ? 'property' : 'contact',
          entity_id: e.record_id,
        });
      } else {
        const fieldLabel = fieldLabels[e.field_name || ''] || e.field_name;
        timeline.push({
          id: e.id,
          source: 'audit',
          icon: ArrowRightLeft,
          color: 'text-amber-500',
          title: `${e.table_name === 'properties' ? 'Inmueble' : 'Contacto'}: ${fieldLabel}`,
          description: `${resolveVal(e.field_name, e.old_value)} → ${resolveVal(e.field_name, e.new_value)}`,
          user_name: nameMap[e.user_id] || 'Sistema',
          timestamp: e.created_at,
          entity_type: e.table_name === 'properties' ? 'property' : 'contact',
          entity_id: e.record_id,
        });
      }
    }

    // Media access logs
    for (const m of (mediaRes.data || []) as any[]) {
      const isDoc = m.action.startsWith('doc_');
      const docName = isDoc ? m.action.replace('doc_download:', '').replace(/^\d+_/, '') : null;
      timeline.push({
        id: m.id,
        source: 'media',
        icon: isDoc ? Download : Image,
        color: isDoc ? 'text-blue-500' : 'text-cyan-500',
        title: isDoc ? `Descarga: ${docName}` : `Acceso galería`,
        description: isDoc ? 'Documento descargado' : m.action,
        user_name: nameMap[m.user_id] || 'Usuario',
        timestamp: m.created_at,
        entity_type: 'property',
        entity_id: m.property_id,
      });
    }

    // Sort all by timestamp descending
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEvents(timeline);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = events.filter(e => {
    if (filterSource !== 'all' && e.source !== filterSource) return false;
    if (filterAgent !== 'all' && !e.user_name.toLowerCase().includes(agents.find(a => a.id === filterAgent)?.name.toLowerCase() || '')) return false;
    if (searchTerm && !e.title.toLowerCase().includes(searchTerm.toLowerCase()) && !e.description.toLowerCase().includes(searchTerm.toLowerCase()) && !e.user_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const visible = filtered.slice(0, visibleCount);

  // Stats
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEvents = events.filter(e => new Date(e.timestamp) >= todayStart);
  const deletions = events.filter(e => e.source === 'audit' && e.icon === Trash2);
  const docAccesses = events.filter(e => e.source === 'media' && e.icon === Download);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Acciones hoy', value: todayEvents.length, icon: Calendar, color: 'text-primary' },
          { label: 'Total registros', value: events.length, icon: ScrollText, color: 'text-muted-foreground' },
          { label: 'Eliminaciones', value: deletions.length, icon: Trash2, color: 'text-destructive' },
          { label: 'Descargas docs', value: docAccesses.length, icon: Download, color: 'text-blue-500' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en timeline..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Origen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los orígenes</SelectItem>
            <SelectItem value="audit">Cambios y eliminaciones</SelectItem>
            <SelectItem value="media">Acceso a media/docs</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="Agente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los agentes</SelectItem>
            {agents.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-9" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} eventos</span>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No hay eventos de auditoría</p>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />

            {visible.map((e, i) => {
              const Icon = e.icon;
              const isNewDay = i === 0 || format(new Date(e.timestamp), 'yyyy-MM-dd') !== format(new Date(visible[i - 1].timestamp), 'yyyy-MM-dd');
              return (
                <div key={e.id}>
                  {isNewDay && (
                    <div className="relative -ml-8 mb-3 mt-4 first:mt-0">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(e.timestamp), "EEEE, d 'de' MMMM yyyy", { locale: es })}
                      </div>
                    </div>
                  )}
                  <div className="relative flex items-start gap-3 pb-4">
                    {/* Dot on timeline */}
                    <div className={`absolute -left-8 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-background ${
                      e.source === 'audit' && e.icon === Trash2 ? 'bg-destructive' : 'bg-primary'
                    }`}>
                      <div className="h-2 w-2 rounded-full bg-background" />
                    </div>

                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      e.source === 'audit' && e.icon === Trash2 ? 'bg-destructive/10' : 'bg-muted'
                    }`}>
                      <Icon className={`h-4 w-4 ${e.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{e.title}</span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {e.source === 'audit' ? 'Auditoría' : 'Acceso'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">{e.user_name}</span>
                        {' · '}
                        {formatDistanceToNow(new Date(e.timestamp), { addSuffix: true, locale: es })}
                        {' · '}
                        {format(new Date(e.timestamp), 'HH:mm', { locale: es })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length > visibleCount && (
              <div className="text-center py-4">
                <Button variant="outline" size="sm" onClick={() => setVisibleCount(v => v + 50)}>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Cargar más ({filtered.length - visibleCount} restantes)
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default AuditTimeline;
