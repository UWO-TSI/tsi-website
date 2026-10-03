import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { islandMissions, islandProgression, islandScore, islandWeapons } from "./islandAdapter";
import { BOSS_DROPS, ELDER_DROPS, rollBossReward } from "./content";
import { RUNES, resample } from "./incantation";
import { memoryCombatStore } from "./memoryStore";
import { EVENT_XP, STAT_RESET_FEE, SUBCLASS_RESPEC_FEE, levelForXp, xpForLevel } from "./progression";
import { STARTER_WEAPONS, WEAPONS } from "./weapons";
import { allocateStats, chooseSubclass, claimBossReward, claimMinibossReward, completeMission, getProgression, listMissions, missionProgress, recordKill, repairWeapon, reportWear, resetStats, setLoadout, startMission } from "./service";
import { TRAITS } from "./kits";

const M = "00000000-0000-4000-8000-0000000000aa";
const now = new Date("2026-09-26T12:00:00Z");

/** Rows 179/207: the ruins gate opens with the Oracle family, level 10 and the subclass choice. */
async function openGate(c: ReturnType<typeof memoryCombatStore>, m = M) {
  c.setFamily(m, "Warden");
  await c.store.grantXp(m, xpForLevel(10), "admin", "x", "gate-xp");
  await chooseSubclass(c.store, m, "druid", "gate-sub");
}

describe("the ruins gate is enforced on the server (Phase 1 finding)", () => {
  it("refuses mission start, progress, kills and the boss reward until family + level 10 + subclass", async () => {
    const c = memoryCombatStore(() => now);
    const closed = { ok: false, code: "gate_closed" };
    expect(await startMission(c.store, M, "hunt-golem", "start-g001", now)).toMatchObject(closed);
    expect(await recordKill(c.store, M, "stone-golem", "kill-g001")).toMatchObject(closed);
    expect(await claimBossReward(c.store, M, "kill-g001", () => 0.9)).toMatchObject(closed);
    c.setFamily(M, "Warden");
    await c.store.grantXp(M, xpForLevel(10), "admin", "x", "gate-xp");
    expect(await startMission(c.store, M, "hunt-golem", "start-g002", now)).toMatchObject(closed); // no subclass yet
    await chooseSubclass(c.store, M, "druid", "gate-sub");
    const s = await startMission(c.store, M, "hunt-golem", "start-g003", now);
    expect(s).toMatchObject({ ok: true });
    expect(await recordKill(c.store, M, "stone-golem", "kill-g002")).toMatchObject({ ok: true });
    // A progress row started before a gate check existed is refused too once the gate is closed again (family cleared).
    c.setFamily(M, null);
    expect(await missionProgress(c.store, M, s.ok ? s.data.progress_id : "", [{ id: "k1", type: "kill", enemy: "stone-golem" }])).toMatchObject(closed);
  });
  it("grants the four starter weapons when the gate opens, not before", async () => {
    const c = memoryCombatStore(() => now);
    const owned = async () => { const p = await getProgression(c.store, M); return p.ok ? p.data.weapons.map((w) => w.weapon_key) : []; };
    expect(await owned()).toEqual(["sword-driftwood", "wraps-cloth"]);
    await openGate(c);
    expect(new Set(await owned())).toEqual(new Set(STARTER_WEAPONS));
  });
});

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
    // A retried earlier choice answers with its first result, as combat_respec_log does.
    expect(await chooseSubclass(c.store, M, "druid", "sub-0003")).toMatchObject({ ok: true, data: { subclass: "druid", fee: 0, replayed: true } });
  });
  it("counts each kill event once", async () => {
    const c = memoryCombatStore(() => now);
    await openGate(c);
    const base = xpForLevel(10);
    expect(await recordKill(c.store, M, "shadow-fox", "kill-0001")).toMatchObject({ ok: true, data: { xp: base + 30 } });
    expect(await recordKill(c.store, M, "shadow-fox", "kill-0001")).toMatchObject({ ok: true, data: { xp: base + 30, replayed: true } });
    expect(await recordKill(c.store, M, "dragon", "kill-0002")).toMatchObject({ ok: false, code: "unknown_enemy" });
  });
});

