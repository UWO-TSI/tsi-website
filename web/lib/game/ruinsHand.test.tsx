import { act, createElement, useMemo, useState } from "react";
import { reconciler } from "@react-three/fiber";
import { describe, expect, it } from "vitest";
import { combat, createRuntime, publishCombat, setOwnedWeapons, useCombatValue } from "./combat/runtime";
import { holdItem, readHeld, useHeld } from "./heldStore";
import { useRuinsHand } from "./ruinsHand";
import { heldItem, wheelContents } from "./toolWheel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** DefaultIslandWorld's wiring of the ruins' hand, on a renderer with no DOM (R3F's reconciler, nothing drawn). */
let renders = 0, setDefault: (w: string | null) => void = () => {};
const picks: string[] = [];
function Hand() {
  if (++renders > 200) throw new Error("render loop");
  const heldState = useHeld();
  const weaponList = useCombatValue(() => combat.rt.player.owned.join(","));
  const runtimeWeapon = useCombatValue(() => combat.rt.player.weapon);
  const [defaultWeapon, set] = useState<string | null>(null);
  setDefault = set;
  const items = useMemo(() => wheelContents({ site: "ruins", owned: [], weapons: weaponList.split(","), defaultWeapon, armed: true, pins: [], stock: {} }), [weaponList, defaultWeapon]);
  useRuinsHand("ruins", items, heldItem(heldState, items), runtimeWeapon, w => picks.push(w));
  return null;
}

describe("the ruins' hand (the wheel and the weapon in hand)", () => {
  it("settles when the server's equipped weapon arrives after the hand was set (no stored held item, not the driftwood sword)", async () => {
    combat.rt = createRuntime();
    const errors: unknown[] = [], err = (e: unknown) => { errors.push(e); };
    // react-reconciler 0.31's ten arguments, as R3F's own createRoot passes them (its types list a newer eleventh).
    const create = reconciler.createContainer as (...a: unknown[]) => ReturnType<typeof reconciler.createContainer>;
    const root = create({}, 1, null, false, null, "", err, err, err, null);
    await act(async () => { reconciler.updateContainer(createElement(Hand), root, null, null); });
    expect(readHeld().held).toBe("weapon:sword-driftwood");
    renders = 0;
    // The progression load: the server's equipped weapon goes in hand and becomes the wheel's default.
    await act(async () => {
      setOwnedWeapons(combat.rt, [{ weapon_key: "bow-willow", durability: 90, equipped: true }]);
      setDefault("bow-willow");
      publishCombat();
    });
    expect(errors.map(String)).toEqual([]);
    expect(renders).toBeLessThan(10);
    expect(combat.rt.player.weapon).toBe("bow-willow");
    expect(readHeld().held).toBe("weapon:bow-willow");
    expect(picks).toEqual([]); // the server's own choice is never posted back over itself
    // A wheel pick still puts that weapon in hand and posts it.
    await act(async () => { holdItem("weapon:staff-oak"); });
    expect(combat.rt.player.weapon).toBe("staff-oak");
    expect(picks).toEqual(["staff-oak"]);
    // A pick landing in the same render as the hand moving elsewhere: the pick wins, once.
    renders = 0;
    await act(async () => { holdItem("weapon:bow-willow"); combat.rt.player.weapon = "sword-driftwood"; publishCombat(); });
    expect(errors.map(String)).toEqual([]);
    expect(renders).toBeLessThan(10);
    expect([combat.rt.player.weapon, readHeld().held]).toEqual(["bow-willow", "weapon:bow-willow"]);
    await act(async () => { reconciler.updateContainer(null, root, null, null); });
  });
});
