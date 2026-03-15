import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';
import { normalizeHorusWeights, sumBuyerVisitPoints, sumHorusInteractionPoints } from '@/lib/horus-model';

export interface HorusStatus {
  horusActive: boolean;
  points: number;
  target: number;
  periodLabel: string;
  loading: boolean;
}

export function useAgentHorusStatus(agentId: string | undefined): HorusStatus {
  const [status, setStatus] = useState<HorusStatus>({
    horusActive: false, points: 0, target: 500, periodLabel: '', loading: true,
  });

  useEffect(() => {
    if (!agentId) { setStatus(s => ({ ...s, loading: false })); return; }

    const now = new Date();
    const start = subMonths(now, 3);
    const startISO = start.toISOString();
    const endISO = now.toISOString();

    const fetch = async () => {
      const [interactionsRes, propertiesRes, visitsRes, offersRes, settingsRes] = await Promise.all([
        supabase.from('interactions').select('id, interaction_type, contact_id, property_id').eq('agent_id', agentId)
          .gte('interaction_date', startISO).lte('interaction_date', endISO),
        supabase.from('properties').select('created_at, arras_status, arras_date').eq('agent_id', agentId),
        supabase.from('visits').select('id, contact_id, property_id, visit_date, result, confirmation_status').eq('agent_id', agentId)
          .gte('visit_date', startISO).lte('visit_date', endISO),
        supabase.from('offers').select('contact_id, property_id, created_at').eq('agent_id', agentId)
          .gte('created_at', startISO).lte('created_at', endISO),
        supabase.from('settings').select('value').eq('key', 'point_weights').maybeSingle(),
      ]);

      const w = normalizeHorusWeights(settingsRes.data?.value);

      const interactions = interactionsRes.data || [];
      const properties = propertiesRes.data || [];
      const visits = visitsRes.data || [];
      const offers = offersRes.data || [];

      const monthKeys = Array.from({ length: 3 }).map((_, index) => format(subMonths(now, index), 'yyyy-MM'));
      const monthlyPoints = new Map(monthKeys.map((key) => [key, 0]));

      for (const key of monthKeys) {
        const monthInteractions = interactions.filter((interaction: any) => interaction.interaction_date?.slice(0, 7) === key);
        const monthVisits = visits.filter((visit: any) => visit.visit_date?.slice(0, 7) === key);
        const monthCaptaciones = properties.filter((property: any) => property.created_at?.slice(0, 7) === key).length;
        const monthFacturaciones = properties.filter((property: any) =>
          property.arras_status === 'firmado' &&
          property.arras_date &&
          property.arras_date.slice(0, 7) === key
        ).length;

        const pointsForMonth =
          sumHorusInteractionPoints(monthInteractions as any, w) +
          sumBuyerVisitPoints(monthVisits as any, offers as any, w, now) +
          monthCaptaciones * w.captacion +
          monthFacturaciones * w.facturacion;

        monthlyPoints.set(key, pointsForMonth);
      }

      const totalPoints = Array.from(monthlyPoints.values()).reduce((sum, value) => sum + value, 0);
      const averagePoints = Math.round(totalPoints / 3);
      const target = w.monthly_bonus_target || 500;

      setStatus({
        horusActive: averagePoints >= target,
        points: averagePoints,
        target,
        periodLabel: 'Promedio ultimos 3 meses',
        loading: false,
      });
    };

    fetch();
  }, [agentId]);

  return status;
}
