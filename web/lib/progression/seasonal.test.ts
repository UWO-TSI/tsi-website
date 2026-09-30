import { describe, expect, it } from "vitest";
import { SEASONAL_GOALS, DEFAULT_GOALS } from "./defaults";
import { eventCatches, landSeason, latestTourney, runningEvent, tourneyBoards, type TourneyEntry } from "./seasonal";
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { tourney } from "@/lib/collections/service";
import { fishRoll } from "@/lib/collections/rolls";
import { rodByTier } from "@/lib/game/rods";
import { seededRandom } from "@/lib/game/weatherSystem";
import type { ClubGoal } from "./types";

const at = (iso: string) => new Date(iso);
const decor = (iso: string) => runningEvent(DEFAULT_GOALS, at(iso))?.event.decor ?? null;
const fall = SEASONAL_GOALS[0];

describe("event windows (Toronto time)", () => {
  it("runs each event in its month, every year", () => {
    expect(decor("2026-09-15T16:00:00Z")).toBe("fall-tourney");
    expect(decor("2027-12-15T16:00:00Z")).toBe("winter-lights");
    expect(decor("2028-03-22T16:00:00Z")).toBe("genesis");
    expect(decor("2027-04-15T16:00:00Z")).toBe("spring-picnic");
    expect(decor("2027-06-15T16:00:00Z")).toBeNull();
    expect(decor("2027-02-15T16:00:00Z")).toBeNull();
  });
  it("turns over at Toronto midnight, not UTC midnight, across the year boundary", () => {
    expect(decor("2027-12-01T04:30:00Z")).toBeNull(); // Nov 30, 23:30 in Toronto
    expect(decor("2027-12-01T05:30:00Z")).toBe("winter-lights");
    expect(decor("2028-01-01T00:30:00Z")).toBe("winter-lights"); // Dec 31, 19:30 in Toronto; UTC has already turned
    expect(decor("2028-01-01T04:30:00Z")).toBe("winter-lights"); // 23:30 on New Year's Eve
    expect(decor("2028-01-01T05:30:00Z")).toBeNull(); // 00:30 on Jan 1
    expect(decor("2026-10-01T03:30:00Z")).toBe("fall-tourney"); // Sep 30, 23:30 EDT
    expect(decor("2026-10-01T04:30:00Z")).toBeNull();
  });
});

describe("limited-time catches and tourney entry", () => {
  const perch = "fish_yellow_perch";
  const LIMITED = ["fish_yellow_perch", "fish_sturgeon", "fish_giant_trevally"];
  it("gates the event's species to its window and nothing else", () => {
    expect(landSeason(DEFAULT_GOALS, at("2027-09-10T16:00:00Z"))).toEqual({ closed: [], tourney: { goal_id: fall.id, cycle: 2027 } });
    expect(landSeason(DEFAULT_GOALS, at("2027-10-10T16:00:00Z"))).toEqual({ closed: LIMITED, tourney: null });
    // No club goals (a failed read, or before the migration): shut, never free.
    expect(landSeason([], at("2027-09-10T16:00:00Z"))).toEqual({ closed: LIMITED, tourney: null });
    const c = eventCatches(DEFAULT_GOALS, at("2027-10-10T16:00:00Z"));
    expect([c.limited.has(perch), c.open.has(perch), c.limited.has("fish_dace")]).toEqual([true, false, false]);
    expect(eventCatches(DEFAULT_GOALS, at("2027-09-10T16:00:00Z")).open.has(perch)).toBe(true);
  });
  it("never rolls a limited-time fish on the server outside its window, and does inside it", () => {
    const rolls = (iso: string, goals: readonly ClubGoal[], water: "river" | "sea") => {
      const random = seededRandom(11), now = at(iso), catches = eventCatches(goals, now);
      return new Set(Array.from({ length: 4000 }, () => fishRoll(water, 1, rodByTier(5), now, "clear", random, catches).fish.key));
    };
    for (const water of ["river", "sea"] as const) {
      for (const [iso, goals] of [["2026-10-10T16:00:00Z", DEFAULT_GOALS], ["2026-09-10T16:00:00Z", []]] as const) {
        const got = rolls(iso, goals, water);
        expect(LIMITED.filter((k) => got.has(k)), `${water} ${iso} ${goals.length}`).toEqual([]);
      }
    }
    expect(rolls("2026-09-10T16:00:00Z", DEFAULT_GOALS, "river").has(perch)).toBe(true);
    expect(rolls("2026-09-10T16:00:00Z", DEFAULT_GOALS, "sea").has("fish_giant_trevally")).toBe(true);
  });
  it("shows the open tourney, then the last one until the next opens", () => {
    expect(latestTourney(DEFAULT_GOALS, at("2026-09-20T16:00:00Z"))).toMatchObject({ cycle: 2026, open: true });
    expect(latestTourney(DEFAULT_GOALS, at("2027-02-20T16:00:00Z"))).toMatchObject({ cycle: 2026, open: false });
    expect(latestTourney(DEFAULT_GOALS, at("2027-09-02T16:00:00Z"))).toMatchObject({ cycle: 2027, open: true });
    expect(latestTourney(DEFAULT_GOALS, at("2026-08-20T16:00:00Z"))).toBeNull();
  });
});

