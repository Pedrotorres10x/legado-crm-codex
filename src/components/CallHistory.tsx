import { useEffect, useState } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, Loader2, ChevronRight, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CallRecord {
  id: string;
  interaction_date: string;
  subject: string | null;
  description: string | null;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  agent_id: string | null;
  agent_name?: string;
}

interface AgentOption {
  id: string;
  name: string;
}

const getDirection = (description: string | null): 'entrante' | 'saliente' | null => {
  if (!description) return null;
  if (description.includes('Dirección: Entrante')) return 'entrante';
  if (description.includes('Dirección: Saliente')) return 'saliente';
  return null;
};

const getResult = (subject: string | null) => subject || 'Conectada';

const resultColor = (result: string) => {
  if (result.toLowerCase().includes('no contesta') || result.toLowerCase().includes('ocupado')) return 'text-destructive';
  if (result.toLowerCase().includes('buzón')) return 'text-muted-foreground';
  return 'text-primary';
};

const DirectionIcon = ({ dir }: { dir: 'entrante' | 'saliente' | null }) => {
  if (dir === 'entrante') return <PhoneIncoming className="h-4 w-4 text-blue-500" />;
  if (dir === 'saliente') return <PhoneOutgoing className="h-4 w-4 text-primary" />;
  return <Phone className="h-4 w-4 text-muted-foreground" />;
};

const CallHistory = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [myCalls, setMyCalls] = useState<CallRecord[]>([]);
  const [agentCalls, setAgentCalls] = useState<CallRecord[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [canViewAll, setCanViewAll] = useState(false);

  // Check role
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data: isAdm } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      const { data: isCoord } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'coordinadora' });
      setCanViewAll(!!isAdm || !!isCoord);
    };
    check();
  }, [user]);

  // Load my calls
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      // My calls
      const { data: myData } = await supabase
        .from('interactions')
        .select('id, interaction_date, subject, description, contact_id, agent_id, contacts(full_name, phone)')
        .eq('interaction_type', 'llamada')
        .eq('agent_id', user.id)
        .order('interaction_date', { ascending: false })
        .limit(50);

      if (myData) {
        setMyCalls(myData.map((r: any) => ({
          id: r.id,
          interaction_date: r.interaction_date,
          subject: r.subject,
          description: r.description,
          contact_id: r.contact_id,
          agent_id: r.agent_id,
          contact_name: r.contacts?.full_name || 'Desconocido',
          contact_phone: r.contacts?.phone || '',
        })));
      }

      setLoading(false);
    };
    load();
  }, [user]);

  // Load agents list (for admin/coord)
  useEffect(() => {
    if (!canViewAll) return;
    const loadAgents = async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').order('full_name');
      if (data) {
        setAgents(data.map(p => ({ id: p.user_id, name: p.full_name })));
      }
    };
    loadAgents();
  }, [canViewAll]);

  // Load agent-specific calls
  useEffect(() => {
    if (!canViewAll || selectedAgent === 'all') {
      // Load all agents' calls
      if (!canViewAll) return;
      const loadAll = async () => {
        setLoadingAgent(true);
        const { data } = await supabase
          .from('interactions')
          .select('id, interaction_date, subject, description, contact_id, agent_id, contacts(full_name, phone)')
          .eq('interaction_type', 'llamada')
          .not('agent_id', 'is', null)
          .order('interaction_date', { ascending: false })
          .limit(100);

        if (data) {
          setAgentCalls(data.map((r: any) => ({
            id: r.id,
            interaction_date: r.interaction_date,
            subject: r.subject,
            description: r.description,
            contact_id: r.contact_id,
            agent_id: r.agent_id,
            contact_name: r.contacts?.full_name || 'Desconocido',
            contact_phone: r.contacts?.phone || '',
          })));
        }
        setLoadingAgent(false);
      };
      loadAll();
      return;
    }

    const loadFiltered = async () => {
      setLoadingAgent(true);
      const { data } = await supabase
        .from('interactions')
        .select('id, interaction_date, subject, description, contact_id, agent_id, contacts(full_name, phone)')
        .eq('interaction_type', 'llamada')
        .eq('agent_id', selectedAgent)
        .order('interaction_date', { ascending: false })
        .limit(100);

      if (data) {
        setAgentCalls(data.map((r: any) => ({
          id: r.id,
          interaction_date: r.interaction_date,
          subject: r.subject,
          description: r.description,
          contact_id: r.contact_id,
          agent_id: r.agent_id,
          contact_name: r.contacts?.full_name || 'Desconocido',
          contact_phone: r.contacts?.phone || '',
        })));
      }
      setLoadingAgent(false);
    };
    loadFiltered();
  }, [canViewAll, selectedAgent]);

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return null;
    return agents.find(a => a.id === agentId)?.name || null;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="mine" className="space-y-3">
      <TabsList className="w-full">
        <TabsTrigger value="mine" className="flex-1 gap-1.5">
          <Phone className="h-3.5 w-3.5" /> Mis llamadas
        </TabsTrigger>
        {canViewAll && (
          <TabsTrigger value="agents" className="flex-1 gap-1.5">
            <Users className="h-3.5 w-3.5" /> Por agente
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="mine">
        <CallList calls={myCalls} navigate={navigate} />
      </TabsContent>

      {canViewAll && (
        <TabsContent value="agents" className="space-y-3">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos los agentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los agentes</SelectItem>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loadingAgent ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CallList calls={agentCalls} navigate={navigate} showAgent agentMap={agents} />
          )}
        </TabsContent>
      )}
    </Tabs>
  );
};

/* ─── Reusable call list ─── */
function CallList({
  calls,
  navigate,
  showAgent = false,
  agentMap = [],
}: {
  calls: CallRecord[];
  navigate: (path: string) => void;
  showAgent?: boolean;
  agentMap?: AgentOption[];
}) {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Phone className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No hay llamadas registradas</p>
      </div>
    );
  }

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return 'Sin asignar';
    return agentMap.find(a => a.id === agentId)?.name || 'Agente';
  };

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
      {calls.map(call => {
        const dir = getDirection(call.description);
        const result = getResult(call.subject);
        return (
          <button
            key={call.id}
            onClick={() => call.contact_id && navigate(`/contacts/${call.contact_id}`)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/40 transition-colors text-left"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <DirectionIcon dir={dir} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{call.contact_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn("text-xs font-medium", resultColor(result))}>{result}</span>
                {call.contact_phone && (
                  <span className="text-xs text-muted-foreground">· {call.contact_phone}</span>
                )}
              </div>
              {showAgent && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">{getAgentName(call.agent_id)}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(call.interaction_date), { addSuffix: true, locale: es })}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default CallHistory;
