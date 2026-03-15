import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export type TrafficColor = 'green' | 'yellow' | 'orange' | 'red';

export interface HealthInfo {
  color: TrafficColor;
  label: string;
  reason: string;
}

const PROP_GREEN_DAYS = 14;
const PROP_YELLOW_DAYS = 30;
const NO_LEAD_GREEN_DAYS = 14;
const NO_LEAD_DAYS = 21;

const CONTACT_ACTIVE_DAYS = 90;
const CONTACT_UVI_DAYS = 120;
const CONTACT_COOLING_DAYS = 180;

export function usePropertyHealthColors(properties: { id: string; created_at: string; status: string }[]): Record<string, HealthInfo> {
  const [result, setResult] = useState<Record<string, HealthInfo>>({});

  const availableProps = properties.filter(p => p.status === 'disponible');
  const ids = availableProps.map(p => p.id);
  const idsKey = ids.join(',');

  useEffect(() => {
    if (ids.length === 0) { setResult({}); return; }

    const fetch = async () => {
      const [matchesRes, visitsRes] = await Promise.all([
        supabase.from('matches').select('property_id, created_at').in('property_id', ids).order('created_at', { ascending: false }),
        supabase.from('visits').select('property_id, created_at').in('property_id', ids).order('created_at', { ascending: false }),
      ]);

      const latestMatch: Record<string, string> = {};
      const latestVisit: Record<string, string> = {};
      const hasMatch: Set<string> = new Set();

      (matchesRes.data || []).forEach(m => {
        hasMatch.add(m.property_id);
        if (!latestMatch[m.property_id]) latestMatch[m.property_id] = m.created_at;
      });
      (visitsRes.data || []).forEach(v => {
        if (!latestVisit[v.property_id]) latestVisit[v.property_id] = v.created_at;
      });

      const now = new Date();
      const map: Record<string, HealthInfo> = {};

      for (const p of availableProps) {
        const lm = latestMatch[p.id] ? new Date(latestMatch[p.id]) : null;
        const lv = latestVisit[p.id] ? new Date(latestVisit[p.id]) : null;
        const lastActivity = lm && lv ? (lm > lv ? lm : lv) : lm || lv;
        const daysSinceCreated = differenceInDays(now, new Date(p.created_at));
        const daysSinceActivity = lastActivity ? differenceInDays(now, lastActivity) : null;

        // Check no-lead scenario
        if (!hasMatch.has(p.id)) {
          if (daysSinceCreated < NO_LEAD_GREEN_DAYS) {
            map[p.id] = { color: 'green', label: 'Activo', reason: `Publicado hace ${daysSinceCreated}d` };
          } else if (daysSinceCreated < NO_LEAD_DAYS) {
            map[p.id] = { color: 'yellow', label: 'UVI', reason: `Sin leads · ${daysSinceCreated}d publicado` };
          } else {
            map[p.id] = { color: 'red', label: 'Muerto', reason: `Sin leads desde hace ${daysSinceCreated}d` };
          }
          continue;
        }

        // Has leads - check activity
        if (daysSinceActivity !== null) {
          if (daysSinceActivity < PROP_GREEN_DAYS) {
            map[p.id] = { color: 'green', label: 'Activo', reason: `Activo · última actividad ${daysSinceActivity}d` };
          } else if (daysSinceActivity < PROP_YELLOW_DAYS) {
            map[p.id] = { color: 'yellow', label: 'UVI', reason: `Sin actividad ${daysSinceActivity}d` };
          } else {
            map[p.id] = { color: 'red', label: 'Muerto', reason: `Sin actividad ${daysSinceActivity}d` };
          }
        } else {
          // Has match but no date? fallback to created_at
          if (daysSinceCreated < PROP_GREEN_DAYS) {
            map[p.id] = { color: 'green', label: 'Activo', reason: `Reciente · ${daysSinceCreated}d` };
          } else {
            map[p.id] = { color: 'yellow', label: 'UVI', reason: `Revisar actividad` };
          }
        }
      }

      setResult(map);
    };

    fetch();
  }, [idsKey]);

  return result;
}

export function useContactHealthColors(contacts: { id: string; created_at: string; status: string }[]): Record<string, HealthInfo> {
  const [result, setResult] = useState<Record<string, HealthInfo>>({});

  const activeContacts = contacts.filter(c => ['nuevo', 'en_seguimiento', 'activo'].includes(c.status));
  const ids = activeContacts.map(c => c.id);
  const idsKey = ids.join(',');

  useEffect(() => {
    if (ids.length === 0) { setResult({}); return; }

    const fetch = async () => {
      const { data: interactions } = await supabase
        .from('interactions')
        .select('contact_id, interaction_date')
        .in('contact_id', ids)
        .order('interaction_date', { ascending: false });

      const latestInter: Record<string, string> = {};
      (interactions || []).forEach(i => {
        if (!latestInter[i.contact_id]) latestInter[i.contact_id] = i.interaction_date;
      });

      const now = new Date();
      const map: Record<string, HealthInfo> = {};

      for (const c of activeContacts) {
        const last = latestInter[c.id] ? new Date(latestInter[c.id]) : new Date(c.created_at);
        const days = differenceInDays(now, last);

        if (days <= CONTACT_ACTIVE_DAYS) {
          map[c.id] = { color: 'green', label: 'Activo', reason: `Trabajado hace ${days}d · dentro de la cadencia sana de 4 toques/año` };
        } else if (days <= CONTACT_UVI_DAYS) {
          map[c.id] = { color: 'yellow', label: 'UVI', reason: `Sin contacto ${days}d · ya has salido de la cadencia sana y conviene tocarlo` };
        } else if (days <= CONTACT_COOLING_DAYS) {
          map[c.id] = { color: 'orange', label: 'Enfriado', reason: `Sin contacto ${days}d · la relación se enfría y pide reactivación seria` };
        } else {
          map[c.id] = { color: 'red', label: 'Muerto', reason: `Sin contacto ${days}d · contacto prácticamente perdido` };
        }
      }

      setResult(map);
    };

    fetch();
  }, [idsKey]);

  return result;
}
