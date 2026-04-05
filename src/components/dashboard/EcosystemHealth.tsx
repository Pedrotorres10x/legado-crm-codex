import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HeartPulse, Building2, Users, Clock, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import type { LucideIcon } from 'lucide-react';

const STALE_DAYS = 30;
const NO_LEAD_DAYS = 21;
const UNTOUCH_DAYS = 14;

type TrafficColor = 'green' | 'yellow' | 'red';
type PropertyHealthRow = { id: string; title: string; created_at: string; updated_at: string };
type MatchActivityRow = { property_id: string; created_at: string };
type VisitActivityRow = { property_id: string; created_at: string };
type ContactHealthRow = { id: string; full_name: string; created_at: string };
type InteractionActivityRow = { contact_id: string; interaction_date: string };

const getTrafficColor = (problemCount: number, total: number): TrafficColor => {
  if (total === 0) return 'green';
  const pct = problemCount / total;
  if (pct <= 0.1) return 'green';
  if (pct <= 0.3) return 'yellow';
  return 'red';
};

const trafficStyles: Record<TrafficColor, { bg: string; ring: string; glow: string; label: string }> = {
  green: { bg: 'bg-emerald-500', ring: 'ring-emerald-400/50', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.5)]', label: 'Sano' },
  yellow: { bg: 'bg-amber-400', ring: 'ring-amber-300/50', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.5)]', label: 'Atención' },
  red: { bg: 'bg-red-500', ring: 'ring-red-400/50', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.5)]', label: 'Crítico' },
};

const TrafficLight = ({ color, label, count, total, icon: Icon }: { color: TrafficColor; label: string; count: number; total: number; icon: LucideIcon }) => {
  const s = trafficStyles[color];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`h-12 w-12 rounded-full ${s.bg} ${s.glow} ring-4 ${s.ring} transition-all duration-500`} />
      <span className={`text-xs font-semibold ${color === 'green' ? 'text-emerald-600' : color === 'yellow' ? 'text-amber-600' : 'text-red-600'}`}>
        {s.label}
      </span>
      <span className="text-[11px] text-muted-foreground">{count} / {total} con problemas</span>
    </div>
  );
};

interface HealthDetail {
  staleProperties: { id: string; title: string; daysSinceActivity: number }[];
  noLeadProperties: { id: string; title: string; daysListed: number }[];
  untouchedContacts: { id: string; full_name: string; daysSinceTouch: number }[];
  totalProperties: number;
  totalContacts: number;
  propColor: TrafficColor;
  contactColor: TrafficColor;
}

