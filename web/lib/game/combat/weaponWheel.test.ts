/** The ruins' weapon by the tool wheel (specs/game-ui.md §3): the wheel takes one out, R goes back to the previous. */
import { describe, expect, it } from "vitest";
import { createRuntime, setOwnedWeapons, setWeapon } from "./runtime";
import { triggerAbility } from "./actions";
import { wheelContents } from "@/lib/game/toolWheel";

describe("the ruins' weapon", () => {
  it("starts on the weapon equipped in the database, with the owned ones and the starters on the wheel", () => {
    const rt = createRuntime();
    setOwnedWeapons(rt, [{ weapon_key: "sword-driftwood", durability: 90, equipped: false }, { weapon_key: "sword-iron", durability: 120, equipped: true }, { weapon_key: "shield-buckler", durability: 90, equipped: false }]);
    expect(rt.player.weapon).toBe("sword-iron");
    const wheel = wheelContents({ site: "ruins", owned: [], weapons: rt.player.owned, defaultWeapon: rt.player.weapon, armed: true, pins: [], stock: {} });
    expect(wheel[0].id).toBe("weapon:sword-iron");
    expect(wheel.map(i => i.key)).toEqual(expect.arrayContaining(["bow-willow", "staff-oak", "tome-spirits", "wraps-cloth"]));
    expect(wheel.map(i => i.key)).not.toContain("shield-buckler"); // no look yet, never in hand
  });

  it("takes the wheel's pick in hand, and R swaps back to the previous one and forth", () => {
    const rt = createRuntime();
    expect(setWeapon(rt, "staff-oak")).toBe(true);
    expect(rt.player).toMatchObject({ weapon: "staff-oak", prev: "sword-driftwood" });
    expect(triggerAbility(rt, "swap")).toBe(true);
    expect(rt.player).toMatchObject({ weapon: "sword-driftwood", prev: "staff-oak" });
    rt.cooldowns.swap = 0;
    expect(triggerAbility(rt, "swap")).toBe(true);
    expect(rt.player.weapon).toBe("staff-oak");
    // Not yours, unknown or already in hand: nothing changes.
    expect(setWeapon(rt, "sword-guardian")).toBe(false);
    expect(setWeapon(rt, "made-up")).toBe(false);
    expect(setWeapon(rt, "staff-oak")).toBe(false);
  });

  it("swaps to the next weapon when there's no previous one", () => {
    const rt = createRuntime();
    expect(triggerAbility(rt, "swap")).toBe(true);
    expect(rt.player.weapon).toBe(rt.player.owned[1]);
  });
});
