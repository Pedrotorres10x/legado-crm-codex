import type { OperationsItem } from "@/hooks/useOperationsFeed";
import {
  countDelegatedToday,
  filterOperationsItems,
  sortOperationsItems,
  summarizeOperationsItems,
} from "@/lib/operations-feed";

function makeItem(overrides: Partial<OperationsItem>): OperationsItem {
  return {
    id: "x",
    kind: "task",
    severity: "media",
    title: "item",
    summary: "summary",
    meta: "meta",
    route: "/tasks",
    routeLabel: "Abrir",
    agentId: null,
    updatedAt: "2026-03-31T10:00:00.000Z",
    ...overrides,
  };
}

describe("operations feed helpers", () => {
  it("sorts by severity, business kind and recency", () => {
    const sorted = sortOperationsItems([
      makeItem({ id: "task-new", kind: "task", severity: "media", updatedAt: "2026-03-31T12:00:00.000Z" }),
      makeItem({ id: "legal-high", kind: "legal", severity: "alta", updatedAt: "2026-03-31T11:00:00.000Z" }),
      makeItem({ id: "closing-high", kind: "closing", severity: "alta", updatedAt: "2026-03-30T11:00:00.000Z" }),
      makeItem({ id: "offer-high", kind: "offer", severity: "alta", updatedAt: "2026-03-31T09:00:00.000Z" }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["closing-high", "offer-high", "legal-high", "task-new"]);
  });

  it("filters items by preset and issue filter", () => {
    const items = [
      makeItem({ id: "urgent-mine", kind: "lead", severity: "alta", agentId: "u1" }),
      makeItem({ id: "urgent-other", kind: "lead", severity: "alta", agentId: "u2" }),
      makeItem({ id: "legal", kind: "legal", severity: "media" }),
      makeItem({ id: "task", kind: "task", severity: "media" }),
    ];

    expect(
      filterOperationsItems({
        items,
        issueFilter: "all",
        activePreset: "my_urgent",
        currentUserId: "u1",
      }).map((item) => item.id),
    ).toEqual(["urgent-mine"]);

    expect(
      filterOperationsItems({
        items,
        issueFilter: "legal",
        activePreset: "all",
      }).map((item) => item.id),
    ).toEqual(["legal"]);
  });

  it("counts summary buckets and delegated tasks for today", () => {
    const now = new Date("2026-03-31T15:00:00.000Z");
    const items = [
      makeItem({ id: "urgent", kind: "offer", severity: "alta" }),
      makeItem({ id: "closing", kind: "closing" }),
      makeItem({ id: "legal", kind: "legal" }),
      makeItem({ id: "followup", kind: "visit" }),
      makeItem({ id: "delegated-today", kind: "task", taskAutomatic: false, createdAt: "2026-03-31T09:00:00.000Z" }),
      makeItem({ id: "delegated-old", kind: "task", taskAutomatic: false, createdAt: "2026-03-30T09:00:00.000Z" }),
    ];

    expect(summarizeOperationsItems(items)).toEqual({
      urgent: 1,
      closing: 1,
      legal: 1,
      commercialFollowup: 4,
    });

    expect(countDelegatedToday(items, now)).toBe(1);
  });
});
