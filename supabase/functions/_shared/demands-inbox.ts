export type DemandInboxBaseRow = {
  id: string;
  contact_id: string | null;
};

export type DemandInboxMatchRow = {
  demand_id: string;
};

export type DemandInboxInteractionRow = {
  contact_id: string;
  created_at: string;
};

export function buildDemandMatchCountMap(matches: DemandInboxMatchRow[]) {
  const counts = new Map<string, number>();

  for (const match of matches) {
    counts.set(match.demand_id, (counts.get(match.demand_id) ?? 0) + 1);
  }

  return counts;
}

export function buildContactLastTouchMap(interactions: DemandInboxInteractionRow[]) {
  const lastTouchMap = new Map<string, string>();

  for (const interaction of interactions) {
    if (!lastTouchMap.has(interaction.contact_id)) {
      lastTouchMap.set(interaction.contact_id, interaction.created_at);
    }
  }

  return lastTouchMap;
}

export function enrichDemandsInboxRows<T extends DemandInboxBaseRow>(
  demands: T[],
  matches: DemandInboxMatchRow[],
  interactions: DemandInboxInteractionRow[],
) {
  const matchCountByDemand = buildDemandMatchCountMap(matches);
  const lastTouchByContact = buildContactLastTouchMap(interactions);

  return demands.map((demand) => ({
    ...demand,
    matchCount: matchCountByDemand.get(demand.id) ?? 0,
    lastTouchAt: demand.contact_id ? lastTouchByContact.get(demand.contact_id) ?? null : null,
  }));
}
