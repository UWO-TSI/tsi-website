import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { DEFAULT_TABLES } from "./tables";
import { seatsOf, studyLayout } from "./seats";
import { islandOf } from "@/lib/game/defaultIsland";
import { loadWorldFromDisk } from "@/lib/game/world/disk";
import { villageOfWorld } from "@/lib/game/world/village";

describe("the outdoor study tables on the new world (web/data/world)", () => {
  const v = villageOfWorld(loadWorldFromDisk(join(__dirname, "../../data/world"))), island = islandOf(v);

  it("stands every backend table, and only those: each world study object is a table's anchor with its furniture", () => {
    expect(studyLayout(v).map(l => l.anchor).sort()).toEqual(DEFAULT_TABLES.map(t => t.anchor).sort());
    for (const o of v.objects.filter(o => o.kind === "study")) expect(DEFAULT_TABLES.some(t => t.anchor === o.id), o.id).toBe(true);
  });

  it("lays out each outdoor table's seats on open, level ground beside a solid table", () => {
    for (const t of DEFAULT_TABLES.filter(t => t.kind === "outdoor")) {
      const l = studyLayout(v).find(l => l.anchor === t.anchor)!;
      expect(l.area, t.anchor).toBe("village");
      const seats = seatsOf(t.anchor, island.ground, v);
      expect(seats.length).toBe(t.seats);
      expect(island.standable(l.at[0], l.at[1]), `${t.anchor} table`).toBe(false);
      for (const s of seats) expect(island.standable(s.x, s.z), `${s.anchor}#${s.seat}`).toBe(true);
      const ys = seats.map(s => s.y);
      expect(Math.max(...ys) - Math.min(...ys), t.anchor).toBeLessThan(0.15);
    }
  });
});