describe("missions via the service", () => {
  it("runs a hunt end to end; retried events and turn-ins pay once", async () => {
    const c = memoryCombatStore(() => now);
    await openGate(c);
    const s = await startMission(c.store, M, "hunt-foxes", "start-0001", now);
    const id = s.ok ? s.data.progress_id : "";
    expect(await startMission(c.store, M, "hunt-foxes", "start-0002", now)).toMatchObject({ ok: true, data: { progress_id: id, resumed: true } });
    const kills = ["a", "b", "c", "d", "e", "f"].map((k) => ({ id: k, type: "kill" as const, enemy: "shadow-fox" }));
    await missionProgress(c.store, M, id, kills.slice(0, 3));
    await missionProgress(c.store, M, id, kills.slice(0, 3)); // retry
    expect(await completeMission(c.store, M, id)).toMatchObject({ ok: false, code: "not_ready" });
    expect(await missionProgress(c.store, M, id, kills)).toMatchObject({ ok: true, data: { state: "ready", counter: 6 } });
    expect(await completeMission(c.store, M, id)).toMatchObject({ ok: true, data: { xp_awarded: 300, coins_awarded: 60, materials_awarded: { wood_branch: 3 }, replayed: false } });
    expect(await completeMission(c.store, M, id)).toMatchObject({ ok: true, data: { replayed: true } });
    expect(c.coinsOf(M)).toBe(60);
    expect(c.materialOf(M, "wood_branch")).toBe(3); // materials paid once too
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.xp).toBe(xpForLevel(10) + 300);
    expect(await startMission(c.store, M, "hunt-foxes", "start-0003", now)).toMatchObject({ ok: false, code: "cooldown" });
    const board = await listMissions(c.store, M, now);
    expect(board.ok && board.data.find((m) => m.key === "hunt-foxes")).toMatchObject({ can_start: false });
    expect(board.ok && board.data.find((m) => m.key === "hunt-crabs")).toMatchObject({ can_start: true, open: null });
  });
  it("refuses kill events for unknown enemies", async () => {
    const c = memoryCombatStore(() => now);
    await openGate(c);
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
    expect(islandWeapons().find((w) => w.id === "revolver-brass")).toMatchObject({ kind: "bow" });
    expect(islandMissions().find((m) => m.id === "escort-botanist")).toMatchObject({ template: "escort", params: { escortee: "botanist", count: 3 } });
    expect(islandProgression({ level: 12, family: "Arcane", subclass: null })).toMatchObject({ gateOpen: false, reason: "Choose your subclass." });
    expect(islandProgression({ level: 12, family: "Arcane", subclass: { key: "necromancer" } })).toMatchObject({ gateOpen: true });
  });
});

describe("guardian statue reward (row 21)", () => {
  const winAt = async (c: ReturnType<typeof memoryCombatStore>, key: string) => recordKill(c.store, M, "guardian-statue", key);
  it("pays once per recorded boss kill, then waits out the 20 h cooldown", async () => {
    let t = now.getTime();
    const c = memoryCombatStore(() => new Date(t));
    await openGate(c);
    expect(await claimBossReward(c.store, M, "boss-0001", () => 0.9)).toMatchObject({ ok: false, code: "not_found" }); // no kill yet
    await recordKill(c.store, M, "shadow-fox", "fox-0001");
    expect(await claimBossReward(c.store, M, "fox-0001", () => 0.9)).toMatchObject({ ok: false, code: "not_found" }); // not a boss
    await winAt(c, "boss-0002");
    const first = await claimBossReward(c.store, M, "boss-0002", () => 0.9);
    expect(first).toMatchObject({ ok: true, data: { replayed: false, reward: { coins: BOSS_DROPS.coins, weapon: null, rarity: null } } });
    expect(await claimBossReward(c.store, M, "boss-0002", () => 0.01)).toMatchObject({ ok: true, data: { replayed: true, reward: { weapon: null } } });
    expect(c.coinsOf(M)).toBe(BOSS_DROPS.coins);
    expect(c.materialOf(M, "rock_crystal")).toBe(2);
    await winAt(c, "boss-0003");
    expect(await claimBossReward(c.store, M, "boss-0003", () => 0.9)).toMatchObject({ ok: false, code: "boss_cooldown" });
    t += 20 * 3_600_000;
    expect(await claimBossReward(c.store, M, "boss-0003", () => 0.9)).toMatchObject({ ok: true, data: { replayed: false } });
  });
  it("rolls Epic/Legendary gear the member doesn't own and puts it in their weapons", async () => {
    expect(rollBossReward([], () => 0.01)).toMatchObject({ weapon: "staff-heartstone", rarity: "legendary" });
    expect(rollBossReward(["staff-heartstone"], () => 0.01)).toMatchObject({ weapon: null, rarity: null });
    expect(rollBossReward([], () => 0.1)).toMatchObject({ rarity: "epic" });
    expect(rollBossReward([], () => 0.5)).toMatchObject({ weapon: null });
    const epics = BOSS_DROPS.gear[1].weapons;
    expect(rollBossReward(epics.slice(0, 3), () => 0.1)).toMatchObject({ weapon: epics[3] });
    for (const g of BOSS_DROPS.gear) for (const w of g.weapons) expect(WEAPONS.find((x) => x.key === w)!.tier).toBe(g.rarity === "legendary" ? 5 : 4);
    const c = memoryCombatStore(() => now);
    await openGate(c);
    await recordKill(c.store, M, "guardian-statue", "boss-0100");
    const r = await claimBossReward(c.store, M, "boss-0100", () => 0.1);
    const w = r.ok ? r.data.reward.weapon : null;
    expect(w && epics.includes(w)).toBe(true);
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.weapons.some((x) => x.weapon_key === w && x.tier === 4)).toBe(true);
  });
});

