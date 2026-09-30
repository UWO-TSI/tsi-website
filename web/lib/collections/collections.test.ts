import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FISH } from "@/lib/game/fishing";
import { availableAt, clueFor, journalPage, laterToday, museumWings, validateShowcase, weekStart, weeklyTrophies, type WeeklyBest } from "./logic";
import { memoryCollectionsStore } from "./memoryStore";
import { LAUNCH_ROSTER, ROSTER, type Species } from "./roster";
import { donate, journal, trophies } from "./service";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const sp = (key: string) => ROSTER.find((s) => s.key === key)!;
const noon = { hour: 12, month: 9, weather: "clear" as const };
const WEB = join(__dirname, "..", "..");

describe("roster", () => {
  const count = (c: Species["category"]) => LAUNCH_ROSTER.filter((s) => s.category === c).length;
  it("matches the launch sizes (rows 128, 129)", () => {
    expect([count("fish"), count("bug"), count("fruit"), count("nature"), count("mineral")]).toEqual([40, 20, 8, 15, 5]);
    expect(new Set(ROSTER.map((s) => s.key)).size).toBe(ROSTER.length);
    expect(new Set(ROSTER.filter((s) => s.category === "fish").map((s) => s.biome))).toEqual(new Set(["river", "pond", "cliff_pool", "sea"]));
    expect(new Set(ROSTER.filter((s) => s.category === "fish").map((s) => s.rarity)).size).toBe(5);
  });
  it("seeds fish and sea creatures from the game's FISH table (rarity, size, hours), and every fish the reel lands is on it (row 260)", () => {
    expect(FISH.filter((f) => !ROSTER.some((s) => s.key === f.key)).map((f) => f.key)).toEqual([]);
    const fish = new Map(FISH.map((f) => [f.key, f]));
    for (const s of ROSTER.filter((x) => x.category === "fish" || x.key.startsWith("sea_"))) {
      const f = fish.get(s.key);
      expect(f, s.key).toBeDefined();
      expect(s.size, s.key).toEqual(f!.sizeCm);
      expect(s.rarity, s.key).toBe(f!.rarity === "seaking" ? "legendary" : f!.rarity);
      // Plain windows must agree with the reel's own availability gate.
      if (!f!.when) expect(s.hours, s.key).toBeNull();
      for (const weather of ["clear", "rain"] as const) {
        for (let h = 0; h < 24; h++) {
          const game = f!.when ? f!.when(h + 0.5, weather) : true;
          expect(availableAt({ ...s, months: [] }, { hour: h + 0.5, month: 1, weather }), `${s.key} @${h} ${weather}`).toBe(game);
        }
      }
    }
  });
  it("points every asset-ready icon at a file that exists", () => {
    for (const s of ROSTER) if (s.icon) expect(existsSync(join(WEB, "public", s.icon)), s.icon).toBe(true);
    for (const s of ROSTER) if (s.model) expect(existsSync(join(WEB, "public", s.model)), s.model).toBe(true);
  });
});

describe("availability and clues", () => {
  it("handles night windows, rain-any-hour and seasons", () => {
    expect(availableAt(sp("fish_catfish"), noon)).toBe(false);
    expect(availableAt(sp("fish_catfish"), { ...noon, weather: "rain" })).toBe(true);
    expect(laterToday(sp("fish_catfish"), noon)).toBe(true);
    expect(availableAt(sp("fish_coelacanth"), { hour: 22, month: 5, weather: "clear" })).toBe(false);
    expect(availableAt(sp("fish_coelacanth"), { hour: 22, month: 5, weather: "rain" })).toBe(true);
    expect(availableAt(sp("fish_salmon"), { ...noon, month: 6 })).toBe(false);
  });
  it("never names the species in a clue", () => {
    for (const s of ROSTER) {
      const clue = clueFor(s).toLowerCase();
      expect(clue, s.key).not.toContain(s.name.toLowerCase());
    }
    expect(clueFor(sp("fish_stringfish"))).toBe("In the cliff pools · 21:00–04:00 (any hour in rain) · any weather · Dec–Mar · a big shadow");
  });
});