const EcosystemHealth = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<HealthDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const userId = user?.id;

  const fetchHealth = useCallback(async () => {
    if (!userId) return;
    const uid = userId;
    const now = new Date();

    const { data: properties } = await supabase
      .from('properties')
      .select('id, title, created_at, updated_at')
      .eq('agent_id', uid)
      .eq('status', 'disponible');

    const propList = (properties ?? []) as PropertyHealthRow[];
    const propIds = propList.map(p => p.id);

    const latestMatchByProp: Record<string, string> = {};
    const latestVisitByProp: Record<string, string> = {};

    if (propIds.length > 0) {
      const [matchesRes, visitsRes] = await Promise.all([
        supabase.from('matches').select('property_id, created_at').in('property_id', propIds).order('created_at', { ascending: false }),
        supabase.from('visits').select('property_id, created_at').in('property_id', propIds).order('created_at', { ascending: false }),
      ]);
      ((matchesRes.data ?? []) as MatchActivityRow[]).forEach((m) => {
        if (!latestMatchByProp[m.property_id]) latestMatchByProp[m.property_id] = m.created_at;
      });
      ((visitsRes.data ?? []) as VisitActivityRow[]).forEach((v) => {
        if (!latestVisitByProp[v.property_id]) latestVisitByProp[v.property_id] = v.created_at;
      });
    }

    const staleProperties = propList
      .map(p => {
        const lm = latestMatchByProp[p.id] ? new Date(latestMatchByProp[p.id]) : null;
        const lv = latestVisitByProp[p.id] ? new Date(latestVisitByProp[p.id]) : null;
        const last = lm && lv ? (lm > lv ? lm : lv) : lm || lv || new Date(p.created_at);
        return { id: p.id, title: p.title, daysSinceActivity: differenceInDays(now, last) };
      })
      .filter(p => p.daysSinceActivity >= STALE_DAYS)
      .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

    const noLeadProperties = propList
      .filter(p => !latestMatchByProp[p.id])
      .map(p => ({ id: p.id, title: p.title, daysListed: differenceInDays(now, new Date(p.created_at)) }))
      .filter(p => p.daysListed >= NO_LEAD_DAYS)
      .sort((a, b) => b.daysListed - a.daysListed);

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, full_name, created_at')
      .eq('agent_id', uid)
      .in('status', ['nuevo', 'en_seguimiento', 'activo']);

    const contactList = (contacts ?? []) as ContactHealthRow[];
    const contactIds = contactList.map(c => c.id);

    const latestInterByContact: Record<string, string> = {};
    if (contactIds.length > 0) {
      const { data: interactions } = await supabase
        .from('interactions')
        .select('contact_id, interaction_date')
        .in('contact_id', contactIds)
        .order('interaction_date', { ascending: false });
      ((interactions ?? []) as InteractionActivityRow[]).forEach((i) => {
        if (!latestInterByContact[i.contact_id]) latestInterByContact[i.contact_id] = i.interaction_date;
      });
    }

    const untouchedContacts = contactList
      .map(c => {
        const last = latestInterByContact[c.id] ? new Date(latestInterByContact[c.id]) : new Date(c.created_at);
        return { id: c.id, full_name: c.full_name, daysSinceTouch: differenceInDays(now, last) };
      })
      .filter(c => c.daysSinceTouch >= UNTOUCH_DAYS)
      .sort((a, b) => b.daysSinceTouch - a.daysSinceTouch);

    // Unique problem properties (union of stale + noLead)
    const problemPropIds = new Set([...staleProperties.map(p => p.id), ...noLeadProperties.map(p => p.id)]);
    const propColor = getTrafficColor(problemPropIds.size, propList.length);
    const contactColor = getTrafficColor(untouchedContacts.length, contactList.length);

    setData({ staleProperties, noLeadProperties, untouchedContacts, totalProperties: propList.length, totalContacts: contactList.length, propColor, contactColor });
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  if (loading || !data) return null;

  const { staleProperties, noLeadProperties, untouchedContacts, totalProperties, totalContacts, propColor, contactColor } = data;
  const totalIssues = staleProperties.length + noLeadProperties.length + untouchedContacts.length;
  const problemPropIds = new Set([...staleProperties.map(p => p.id), ...noLeadProperties.map(p => p.id)]);

  return (
    <Card className="animate-fade-in-up border-0 shadow-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            Semáforo del Ecosistema
          </span>
          {totalIssues > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
              {expanded ? 'Ocultar' : 'Ver detalle'}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Traffic lights */}
        <div className="flex items-center justify-center gap-12 py-4">
          <TrafficLight color={propColor} label="Inmuebles" count={problemPropIds.size} total={totalProperties} icon={Building2} />
          <TrafficLight color={contactColor} label="Contactos" count={untouchedContacts.length} total={totalContacts} icon={Users} />
        </div>

        {/* Detail lists (expandable) */}
        {expanded && totalIssues > 0 && (
          <div className="space-y-3 pt-2 border-t">
            {staleProperties.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <Clock className="h-4 w-4" />
                  {staleProperties.length} inmueble{staleProperties.length > 1 ? 's' : ''} sin actividad (+{STALE_DAYS}d)
                </div>
                {staleProperties.slice(0, 5).map(p => (
                  <button key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="flex items-center justify-between w-full text-xs px-2 py-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-left">
                    <span className="truncate max-w-[220px]">{p.title}</span>
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 shrink-0 ml-2">{p.daysSinceActivity}d</Badge>
                  </button>
                ))}
                {staleProperties.length > 5 && <p className="text-xs text-muted-foreground pl-2">+{staleProperties.length - 5} más</p>}
              </div>
            )}

            {noLeadProperties.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                  <TrendingDown className="h-4 w-4" />
                  {noLeadProperties.length} inmueble{noLeadProperties.length > 1 ? 's' : ''} sin leads (+{NO_LEAD_DAYS}d)
                </div>
                {noLeadProperties.slice(0, 5).map(p => (
                  <button key={p.id} onClick={() => navigate(`/properties/${p.id}`)} className="flex items-center justify-between w-full text-xs px-2 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-left">
                    <span className="truncate max-w-[220px]">{p.title}</span>
                    <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 shrink-0 ml-2">{p.daysListed}d</Badge>
                  </button>
                ))}
                {noLeadProperties.length > 5 && <p className="text-xs text-muted-foreground pl-2">+{noLeadProperties.length - 5} más</p>}
              </div>
            )}

            {untouchedContacts.length > 0 && (
              <div className="rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-400">
                  <Users className="h-4 w-4" />
                  {untouchedContacts.length} contacto{untouchedContacts.length > 1 ? 's' : ''} sin tocar (+{UNTOUCH_DAYS}d)
                </div>
                {untouchedContacts.slice(0, 5).map(c => (
                  <button key={c.id} onClick={() => navigate(`/contacts/${c.id}`)} className="flex items-center justify-between w-full text-xs px-2 py-1.5 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors text-left">
                    <span className="truncate max-w-[220px]">{c.full_name}</span>
                    <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300 shrink-0 ml-2">{c.daysSinceTouch}d</Badge>
                  </button>
                ))}
                {untouchedContacts.length > 5 && <p className="text-xs text-muted-foreground pl-2">+{untouchedContacts.length - 5} más</p>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EcosystemHealth;