describe("elder thorn crab reward (zone 1's mini-boss)", () => {
  const ELDER = ELDER_DROPS.enemy;
  it("pays its own table once per recorded kill, on a cooldown of its own (the guardian's is separate)", async () => {
    let t = now.getTime();
    const c = memoryCombatStore(() => new Date(t));
    expect(await claimMinibossReward(c.store, M, ELDER, "elder-0001", () => 0.9)).toMatchObject({ ok: false, code: "gate_closed" });
    await openGate(c);
    expect(await claimMinibossReward(c.store, M, ELDER, "elder-0001", () => 0.9)).toMatchObject({ ok: false, code: "not_found" }); // no kill yet
    expect(await claimMinibossReward(c.store, M, "thorn-crab", "elder-0001", () => 0.9)).toMatchObject({ ok: false, code: "unknown_enemy" }); // no table
    await recordKill(c.store, M, "stone-golem", "golem-0001");
    expect(await claimMinibossReward(c.store, M, ELDER, "golem-0001", () => 0.9)).toMatchObject({ ok: false, code: "not_found" }); // another elite's kill
    await recordKill(c.store, M, ELDER, "elder-0002");
    expect(await claimMinibossReward(c.store, M, ELDER, "elder-0002", () => 0.9)).toMatchObject({ ok: true, data: { replayed: false, reward: { coins: ELDER_DROPS.coins, weapon: null } } });
    expect(await claimMinibossReward(c.store, M, ELDER, "elder-0002", () => 0.01)).toMatchObject({ ok: true, data: { replayed: true, reward: { weapon: null } } });
    expect(c.coinsOf(M)).toBe(ELDER_DROPS.coins);
    expect(c.materialOf(M, "rock_stone")).toBe(3);
    await recordKill(c.store, M, ELDER, "elder-0003");
    expect(await claimMinibossReward(c.store, M, ELDER, "elder-0003", () => 0.9)).toMatchObject({ ok: false, code: "miniboss_cooldown" });
    await recordKill(c.store, M, "guardian-statue", "boss-0001");
    expect(await claimBossReward(c.store, M, "boss-0001", () => 0.9)).toMatchObject({ ok: true }); // not on the elder's cooldown
    t += 20 * 3_600_000;
    expect(await claimMinibossReward(c.store, M, ELDER, "elder-0003", () => 0.9)).toMatchObject({ ok: true, data: { replayed: false } });
  });
  it("rolls a rare crafted (tier 2) weapon the member doesn't own, into their weapons", async () => {
    for (const w of ELDER_DROPS.gear[0].weapons) expect(WEAPONS.find((x) => x.key === w)!.tier).toBe(2);
    expect(rollBossReward([], () => 0.01, ELDER_DROPS)).toMatchObject({ rarity: "rare" });
    expect(rollBossReward(ELDER_DROPS.gear[0].weapons, () => 0.01, ELDER_DROPS)).toMatchObject({ weapon: null, rarity: null });
    expect(rollBossReward([], () => 0.5, ELDER_DROPS)).toMatchObject({ weapon: null, coins: ELDER_DROPS.coins });
    const c = memoryCombatStore(() => now);
    await openGate(c);
    await recordKill(c.store, M, ELDER, "elder-0100");
    const r = await claimMinibossReward(c.store, M, ELDER, "elder-0100", () => 0.01);
    const w = r.ok ? r.data.reward.weapon : null;
    expect(w && ELDER_DROPS.gear[0].weapons.includes(w)).toBe(true);
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.weapons.some((x) => x.weapon_key === w && x.tier === 2)).toBe(true);
  });
  it("20261002182708_zone1_mobs.sql pays it at the same cooldown and bounds", () => {
    const sql = readFileSync(join(__dirname, "../../supabase/migrations/20261002182708_zone1_mobs.sql"), "utf8");
    expect(sql).toContain(`make_interval(hours => ${ELDER_DROPS.cooldown_hours})`);
    expect(sql).toContain("w.tier BETWEEN 2 AND 3");
    expect(ELDER_DROPS.coins).toBeLessThanOrEqual(200);
  });
});

