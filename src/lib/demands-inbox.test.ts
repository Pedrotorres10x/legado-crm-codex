import {
  buildContactLastTouchMap,
  buildDemandMatchCountMap,
  enrichDemandsInboxRows,
} from "../../supabase/functions/_shared/demands-inbox";

describe("demands inbox helpers", () => {
  it("counts matches by demand id", () => {
    const counts = buildDemandMatchCountMap([
      { demand_id: "d1" },
      { demand_id: "d1" },
      { demand_id: "d2" },
    ]);

    expect(counts.get("d1")).toBe(2);
    expect(counts.get("d2")).toBe(1);
    expect(counts.get("d3")).toBeUndefined();
  });

  it("keeps the latest interaction per contact when rows are sorted desc", () => {
    const lastTouchMap = buildContactLastTouchMap([
      { contact_id: "c1", created_at: "2026-03-31T10:00:00.000Z" },
      { contact_id: "c1", created_at: "2026-03-30T10:00:00.000Z" },
      { contact_id: "c2", created_at: "2026-03-29T10:00:00.000Z" },
    ]);

    expect(lastTouchMap.get("c1")).toBe("2026-03-31T10:00:00.000Z");
    expect(lastTouchMap.get("c2")).toBe("2026-03-29T10:00:00.000Z");
  });

  it("enriches demands with match count and last touch timestamp", () => {
    const rows = enrichDemandsInboxRows(
      [
        { id: "d1", contact_id: "c1", notes: "a" },
        { id: "d2", contact_id: "c2", notes: "b" },
        { id: "d3", contact_id: null, notes: "c" },
      ],
      [
        { demand_id: "d1" },
        { demand_id: "d1" },
        { demand_id: "d2" },
      ],
      [
        { contact_id: "c1", created_at: "2026-03-31T10:00:00.000Z" },
        { contact_id: "c2", created_at: "2026-03-28T10:00:00.000Z" },
      ],
    );

    expect(rows).toEqual([
      { id: "d1", contact_id: "c1", notes: "a", matchCount: 2, lastTouchAt: "2026-03-31T10:00:00.000Z" },
      { id: "d2", contact_id: "c2", notes: "b", matchCount: 1, lastTouchAt: "2026-03-28T10:00:00.000Z" },
      { id: "d3", contact_id: null, notes: "c", matchCount: 0, lastTouchAt: null },
    ]);
  });
});