describe("journal pages", () => {
  it("shows silhouettes with clues for unknowns and leaks no names or keys", async () => {
    const m = memoryCollectionsStore();
    m.record(A, "fish_dace", 14.2);
    const r = await journal(m.store, A, "fish", noon);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ total: 81, discovered: 1 });
    expect(r.data.entries[0]).toMatchObject({ discovered: true, key: "fish_dace", best_size_cm: 14.2, museum: { donated: false } });
    const unknown = JSON.stringify(r.data.entries.filter((e) => !e.discovered)).toLowerCase();
    for (const s of ROSTER.filter((x) => x.category === "fish" && x.key !== "fish_dace")) {
      expect(unknown).not.toContain(s.key);
      expect(unknown).not.toContain(`"${s.name.toLowerCase()}`);
    }
    expect(r.data.entries[1]).toMatchObject({ discovered: false, silhouette: "/api/collections/silhouette/fish/2" });
    expect(r.data.categories.find((c) => c.category === "bug")).toEqual({ category: "bug", total: 20, discovered: 0 });
  });
  it("keeps personal size records (catch card data)", async () => {
    const m = memoryCollectionsStore();
    expect(m.record(A, "fish_carp", 50)).toMatchObject({ new_record: true, best_size_cm: 50, count: 1 });
    expect(m.record(A, "fish_carp", 40)).toMatchObject({ new_record: false, best_size_cm: 50, count: 2, total_collected: 2 });
    expect(m.record(A, "fish_carp", 9999)).toMatchObject({ new_record: true, best_size_cm: 70 });
    expect(m.record(A, "flower_rose", 5)).toMatchObject({ best_size_cm: null });
  });
});

describe("museum donations (rows 67, 202)", () => {
  it("puts the first donation on display with the donor's name and consumes one specimen", async () => {
    const m = memoryCollectionsStore();
    m.name(A, "Maya Chen");
    m.record(A, "fish_dace", 12);
    m.record(A, "fish_dace", 13);
    const r = await donate(m.store, A, "fish_dace", "donate-0001");
    expect(r).toMatchObject({ ok: true, data: { replayed: false, exhibit: { donated: true, name: "Dace", donor_name: "Maya Chen" } } });
    expect(m.countOf(A, "fish_dace")).toBe(1);
    expect(await donate(m.store, A, "fish_dace", "donate-0001")).toMatchObject({ ok: true, data: { replayed: true } });
    expect(m.countOf(A, "fish_dace")).toBe(1);
  });
  it("refuses duplicates and lets the second member keep theirs", async () => {
    const m = memoryCollectionsStore();
    m.name(A, "Maya Chen");
    m.record(A, "fish_dace", 12);
    m.record(B, "fish_dace", 17);
    await donate(m.store, A, "fish_dace", "donate-0002");
    const dup = await donate(m.store, B, "fish_dace", "donate-0003");
    expect(dup).toMatchObject({ ok: false, status: 409, code: "already_donated" });
    expect(!dup.ok && dup.error).toContain("Maya Chen");
    expect(m.countOf(B, "fish_dace")).toBe(1);
    expect(await donate(m.store, A, "fish_dace", "donate-0004")).toMatchObject({ ok: false, code: "already_donated" });
  });
  it("refuses what you don't have and what the museum doesn't collect", async () => {
    const m = memoryCollectionsStore();
    expect(await donate(m.store, A, "fish_carp", "donate-0005")).toMatchObject({ ok: false, code: "not_owned" });
    m.record(A, "apple", null);
    expect(await donate(m.store, A, "apple", "donate-0006")).toMatchObject({ ok: false, code: "not_donatable" });
  });
  it("lists wings without naming empty cases", () => {
    const wings = museumWings(ROSTER, [{ species_key: "bug_firefly", donor_id: A, donor_name: "Maya", donated_at: "2026-09-24T00:00:00Z", size_cm: null }]);
    expect(wings.map((w) => [w.wing, w.total, w.donated])).toEqual([["aquarium", 93, 0], ["insect_hall", 20, 1], ["nature_room", 15, 0]]);
    expect(wings[1].exhibits.filter((e) => !e.donated).every((e) => e.key === null && e.name === null)).toBe(true);
  });
  it("keeps discovery records separate from donated stock", async () => {
    const m = memoryCollectionsStore();
    m.record(A, "fish_dace", 12);
    await donate(m.store, A, "fish_dace", "donate-0007");
    const page = await journal(m.store, A, "fish", noon);
    expect(page.ok && page.data.entries[0]).toMatchObject({ discovered: true, count: 0, total_collected: 1, museum: { donated: true, by_me: true } });
  });
});