describe("20260926190000_combat_content.sql stays in step with the TS rules", () => {
  const sql = readFileSync(join(__dirname, "../../supabase/migrations/20260926190000_combat_content.sql"), "utf8");
  it("pays the boss reward at the same cooldown and grants the same starters", () => {
    expect(sql).toContain(`make_interval(hours => ${BOSS_DROPS.cooldown_hours})`);
    expect(sql).toContain(STARTER_WEAPONS.map((k) => `'${k}'`).join(", "));
  });
});

describe("20260926150800_combat.sql stays in step with the TS rules", () => {
  const sql = readFileSync(join(__dirname, "../../supabase/migrations/20260926150800_combat.sql"), "utf8");
  it("uses the same curve and fees", () => {
    expect(sql).toContain("need := need + 100 * l + 25 * l * l;");
    expect(sql).toContain(`('event_xp', ${EVENT_XP})`);
    expect(sql).toContain(`('stat_reset_fee', ${STAT_RESET_FEE})`);
    expect(sql).toContain(`('subclass_respec_fee', ${SUBCLASS_RESPEC_FEE})`);
    // the smoke asserts combat_level_for_xp(11625) = 10 and (11624) = 9
    expect([levelForXp(11624), levelForXp(11625)]).toEqual([9, 10]);
  });
});

