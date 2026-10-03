import { describe, expect, it } from "vitest";
import { memoryCombatStore } from "./memoryStore";
import { xpForLevel } from "./progression";
import { chooseSubclass, equipCosmetic, getProgression, recordKill } from "./service";
import { signatureGrant, signatureTier } from "./weapons";
import { ENEMIES } from "./content";

const M = "00000000-0000-4000-8000-0000000000c2";
const now = new Date("2026-10-02T12:00:00Z");
async function member(on: boolean) {
  const c = memoryCombatStore(() => now);
  c.setSetting("classes_v2", on ? 1 : 0);
  c.setFamily(M, "Arcane"); c.fund(M, 1000);
  await c.store.grantXp(M, xpForLevel(10), "admin", "x", "v2-xp");
  return c;
}
const fox = ENEMIES.find(e => e.key === "shadow-fox")!.xp;

describe("classes v2 on the server, mirrored by the memory store (20261002181044_classes_v2)", () => {
  it("with the flag off nothing changes: no classes block, the fee, no mastery", async () => {
    const c = await member(false);
    await chooseSubclass(c.store, M, "elementalist", "v2-sub-1");
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.classes).toBeNull();
    expect(p.ok && p.data.fees.subclass_change).toBe(250);
    const k = await recordKill(c.store, M, "shadow-fox", "v2-kill-1");
    expect(k.ok && k.data.mastery).toBeNull();
    expect(await c.store.mastery(M)).toEqual([]);
    expect(await chooseSubclass(c.store, M, "illusionist", "v2-sub-2")).toMatchObject({ ok: true, data: { fee: 250 } });
  });
  it("with it on: the first choice is free and opens a mastery row; kills train it and report a level-up", async () => {
    const c = await member(true);
    expect(await chooseSubclass(c.store, M, "demo", "v2-sub-1")).toMatchObject({ ok: true, data: { subclass: "demo", fee: 0 } });
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.classes).toMatchObject({ kit: "demo", mastery: { mastery: 1, xp: 0, needed: 800 }, title: "Demo Adept", repick: null, kits: ["demo", "elementalist", "illusionist", "necromancer", "transmuter"],
      next: { at: 3, what: ["New ability: Mending Sigil"] } });
    expect(p.ok && p.data.fees.subclass_change).toBe(0);
    c.setMasteryXp(M, "demo", 800 - fox);
    const k = await recordKill(c.store, M, "shadow-fox", "v2-kill-1");
    expect(k.ok && k.data.mastery).toMatchObject({ mastery: 2, xp: 800, levelled_up: true });
    const again = await recordKill(c.store, M, "shadow-fox", "v2-kill-1");
    expect(again.ok && again.data.mastery).toBeNull(); // a replay trains nothing
    await c.store.grantXp(M, 2000, "event", "x", "v2-event");
    expect((await c.store.mastery(M))[0].xp).toBe(800); // club events raise the character, not mastery
  });
  it("gives the profile its class fields: icon, subclass, mastery and title, frame, the others past mastery 1", async () => {
    const c = await member(true);
    await chooseSubclass(c.store, M, "demo", "v2-sub-1");
    c.setMasteryXp(M, "demo", 18_000); c.setMasteryXp(M, "elementalist", 900); c.setMasteryXp(M, "illusionist", 10);
    await equipCosmetic(c.store, M, "demo", "frame", "mastery:bronze");
    const p = await getProgression(c.store, M);
    expect(p.ok && p.data.classes?.profile).toEqual({ icon: "/assets/game/classes/demo.svg", subclass: "demo", name: "Demo Adept", mastery: 10, title: "Adept Demo Adept",
      frame: "mastery:bronze", mastered: false, others: [{ subclass: "elementalist", mastery: 2, icon: "/assets/game/classes/elementalist.svg" }] });
  });
  it("locks the choice; a repick token (a paid reading, the launch gift) pays for one change and is spent", async () => {
    const c = await member(true);
    await chooseSubclass(c.store, M, "demo", "v2-sub-1");
    expect(await chooseSubclass(c.store, M, "elementalist", "v2-sub-2")).toMatchObject({ ok: false, code: "locked" });
    c.grantRepick(M, "oracle");
    expect(await chooseSubclass(c.store, M, "elementalist", "v2-sub-3")).toMatchObject({ ok: true, data: { fee: 0 } });
    expect(c.coinsOf(M)).toBe(1000);
    expect(await chooseSubclass(c.store, M, "elementalist", "v2-sub-3")).toMatchObject({ ok: true, data: { replayed: true } });
    expect(await chooseSubclass(c.store, M, "demo", "v2-sub-4")).toMatchObject({ ok: false, code: "locked" });
    expect((await c.store.mastery(M)).map(r => r.subclass).sort()).toEqual(["demo", "elementalist"]); // each subclass keeps its row
  });
  it("cosmetics: owned items of the right kind, mastery ones by level, null takes off", async () => {
    const c = await member(true);
    await chooseSubclass(c.store, M, "demo", "v2-sub-1");
    const skin = "00000000-0000-4000-8000-00000000c051";
    expect(await equipCosmetic(c.store, M, "demo", "weapon_skin", skin)).toMatchObject({ ok: false, code: "not_owned" });
    c.own(M, skin, "weapon_skin", "elementalist");
    expect(await equipCosmetic(c.store, M, "demo", "weapon_skin", skin)).toMatchObject({ ok: false, code: "bad_cosmetic" });
    c.own(M, skin, "weapon_skin", "demo");
    expect(await equipCosmetic(c.store, M, "demo", "weapon_skin", skin)).toMatchObject({ ok: true, data: { weapon_skin: skin } });
    expect(await equipCosmetic(c.store, M, "demo", "frame", "mastery:bronze")).toMatchObject({ ok: false, code: "locked" });
    c.setMasteryXp(M, "demo", 7000);
    expect(await equipCosmetic(c.store, M, "demo", "frame", "mastery:bronze")).toMatchObject({ ok: true, data: { frame: "mastery:bronze", weapon_skin: skin } });
    expect(await equipCosmetic(c.store, M, "demo", "aura", "mastery:bronze")).toMatchObject({ ok: false, code: "bad_cosmetic" });
    expect(await equipCosmetic(c.store, M, "demo", "weapon_skin", null)).toMatchObject({ ok: true, data: { frame: "mastery:bronze" } });
    expect(await equipCosmetic(c.store, M, "illusionist", "frame", null)).toMatchObject({ ok: false, code: "not_found" });
  });
  it("suggests the Oracle's subclass for the member's reading, with the runner-up when a deciding letter is unclear", async () => {
    const c = await member(true);
    let p = await getProgression(c.store, M);
    expect(p.ok && p.data.classes?.suggestion).toBeNull(); // no reading on file
    c.setReading(M, "ENTJ", [{ dichotomy: "EI", clarity: 60 }, { dichotomy: "JP", clarity: 10 }]);
    p = await getProgression(c.store, M);
    expect(p.ok && p.data.classes?.suggestion).toMatchObject({ subclass: "necromancer", pair: "illusionist", reason: expect.stringContaining("army") });
  });
  it("signature weapons: tier 1 with none owned; nothing to grant before a wave seeds the type", () => {
    expect(signatureTier([])).toBe(1);
    expect(signatureTier(["sword-iron", "staff-sigil"])).toBe(1); // today's weapons aren't signature weapons
    expect(signatureTier(["prism-staff-1", "bone-tome-4"])).toBe(4); // a family wave's are
    expect(signatureGrant("elementalist", 3)?.key).toBe("prism-staff-3");
    expect(signatureGrant("priest", 3)?.key).toBe("sunstone-staff-3"); // the Warden wave's too
    expect(signatureGrant("demo", 3)).toBeNull(); // no wave seeds the dev kit's type
  });
});
