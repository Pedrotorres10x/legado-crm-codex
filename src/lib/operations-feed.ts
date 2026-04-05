import type { OperationsItem } from "@/hooks/useOperationsFeed";

export type OperationsPreset = "all" | "my_urgent" | "legal" | "closing" | "delegated_today";

const severityWeight: Record<OperationsItem["severity"], number> = {
  alta: 0,
  media: 1,
};

const kindWeight: Record<OperationsItem["kind"], number> = {
  closing: 0,
  signature: 1,
  deed: 2,
  offer: 3,
  visit: 4,
  lead: 5,
  legal: 6,
  task: 7,
  postsale: 8,
  stock: 9,
};

export function sortOperationsItems(items: OperationsItem[]) {
  return [...items].sort((left, right) => {
    const severityDiff = severityWeight[left.severity] - severityWeight[right.severity];
    if (severityDiff !== 0) return severityDiff;

    const kindDiff = kindWeight[left.kind] - kindWeight[right.kind];
    if (kindDiff !== 0) return kindDiff;

    return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  });
}

export function filterOperationsItems(params: {
  items: OperationsItem[];
  issueFilter: "all" | OperationsItem["kind"];
  activePreset: OperationsPreset;
  currentUserId?: string;
  now?: Date;
}) {
  const { items, issueFilter, activePreset, currentUserId, now = new Date() } = params;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return items.filter((item) => {
    if (issueFilter !== "all" && item.kind !== issueFilter) return false;

    if (activePreset === "all") return true;
    if (activePreset === "my_urgent") {
      return item.severity === "alta" && (!currentUserId || item.agentId === currentUserId);
    }
    if (activePreset === "legal") {
      return item.kind === "legal";
    }
    if (activePreset === "closing") {
      return ["closing", "signature", "deed", "postsale", "visit", "offer", "lead"].includes(item.kind);
    }
    if (activePreset === "delegated_today") {
      return item.kind === "task" && !item.taskAutomatic && !!item.createdAt && new Date(item.createdAt).getTime() >= startOfToday;
    }

    return true;
  });
}

export function summarizeOperationsItems(items: OperationsItem[]) {
  return {
    urgent: items.filter((item) => item.severity === "alta").length,
    closing: items.filter((item) => ["closing", "signature", "deed", "postsale"].includes(item.kind)).length,
    legal: items.filter((item) => item.kind === "legal").length,
    commercialFollowup: items.filter((item) => ["task", "visit", "offer", "lead"].includes(item.kind)).length,
  };
}

export function countDelegatedToday(items: OperationsItem[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return items.filter(
    (item) => item.kind === "task" && !item.taskAutomatic && !!item.createdAt && new Date(item.createdAt).getTime() >= startOfToday,
  ).length;
}
