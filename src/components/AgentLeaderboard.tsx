import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getSemesterRange, fmt } from '@/lib/commissions';
import { Trophy, Medal, Crown, Flame, Star } from 'lucide-react';
import { startOfMonth, startOfYear } from 'date-fns';

interface AgentRank {
  user_id: string;
  full_name: string;
  total: number;
  ops: number;
}

const MEDALS = [
  { icon: Crown, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', label: '🥇' },
  { icon: Medal, color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/40', label: '🥈' },
  { icon: Medal, color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/30', label: '🥉' },
];

const AgentLeaderboard = () => {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<{ month: AgentRank[]; semester: AgentRank[]; year: AgentRank[] }>({
    month: [], semester: [], year: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRankings = async () => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const semester = getSemesterRange();
      const yearStart = startOfYear(now).toISOString();

      const [profilesRes, monthRes, semesterRes, yearRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name'),
        supabase.from('commissions').select('agent_id, listing_origin_agent_id, listing_field_agent_id, buying_origin_agent_id, buying_field_agent_id, listing_origin_amount, listing_field_amount, buying_origin_amount, buying_field_amount, agent_total')
          .in('status', ['aprobado', 'pagado']).gte('created_at', monthStart),
        supabase.from('commissions').select('agent_id, listing_origin_agent_id, listing_field_agent_id, buying_origin_agent_id, buying_field_agent_id, listing_origin_amount, listing_field_amount, buying_origin_amount, buying_field_amount, agent_total')
          .in('status', ['aprobado', 'pagado']).gte('created_at', semester.start.toISOString()),
        supabase.from('commissions').select('agent_id, listing_origin_agent_id, listing_field_agent_id, buying_origin_agent_id, buying_field_agent_id, listing_origin_amount, listing_field_amount, buying_origin_amount, buying_field_amount, agent_total')
          .in('status', ['aprobado', 'pagado']).gte('created_at', yearStart),
      ]);

      const profiles = profilesRes.data || [];
      const nameMap = new Map(profiles.map(p => [p.user_id, p.full_name]));

      const aggregate = (comms: any[]): AgentRank[] => {
        const map = new Map<string, { total: number; ops: number }>();
        for (const c of comms) {
          const roles = [
            { id: c.listing_origin_agent_id, amt: c.listing_origin_amount },
            { id: c.listing_field_agent_id, amt: c.listing_field_amount },
            { id: c.buying_origin_agent_id, amt: c.buying_origin_amount },
            { id: c.buying_field_agent_id, amt: c.buying_field_amount },
          ];
          const seen = new Set<string>();
          for (const { id, amt } of roles) {
            if (!id || !amt) continue;
            const prev = map.get(id) || { total: 0, ops: 0 };
            prev.total += amt;
            if (!seen.has(id)) { prev.ops += 1; seen.add(id); }
            map.set(id, prev);
          }
        }
        return Array.from(map.entries())
          .map(([uid, data]) => ({ user_id: uid, full_name: nameMap.get(uid) || 'Asesor', ...data }))
          .sort((a, b) => b.total - a.total);
      };

      setRankings({
        month: aggregate(monthRes.data || []),
        semester: aggregate(semesterRes.data || []),
        year: aggregate(yearRes.data || []),
      });
      setLoading(false);
    };
    fetchRankings();
  }, []);

  const RankList = ({ data, periodLabel }: { data: AgentRank[]; periodLabel: string }) => {
    if (data.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-6">Sin datos para este periodo</p>;
    }

    const myRank = data.findIndex(r => r.user_id === user?.id);
    const winner = data[0];

    return (
      <div className="space-y-3">
        {/* Winner spotlight */}
        {winner && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 p-4 text-center">
            <div className="absolute -top-4 -right-4 opacity-10">
              <Trophy className="h-24 w-24 text-amber-500" />
            </div>
            <Crown className="h-8 w-8 text-amber-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              🏆 Asesor {periodLabel}
            </p>
            <p className="text-lg font-bold mt-1">
              {winner.user_id === user?.id ? '¡Tú!' : winner.full_name}
            </p>
            {winner.user_id === user?.id && (
              <p className="text-sm font-semibold text-amber-600 mt-0.5">{fmt(winner.total)}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {winner.ops} operacion{winner.ops !== 1 ? 'es' : ''}
            </p>
          </div>
        )}

        {/* Ranking list */}
        <div className="space-y-1">
          {data.map((agent, i) => {
            const isMe = agent.user_id === user?.id;
            const medal = MEDALS[i];

            return (
              <div
                key={agent.user_id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  isMe ? 'bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-muted/50'
                }`}
              >
                {/* Position */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  medal ? `${medal.bg} ${medal.color}` : 'bg-muted text-muted-foreground'
                }`}>
                  {i < 3 ? MEDALS[i].label : i + 1}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isMe ? 'text-primary' : ''}`}>
                    {isMe ? `${agent.full_name} (Tú)` : agent.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {agent.ops} op{agent.ops !== 1 ? 's' : ''}.
                    {isMe && i === 0 && <span className="ml-1">🔥</span>}
                  </p>
                </div>

                {/* Amount — only visible for self */}
                {isMe ? (
                  <span className="text-sm font-bold text-primary">{fmt(agent.total)}</span>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    #{i + 1}
                  </Badge>
                )}

                {/* Streak icon for top 3 */}
                {i < 3 && isMe && (
                  <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>

        {/* My position if not in top visible */}
        {myRank >= 0 && (
          <div className="text-center pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Tu posición: <span className="font-bold text-foreground">#{myRank + 1}</span> de {data.length}
              {myRank === 0 && <span className="ml-1">🏆 ¡Eres el líder!</span>}
              {myRank > 0 && myRank <= 2 && <span className="ml-1">⭐ ¡Estás en el podio!</span>}
            </p>
          </div>
        )}
        {myRank < 0 && (
          <div className="text-center pt-2 border-t">
            <p className="text-xs text-muted-foreground">Aún no tienes comisiones en este periodo — ¡a por ello! 💪</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) return null;

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-display">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <Trophy className="h-4 w-4" />
          </div>
          Ranking de Asesores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="month">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="month" className="text-xs">🗓️ Mes</TabsTrigger>
            <TabsTrigger value="semester" className="text-xs">📊 Semestre</TabsTrigger>
            <TabsTrigger value="year" className="text-xs">🏆 Año</TabsTrigger>
          </TabsList>
          <TabsContent value="month" className="mt-4">
            <RankList data={rankings.month} periodLabel="del Mes" />
          </TabsContent>
          <TabsContent value="semester" className="mt-4">
            <RankList data={rankings.semester} periodLabel="del Semestre" />
          </TabsContent>
          <TabsContent value="year" className="mt-4">
            <RankList data={rankings.year} periodLabel="del Año" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AgentLeaderboard;