describe("combat B: subclass choice, loadout, stat allocation and traits (rows 20, 38, 40, 50, 207)", () => {
  it("allocation takes the new totals, so a retried request changes nothing", async () => {
    const c = memoryCombatStore(() => now);
    await c.store.grantXp(M, xpForLevel(10), "admin", "x", "b-xp-1");
    expect(await allocateStats(c.store, M, { might: 10, vitality: 5 })).toMatchObject({ ok: true, data: { might: 10, vitality: 5 } });
    expect(await allocateStats(c.store, M, { might: 10, vitality: 5 })).toMatchObject({ ok: true, data: { might: 10, vitality: 5 } }); // retry
    expect(await allocateStats(c.store, M, { might: 12 })).toMatchObject({ ok: true, data: { might: 12, vitality: 5 } });
    expect(await allocateStats(c.store, M, { might: 11 })).toMatchObject({ ok: false, code: "needs_reset" });
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.points_available).toBe(27 - 17);
  });
  it("a subclass change is charged once per key, and a retried key answers with its first result", async () => {
    const c = memoryCombatStore(() => now);
    c.setFamily(M, "Warden"); c.fund(M, 250);
    await c.store.grantXp(M, xpForLevel(10), "admin", "x", "b-xp-2");
    await chooseSubclass(c.store, M, "druid", "b-sub-0001");
    expect(await chooseSubclass(c.store, M, "priest", "b-sub-0002")).toMatchObject({ ok: true, data: { fee: 250, replayed: false } });
    expect(await chooseSubclass(c.store, M, "druid", "b-sub-0003")).toMatchObject({ ok: false, code: "insufficient" });
    expect(await chooseSubclass(c.store, M, "priest", "b-sub-0002")).toMatchObject({ ok: true, data: { subclass: "priest", fee: 250, replayed: true } });
    expect(c.coinsOf(M)).toBe(0);
  });
  it("the loadout holds four abilities from the kit, defaults to signature + own + family ritual, and survives a subclass change", async () => {
    const c = memoryCombatStore(() => now);
    expect(await setLoadout(c.store, M, ["priest.mend"])).toMatchObject({ ok: false, code: "no_subclass" });
    await openGate(c); // druid
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.loadout).toEqual(["druid.rootbind", "druid.thorn-lash", "druid.wild-growth", "warden.covenant"]);
    expect(p.ok && p.data.kit).toHaveLength(5);
    const mine = ["druid.rootbind", "warden.renew", "druid.thorn-lash", "warden.covenant"];
    expect(await setLoadout(c.store, M, mine)).toMatchObject({ ok: true });
    expect(await setLoadout(c.store, M, mine)).toMatchObject({ ok: true }); // the same set again
    expect(await setLoadout(c.store, M, ["priest.mend"])).toMatchObject({ ok: false, code: "bad_loadout" });
    expect(await setLoadout(c.store, M, ["druid.rootbind", "druid.rootbind"])).toMatchObject({ ok: false, code: "bad_loadout" });
    expect(await setLoadout(c.store, M, ["a", "b", "c", "d", "e"])).toMatchObject({ ok: false, code: "bad_loadout" });
    const q = await getProgression(c.store, M);
    expect(q.ok && q.data.loadout).toEqual(mine);
    c.fund(M, 250);
    await chooseSubclass(c.store, M, "priest", "b-sub-0010");
    const r = await getProgression(c.store, M);
    expect(r.ok && r.data.loadout).toEqual(["warden.renew", "warden.covenant"]); // the family's carry over, the druid's drop out
  });
  it("a Transmuter learns a basic trait on the first defeat of a species and trains it after (row 40); others don't", async () => {
    const c = memoryCombatStore(() => now);
    c.setFamily(M, "Arcane");
    await c.store.grantXp(M, xpForLevel(10), "admin", "x", "b-xp-3");
    await chooseSubclass(c.store, M, "transmuter", "b-sub-0020");
    const start = await getProgression(c.store, M);
    expect(start.ok && start.data.kit).toContain("trait.fox-stride"); // the starter, before any kill
    expect(await recordKill(c.store, M, "thorn-crab", "b-kill-1")).toMatchObject({ ok: true, data: { trait_unlocked: "crab-shell" } });
    expect(await recordKill(c.store, M, "thorn-crab", "b-kill-1")).toMatchObject({ ok: true, data: { replayed: true, trait_unlocked: null } });
    expect(await recordKill(c.store, M, "elder-thorn-crab", "b-kill-2")).toMatchObject({ ok: true, data: { trait_unlocked: null } }); // same trait, trained
    expect(await recordKill(c.store, M, "guardian-statue", "b-kill-3")).toMatchObject({ ok: true, data: { trait_unlocked: null } }); // the boss teaches nothing
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.traits).toEqual({ "crab-shell": 2 });
    expect(p.ok && p.data.kit).toContain("trait.crab-shell");
    expect(await setLoadout(c.store, M, ["transmuter.aspect", "trait.crab-shell", "trait.fox-stride", "arcane.blink"])).toMatchObject({ ok: true });
    const other = "00000000-0000-4000-8000-0000000000ab";
    await openGate(c, other);
    await recordKill(c.store, other, "thorn-crab", "b-kill-9");
    const o = await getProgression(c.store, other);
    expect(o.ok && o.data.traits).toEqual({});
  });
  it("20260926210000_combat_kits.sql (and the Arcane seed's pollen sprite) map the same species to the same traits", () => {
    const dir = join(__dirname, "../../supabase/migrations"), arcane = readdirSync(dir).find((f) => f.endsWith("_classes_v2_arcane_seed.sql"))!;
    const sql = readFileSync(join(dir, "20260926210000_combat_kits.sql"), "utf8") + readFileSync(join(dir, arcane), "utf8").match(/-- BEGIN TRAITS[\s\S]*?-- END TRAITS/)![0];
    const pairs = TRAITS.flatMap((t) => t.from.map((e) => `('${e}', '${t.key}')`));
    for (const pair of pairs) expect(sql).toContain(pair);
    expect(sql.match(/\('[a-z-]+', '[a-z-]+'\)/g)).toHaveLength(pairs.length);
  });
});
