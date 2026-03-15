import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, format } from 'date-fns';
import { aggregatePipelineBuckets } from '@/lib/agent-performance';
import {
  countCaptureInterviews,
  countHorusTouches,
  normalizeHorusWeights,
  sumBuyerVisitPoints,
  sumHorusInteractionPoints,
} from '@/lib/horus-model';

export interface PerformanceData {
  periodMonths: 3 | 6;
  periodLabel: string;
  // Radar axes (% of target)
  toques: number;
  entrevistas: number;
  captaciones: number;
  facturacion: number;
  // Raw counts
  toquesCount: number;
  entrevistasCount: number;
  captacionesCount: number;
  facturacionCount: number;
  availableStockCount: number;
  llamadasCount: number;
  buyerVisitsCount: number;
  // Targets
  toquesTarget: number;
  entrevistasTarget: number;
  captacionesTarget: number;
  facturacionTarget: number;
  // Points
  totalPoints: number;
  averagePoints: number;
  rollingTarget: number;
  quarterlyTarget: number;
  monthlyBreakdown: { month: string; points: number }[];
  // Pipeline
  pipeline: Record<string, number>;
  // Health
  health: { green: number; yellow: number; orange: number; red: number; total: number };
  // Funnel
  funnel: { label: string; count: number }[];
  // Conversion
  conversion: {
    llamadasToCaptacionVisitsRate: number;
    captacionVisitsToExclusiveRate: number;
    exclusivesToArrasRate: number;
    buyerVisitsPerArras: number | null;
  };
  // Point weights
  weights: ReturnType<typeof normalizeHorusWeights>;
}