describe("weekly trophy case (row 204)", () => {
  const best = (user_id: string, item_key: string, size_cm: number, caught_at = "2026-09-22T10:00:00Z"): WeeklyBest => ({ user_id, member_name: user_id === A ? "Maya" : user_id === B ? "Jordan" : "Priya", item_key, size_cm, caught_at });
  it("keeps the biggest per species, ranks rarity then size-to-max, caps two per member", () => {
    const C = "c";
    const t = weeklyTrophies(ROSTER, [
      best(A, "fish_dace", 12), best(B, "fish_dace", 17), // Jordan's bigger dace wins the species
      best(A, "fish_coelacanth", 130), // legendary first
      best(A, "fish_tuna", 240), best(A, "fish_catfish", 60), // Maya capped at 2
      best(C, "fish_catfish", 100), // Priya's catfish beats Maya's
      best(C, "fish_salmon", 80), best(B, "fish_pike", 50),
      best(A, "flower_rose", 9), // not a catch
    ]);
    expect(t.map((x) => [x.key, x.member_name])).toEqual([
      ["fish_coelacanth", "Maya"], ["fish_tuna", "Maya"], ["fish_catfish", "Priya"], ["fish_pike", "Jordan"], ["fish_salmon", "Priya"], ["fish_dace", "Jordan"],
    ]);
    expect(t.filter((x) => x.member_name === "Maya")).toHaveLength(2);
    expect(t[0]).toMatchObject({ rank: 1, rarity: "legendary", size_ratio: 0.17 });
  });
  it("breaks equal sizes by who caught it first and caps the wall at six", () => {
    const t = weeklyTrophies(ROSTER, [best(B, "fish_dace", 15, "2026-09-23T10:00:00Z"), best(A, "fish_dace", 15, "2026-09-22T10:00:00Z")]);
    expect(t[0].member_name).toBe("Maya");
    const many = ROSTER.filter((s) => s.category === "fish").slice(0, 20).map((s, i) => best(String(i), s.key, s.size![1]));
    expect(weeklyTrophies(ROSTER, many)).toHaveLength(6);
  });
  it("reads this Monday-start week (Toronto) from recorded catches", async () => {
    expect(weekStart(new Date("2026-09-24T16:00:00Z"))).toBe("2026-09-21");
    expect(weekStart(new Date("2026-09-28T03:00:00Z"))).toBe("2026-09-21"); // Sunday 23:00 Toronto
    const m = memoryCollectionsStore();
    m.name(A, "Maya");
    m.record(A, "fish_carp", 60);
    m.record(A, "fish_carp", 55);
    const r = await trophies(m.store, new Date("2026-09-24T16:00:00Z"));
    expect(r).toMatchObject({ ok: true, data: { week_start: "2026-09-21", trophies: [{ key: "fish_carp", size_cm: 60, member_name: "Maya" }] } });
  });
});

describe("showcase", () => {
  it("takes three slots of things you've found, no repeats", () => {
    const mine = [{ item_key: "fish_dace", count: 0, total_collected: 1, best_size_cm: 12, first_collected_at: "" }];
    expect(validateShowcase(["fish_dace", null, null], mine)).toEqual({ ok: true, keys: ["fish_dace", null, null] });
    expect(validateShowcase(["fish_dace", "fish_dace", null], mine)).toMatchObject({ ok: false });
    expect(validateShowcase(["fish_koi", null, null], mine)).toMatchObject({ ok: false });
    expect(validateShowcase(["fish_dace"], mine)).toMatchObject({ ok: false });
  });
});

it("journal page helper exposes clue + availability on known entries too", () => {
  const page = journalPage(ROSTER, "bug", [{ item_key: "bug_firefly", count: 1, total_collected: 1, best_size_cm: null, first_collected_at: "x" }], [], A, { hour: 21, month: 6, weather: "clear" });
  expect(page.entries.find((e) => e.discovered)).toMatchObject({ key: "bug_firefly", available_now: true });
});
