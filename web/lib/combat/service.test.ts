import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { islandMissions, islandProgression, islandScore, islandWeapons } from "./islandAdapter";
import { RUNES, resample } from "./incantation";
import { memoryCombatStore } from "./memoryStore";
import { EVENT_XP, STAT_RESET_FEE, SUBCLASS_RESPEC_FEE, levelForXp, xpForLevel } from "./progression";
import { combatSeedSql } from "./seed";
import { allocateStats, chooseSubclass, completeMission, getProgression, listMissions, missionProgress, recordKill, repairWeapon, reportWear, resetStats, startMission } from "./service";

const M = "00000000-0000-4000-8000-0000000000aa";
const now = new Date("2026-09-26T12:00:00Z");

describe("progression via the service", () => {
  it("starts at level 1 with starter weapons and no subclass choices", async () => {
    const c = memoryCombatStore(() => now);
    const p = await getProgression(c.store, M);
    expect(p).toMatchObject({ ok: true, data: { level: 1, points_available: 0, subclass_choices: [] } });
    expect(p.ok && p.data.weapons.map((w) => w.weapon_key)).toEqual(["sword-driftwood", "wraps-cloth"]);
  });
  it("allocates within points, needs a paid reset to take points back, keeps XP on reset", async () => {
    const c = memoryCombatStore(() => now);
    await c.store.grantXp(M, xpForLevel(10), "admin", "x", "xp-1");
    expect(await allocateStats(c.store, M, { might: 20, vitality: 7 })).toMatchObject({ ok: true, data: { might: 20, vitality: 7 } });
    expect(await allocateStats(c.store, M, { finesse: 1 })).toMatchObject({ ok: false, code: "not_enough_points" });
    expect(await resetStats(c.store, M, "reset-0001")).toMatchObject({ ok: false, code: "insufficient" });
    c.fund(M, 500);
    expect(await resetStats(c.store, M, "reset-0002")).toMatchObject({ ok: true, data: { fee: 200 } });
    expect(await resetStats(c.store, M, "reset-0002")).toMatchObject({ ok: true, data: { replayed: true } });
    expect(c.coinsOf(M)).toBe(300);
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data).toMatchObject({ level: 10, points_available: 27, stats: { might: 0 } });
  });
  it("offers the four subclasses of the member's family at 10; first choice free, a change costs coins", async () => {
    const c = memoryCombatStore(() => now);
    c.setFamily(M, "Warden");
    expect(await chooseSubclass(c.store, M, "druid", "sub-0001")).toMatchObject({ ok: false, code: "level_too_low" });
    await c.store.grantXp(M, xpForLevel(10), "admin", "x", "xp-2");
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.subclass_choices.map((s) => s.key)).toEqual(["summoner", "shaman", "druid", "priest"]);
    expect(await chooseSubclass(c.store, M, "monk", "sub-0002")).toMatchObject({ ok: false, code: "wrong_family" });
    expect(await chooseSubclass(c.store, M, "druid", "sub-0003")).toMatchObject({ ok: true, data: { fee: 0 } });
    expect(await chooseSubclass(c.store, M, "priest", "sub-0004")).toMatchObject({ ok: false, code: "insufficient" });
    c.fund(M, 250);
    expect(await chooseSubclass(c.store, M, "priest", "sub-0005")).toMatchObject({ ok: true, data: { fee: 250 } });
  });
  it("counts each kill event once", async () => {
    const c = memoryCombatStore(() => now);
    expect(await recordKill(c.store, M, "shadow-fox", "kill-0001")).toMatchObject({ ok: true, data: { xp: 30 } });
    expect(await recordKill(c.store, M, "shadow-fox", "kill-0001")).toMatchObject({ ok: true, data: { xp: 30, replayed: true } });
    expect(await recordKill(c.store, M, "dragon", "kill-0002")).toMatchObject({ ok: false, code: "unknown_enemy" });
  });
});

