export const COMMISSION_TIERS = [
  { label: 'Tramo 1 (7,5%)', limit: 32500, from: 0, pct: 7.5 },
  { label: 'Tramo 2 (20%)', limit: 47500, from: 32500, pct: 20 },
  { label: 'Tramo 3 (35%)', limit: null, from: 47500, pct: 35 },
] as const;

export const getSemesterRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month < 6) {
    return { start: new Date(year, 0, 1), end: new Date(year, 5, 30, 23, 59, 59), label: `Ene - Jun ${year}` };
  }
  return { start: new Date(year, 6, 1), end: new Date(year, 11, 31, 23, 59, 59), label: `Jul - Dic ${year}` };
};

export const getAgentTier = (accumulated: number) => {
  if (accumulated > 47500) return { pct: 35, tier: 3, label: 'Tramo 3', next: null, remaining: 0 };
  if (accumulated > 32500) return { pct: 20, tier: 2, label: 'Tramo 2', next: 47500, remaining: 47500 - accumulated };
  return { pct: 7.5, tier: 1, label: 'Tramo 1', next: 32500, remaining: 32500 - accumulated };
};

export const getNextTierLabel = (next: number | null) => {
  if (!next) return null;
  if (next === 32500) return 'Tramo 2 (20%)';
  if (next === 47500) return 'Tramo 3 (35%)';
  return 'Siguiente tramo';
};

/**
 * Calculate the agent's progressive base percentage for a NEW agency commission,
 * given their previous accumulated agency commission in the semester.
 * 
 * The tiers are NOT retroactive: each euro is taxed at the tier rate it falls into.
 * 
 * Tiers (política 2025):
 *   0 - 32,500 → 7.5%
 *   32,501 - 47,500 → 20%
 *   > 47,500 → 35%
 */
export const calcProgressiveAgentAmount = (prevAccumulated: number, newAgencyCommission: number, horusBonus: boolean, horusPct: number) => {
  const tiers = [
    { limit: 32500, pct: 7.5 },
    { limit: 47500, pct: 20 },
    { limit: Infinity, pct: 35 },
  ];

  let remaining = newAgencyCommission;
  let cursor = prevAccumulated;
  let agentBase = 0;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    if (cursor >= tier.limit) continue;

    const spaceInTier = tier.limit - cursor;
    const amountInTier = Math.min(remaining, spaceInTier);
    agentBase += amountInTier * (tier.pct / 100);
    cursor += amountInTier;
    remaining -= amountInTier;
  }

  const bonusAmount = horusBonus ? newAgencyCommission * (horusPct / 100) : 0;
  const agentTotal = agentBase + bonusAmount;

  // Effective blended percentage for display
  const effectivePct = newAgencyCommission > 0 ? (agentBase / newAgencyCommission) * 100 : 0;

  return { agentBase, bonusAmount, agentTotal, effectivePct };
};

export const getQuarterRange = (date = new Date()) => {
  const year = date.getFullYear();
  const q = Math.floor(date.getMonth() / 3);
  const labels = ['Ene - Mar', 'Abr - Jun', 'Jul - Sep', 'Oct - Dic'];
  return {
    start: new Date(year, q * 3, 1),
    end: new Date(year, (q + 1) * 3, 0, 23, 59, 59),
    label: `${labels[q]} ${year}`,
    quarter: q + 1,
  };
};

export const AGENT_MONTHLY_COST = 2000;

export const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