describe("tourney board privacy (principle 6)", () => {
  const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
  const entry = (n: number, size: number, category: TourneyEntry["category"] = "fish"): TourneyEntry =>
    ({ member_id: id(n), member_name: `Member ${n}`, category, item_key: "fish_carp", size_cm: size, caught_at: `2026-09-0${n}T12:00:00Z` });
  const entries = [entry(1, 60), entry(2, 70), entry(3, 50), entry(4, 40), entry(5, 30), entry(6, 20), entry(7, 60, "sea")];
  const name = () => "Carp";

  it("names the top half; the earlier catch wins a tie", () => {
    const tie = tourneyBoards([entry(1, 60), entry(2, 60)], id(9), name)[0];
    expect(tie.top.map((r) => [r.rank, r.name])).toEqual([[1, "Member 1"]]);
    const [fish, sea] = tourneyBoards(entries, id(2), name);
    expect(fish.entrants).toBe(6);
    expect(fish.top.map((r) => [r.rank, r.name, r.size_cm])).toEqual([[1, "Member 2", 70], [2, "Member 1", 60], [3, "Member 3", 50]]);
    expect(fish.me).toMatchObject({ rank: 1, mine: true });
    expect(fish.around).toEqual([]);
    expect(sea.me).toBeNull();
  });
  it("shows a bottom-half member only their own row and unnamed neighbours", () => {
    const [fish] = tourneyBoards(entries, id(5), name);
    expect(fish.me).toEqual({ rank: 5, size_cm: 30, name: "Member 5", species: "Carp", mine: true });
    expect(fish.around).toEqual([{ rank: 4, size_cm: 40, name: null, species: null, mine: false }, { rank: 6, size_cm: 20, name: null, species: null, mine: false }]);
    const json = JSON.stringify(tourneyBoards(entries, id(5), name));
    for (const n of [4, 6]) expect(json).not.toContain(`Member ${n}`);
    for (const n of [1, 2, 3, 4, 6, 7]) expect(json).not.toContain(id(n));
  });
  it("enters only what the server landed during the tourney, keeping each member's biggest per category", async () => {
    let clock = at("2026-09-20T16:00:00Z");
    const m = memoryCollectionsStore(() => clock);
    m.name(id(1), "Maya");
    m.name(id(2), "Jordan");
    const land = async (member: string, key: string, size: number | null, now: string) => {
      clock = at(now);
      const roll = await m.store.cast(member, key, size, size !== null);
      clock = new Date(clock.getTime() + 5000);
      return m.store.land(member, roll, landSeason(DEFAULT_GOALS, clock));
    };
    await land(id(1), "fish_carp", 60, "2026-09-20T16:00:00Z");
    await land(id(1), "fish_carp", 40, "2026-09-20T16:01:00Z");
    await land(id(1), "sea_scallop", 12, "2026-09-20T16:02:00Z");
    await land(id(2), "fish_black_bass", 50, "2026-09-20T16:03:00Z");
    await land(id(2), "fish_black_bass", 55, "2026-10-02T16:00:00Z"); // after the tourney
    await m.store.cast(id(2), "fish_pike", 90, true); // a lost reel: never landed
    const r = await tourney(m.store, DEFAULT_GOALS, id(2), at("2026-09-20T16:00:00Z"));
    expect(r.ok && r.data).toMatchObject({ slug: "fall-fishing-tourney", cycle: 2026, open: true });
    const [fish, sea] = r.ok && r.data ? r.data.boards : [];
    expect(fish.top).toEqual([{ rank: 1, size_cm: 60, name: "Maya", species: "Carp", mine: false }]);
    expect(fish.me).toMatchObject({ rank: 2, size_cm: 50, species: "Black Bass", mine: true });
    expect(fish.around).toEqual([]);
    expect(sea.entrants).toBe(1);
  });
});