describe("missions via the service", () => {
  it("runs a hunt end to end; retried events and turn-ins pay once", async () => {
    const c = memoryCombatStore(() => now);
    const s = await startMission(c.store, M, "hunt-foxes", "start-0001", now);
    const id = s.ok ? s.data.progress_id : "";
    expect(await startMission(c.store, M, "hunt-foxes", "start-0002", now)).toMatchObject({ ok: true, data: { progress_id: id, resumed: true } });
    const kills = ["a", "b", "c", "d", "e", "f"].map((k) => ({ id: k, type: "kill" as const, enemy: "shadow-fox" }));
    await missionProgress(c.store, M, id, kills.slice(0, 3));
    await missionProgress(c.store, M, id, kills.slice(0, 3)); // retry
    expect(await completeMission(c.store, M, id)).toMatchObject({ ok: false, code: "not_ready" });
    expect(await missionProgress(c.store, M, id, kills)).toMatchObject({ ok: true, data: { state: "ready", counter: 6 } });
    expect(await completeMission(c.store, M, id)).toMatchObject({ ok: true, data: { xp_awarded: 300, coins_awarded: 60, replayed: false } });
    expect(await completeMission(c.store, M, id)).toMatchObject({ ok: true, data: { replayed: true } });
    expect(c.coinsOf(M)).toBe(60);
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.xp).toBe(300);
    expect(await startMission(c.store, M, "hunt-foxes", "start-0003", now)).toMatchObject({ ok: false, code: "cooldown" });
    const board = await listMissions(c.store, M, now);
    expect(board.ok && board.data.find((m) => m.key === "hunt-foxes")).toMatchObject({ can_start: false });
    expect(board.ok && board.data.find((m) => m.key === "hunt-crabs")).toMatchObject({ can_start: true, open: null });
  });
  it("refuses kill events for unknown enemies", async () => {
    const c = memoryCombatStore(() => now);
    const s = await startMission(c.store, M, "hunt-crabs", "start-0010", now);
    expect(await missionProgress(c.store, M, s.ok ? s.data.progress_id : "", [{ id: "x", type: "kill", enemy: "dragon" }])).toMatchObject({ ok: false, code: "unknown_enemy" });
  });
});

describe("durability via the service", () => {
  it("wears on hits and defeat once per key, then repairs for coins", async () => {
    const c = memoryCombatStore(() => now);
    await getProgression(c.store, M);
    expect(await reportWear(c.store, M, "sword-driftwood", 5, true, "wear-0001")).toMatchObject({ ok: true, data: { durability: 76 } });
    expect(await reportWear(c.store, M, "sword-driftwood", 5, true, "wear-0001")).toMatchObject({ ok: true, data: { durability: 76, replayed: true } });
    expect(await repairWeapon(c.store, M, "sword-driftwood", "rep-0001")).toMatchObject({ ok: false, code: "insufficient" });
    c.fund(M, 20);
    expect(await repairWeapon(c.store, M, "sword-driftwood", "rep-0002")).toMatchObject({ ok: true, data: { durability: 90, cost: 14 } });
    expect(c.coinsOf(M)).toBe(6);
    expect(await reportWear(c.store, M, "bow-yew", 1, false, "wear-0002")).toMatchObject({ ok: false, code: "not_owned" });
  });
});

describe("island adapter", () => {
  it("scores the island's own rune geometry with the systems scorer", () => {
    const ember: [number, number][][] = [[[0.18, 0.28], [0.5, 0.78], [0.82, 0.28]]];
    const clean = [resample(ember[0].map(([x, y]) => ({ x, y }))).map((p) => [p.x, p.y] as [number, number])];
    expect(islandScore(ember, clean)).toMatchObject({ outcome: "enhanced", power: 1.5, scribble: false });
    const scribble = [[[0.05, 0.1], [0.95, 0.2], [0.05, 0.4], [0.95, 0.5], [0.05, 0.7], [0.95, 0.9], [0.05, 0.95]] as [number, number][]];
    expect(islandScore(ember, scribble)).toMatchObject({ outcome: "fail", scribble: true });
    expect(RUNES).toHaveLength(2);
  });
  it("maps gear, missions and the ruins gate", () => {
    expect(islandWeapons().find((w) => w.id === "revolver-brass")).toMatchObject({ kind: "bow", tier: 2, damage: 14 });
    expect(islandMissions().find((m) => m.id === "escort-botanist")).toMatchObject({ template: "escort", params: { escortee: "botanist", count: 3 } });
    expect(islandProgression({ level: 12, family: "Arcane", subclass: null })).toMatchObject({ gateOpen: false, reason: "Choose your subclass." });
    expect(islandProgression({ level: 12, family: "Arcane", subclass: { key: "necromancer" } })).toMatchObject({ gateOpen: true });
  });
});

describe("035_combat.sql stays in step with the TS rules", () => {
  const sql = readFileSync(join(__dirname, "../../supabase/migrations/035_combat.sql"), "utf8");
  it("carries the generated seed verbatim", () => {
    expect(sql).toContain(combatSeedSql());
  });
  it("uses the same curve and fees", () => {
    expect(sql).toContain("need := need + 100 * l + 25 * l * l;");
    expect(sql).toContain(`('event_xp', ${EVENT_XP})`);
    expect(sql).toContain(`('stat_reset_fee', ${STAT_RESET_FEE})`);
    expect(sql).toContain(`('subclass_respec_fee', ${SUBCLASS_RESPEC_FEE})`);
    // the smoke asserts combat_level_for_xp(11625) = 10 and (11624) = 9
    expect([levelForXp(11624), levelForXp(11625)]).toEqual([9, 10]);
  });
});