export function useAgentPerformance(agentId: string | undefined, months: 3 | 6 = 3) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const now = new Date();
    const start = subMonths(now, months); // rolling window, not calendar-aligned
    const startISO = start.toISOString();

    const fetch = async () => {
      let interactionsQuery = supabase
        .from('interactions')
        .select('id, interaction_type, interaction_date, contact_id, property_id')
        .gte('interaction_date', startISO);

      let contactsQuery = supabase
        .from('contacts')
        .select('id, status, pipeline_stage, updated_at, created_at');

      let propertiesQuery = supabase
        .from('properties')
        .select('id, created_at, arras_status, arras_date, status');
      let visitsQuery = supabase
        .from('visits')
        .select('id, contact_id, property_id, visit_date, result, confirmation_status')
        .gte('visit_date', startISO)
        .lte('visit_date', now.toISOString());
      let offersQuery = supabase
        .from('offers')
        .select('contact_id, property_id, created_at')
        .gte('created_at', startISO)
        .lte('created_at', now.toISOString());

      if (agentId) {
        interactionsQuery = interactionsQuery.eq('agent_id', agentId);
        contactsQuery = contactsQuery.eq('agent_id', agentId);
        propertiesQuery = propertiesQuery.eq('agent_id', agentId);
        visitsQuery = visitsQuery.eq('agent_id', agentId);
        offersQuery = offersQuery.eq('agent_id', agentId);
      }

      const [interactionsRes, contactsRes, propertiesRes, visitsRes, offersRes, settingsRes] = await Promise.all([
        interactionsQuery,
        contactsQuery,
        propertiesQuery,
        visitsQuery,
        offersQuery,
        supabase.from('settings').select('value').eq('key', 'point_weights').maybeSingle(),
      ]);

      const weights = normalizeHorusWeights(settingsRes.data?.value);

      const interactions = interactionsRes.data || [];
      const contacts = contactsRes.data || [];
      const properties = propertiesRes.data || [];
      const visits = visitsRes.data || [];
      const offers = offersRes.data || [];

      // Counts
      const llamadasCount = interactions.filter((interaction) => interaction.interaction_type === 'llamada').length;
      const toquesCount = countHorusTouches(interactions as any);
      const entrevistasCount = countCaptureInterviews(interactions as any);
      const captacionesCount = properties.filter((property) => new Date(property.created_at) >= start).length;
      const facturacionCount = properties.filter((property) =>
        property.arras_status === 'firmado' &&
        property.arras_date &&
        new Date(property.arras_date) >= start &&
        new Date(property.arras_date) <= now
      ).length;
      const availableStockCount = properties.filter((property) => property.status === 'disponible').length;
      const buyerVisitsCount = visits.filter((visit) => {
        const result = visit.result || '';
        const confirmation = visit.confirmation_status || '';
        return confirmation === 'confirmado' || (result && !['cancelada', 'no_show'].includes(result));
      }).length;

      // Targets (scaled by months)
      const workingDaysPerMonth = 22;
      const weeksPerMonth = 4;
      const toquesTarget = 4 * workingDaysPerMonth * months;
      const entrevistasTarget = 2 * weeksPerMonth * months;
      const captacionesTarget = Math.round(2 * months);
      const facturacionTarget = Number(((10 / 12) * months).toFixed(1));

      // Radar %
      const pct = (v: number, t: number) => Math.min(Math.round((v / Math.max(t, 1)) * 100), 100);

      // Monthly points breakdown
      const monthlyMap: Record<string, { points: number }> = {};
      for (let m = 0; m < months; m++) {
        const d = subMonths(now, m);
        const key = format(d, 'yyyy-MM');
        monthlyMap[key] = { points: 0 };
      }

      const interactionsByMonth: Record<string, typeof interactions> = {};
      interactions.forEach((interaction) => {
        const key = interaction.interaction_date.slice(0, 7);
        if (!interactionsByMonth[key]) interactionsByMonth[key] = [];
        interactionsByMonth[key].push(interaction);
      });
      Object.entries(interactionsByMonth).forEach(([key, monthInteractions]) => {
        if (monthlyMap[key]) {
          monthlyMap[key].points += sumHorusInteractionPoints(monthInteractions as any, weights);
        }
      });
      const visitsByMonth: Record<string, typeof visits> = {};
      visits.forEach((visit) => {
        const key = visit.visit_date.slice(0, 7);
        if (!visitsByMonth[key]) visitsByMonth[key] = [];
        visitsByMonth[key].push(visit);
      });
      Object.entries(visitsByMonth).forEach(([key, monthVisits]) => {
        if (monthlyMap[key]) {
          monthlyMap[key].points += sumBuyerVisitPoints(monthVisits as any, offers as any, weights, now);
        }
      });
      properties.forEach((property) => {
        if (new Date(property.created_at) >= start) {
          const key = property.created_at.slice(0, 7);
          if (monthlyMap[key]) monthlyMap[key].points += weights.captacion;
        }
        if (
          property.arras_status === 'firmado' &&
          property.arras_date &&
          new Date(property.arras_date) >= start &&
          new Date(property.arras_date) <= now
        ) {
          const key = property.arras_date.slice(0, 7);
          if (monthlyMap[key]) monthlyMap[key].points += weights.facturacion;
        }
      });

      const monthlyBreakdown = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, counts]) => ({
          month,
          points: counts.points,
        }));

      const totalPoints = monthlyBreakdown.reduce((s, m) => s + m.points, 0);
      const rollingTarget = weights.monthly_bonus_target || 500;
      const averagePoints = Math.round(totalPoints / Math.max(months, 1));

      // Pipeline
      const pipeline = aggregatePipelineBuckets(contacts);

      // Contact health based on recency of work on the contact
      const activeContacts = contacts.filter(c => ['nuevo', 'en_seguimiento', 'activo'].includes(c.status));
      const healthCounts = { green: 0, yellow: 0, orange: 0, red: 0, total: activeContacts.length };
      const nowMs = now.getTime();
      activeContacts.forEach(c => {
        const days = Math.floor((nowMs - new Date(c.updated_at).getTime()) / 86400000);
        if (days <= 90) healthCounts.green++;
        else if (days <= 120) healthCounts.yellow++;
        else if (days <= 180) healthCounts.orange++;
        else healthCounts.red++;
      });

      // Funnel
      const funnel = [
        { label: 'Toques', count: toquesCount },
        { label: '1ª Entrevista', count: entrevistasCount },
        { label: 'Mandato', count: captacionesCount },
        { label: 'Arras firmadas', count: facturacionCount },
      ];

      const safeRate = (numerator: number, denominator: number) =>
        denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;

      setData({
        periodMonths: months,
        periodLabel: `Últimos ${months} meses`,
        toques: pct(toquesCount, toquesTarget),
        entrevistas: pct(entrevistasCount, entrevistasTarget),
        captaciones: pct(captacionesCount, captacionesTarget),
        facturacion: pct(facturacionCount, facturacionTarget),
        toquesCount, entrevistasCount, captacionesCount, facturacionCount, availableStockCount, llamadasCount, buyerVisitsCount,
        toquesTarget, entrevistasTarget, captacionesTarget, facturacionTarget,
        totalPoints,
        averagePoints,
        rollingTarget,
        quarterlyTarget: rollingTarget * months,
        monthlyBreakdown,
        pipeline,
        health: healthCounts,
        funnel,
        conversion: {
          llamadasToCaptacionVisitsRate: safeRate(entrevistasCount, llamadasCount),
          captacionVisitsToExclusiveRate: safeRate(captacionesCount, entrevistasCount),
          exclusivesToArrasRate: safeRate(facturacionCount, captacionesCount),
          buyerVisitsPerArras: facturacionCount > 0 ? Number((buyerVisitsCount / facturacionCount).toFixed(1)) : null,
        },
        weights,
      });
      setLoading(false);
    };

    fetch();
  }, [agentId, months]);

  return { data, loading };
}
