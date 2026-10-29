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

  it("lays out each outdoor table's seats level, beside a solid table or on a bench with open ground in front", () => {
    for (const t of DEFAULT_TABLES.filter(t => t.kind === "outdoor")) {
      const l = studyLayout(v).find(l => l.anchor === t.anchor)!;
      expect(l.area, t.anchor).toBe("village");
      const seats = seatsOf(t.anchor, island.ground, v);
      expect(seats.length).toBe(t.seats);
      expect(island.standable(l.at[0], l.at[1]), `${t.anchor} table`).toBe(false);
      for (const s of seats) {
        // A bench's seat is on the bench: the step in front of it, where you sit down from, is open.
        const k = l.furniture === "bench" ? 0.6 : 0;
        expect(island.standable(s.x + Math.sin(s.facing) * k, s.z + Math.cos(s.facing) * k), `${s.anchor}#${s.seat}`).toBe(true);
      }
      const ys = seats.map(s => s.y);
      expect(Math.max(...ys) - Math.min(...ys), t.anchor).toBeLessThan(0.15);
    }
  });

  it("has one outdoor spot, the quay's plain bench, its seats facing the sea (David: \"should just be bench\")", () => {
    expect(DEFAULT_TABLES.filter(t => t.kind === "outdoor").map(t => t.anchor)).toEqual(["study:pier-bench"]);
    expect(studyLayout(v).find(l => l.anchor === "study:pier-bench")?.furniture).toBe("bench");
    for (const s of seatsOf("study:pier-bench", island.ground, v)) {
      const ahead = [2, 3, 4, 5, 6].find(d => island.wet(s.x + Math.sin(s.facing) * d, s.z + Math.cos(s.facing) * d));
      expect(ahead, `seat ${s.seat}: the sea within 6 ahead`).toBeDefined();
    }
  });
});
