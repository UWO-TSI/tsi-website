"use client";

/**
 * The hand in the ruins: the tool wheel's held item (this device's, heldStore) and the encounter's weapon in hand
 * (combat.rt) kept in step. In the ruins a weapon is always in hand: what you held outside isn't on its wheel. A
 * weapon picked on the wheel goes in hand (and becomes your default on the server, `onPick`); the hand changing
 * (R's swap back, the server's equipped weapon at load) moves the wheel with it.
 */
import { useEffect } from "react";
import { combat, publishCombat, setWeapon } from "./combat/runtime";
import { holdItem, readHeld, settleHeld } from "./heldStore";
import type { WheelItem, WheelSite } from "./toolWheel";

export function useRuinsHand(site: WheelSite | string, wheelItems: readonly WheelItem[], held: WheelItem | null, runtimeWeapon: string, onPick: (weapon: string) => void) {
  useEffect(() => {
    if (site === "ruins") settleHeld(wheelItems, `weapon:${combat.rt.player.weapon}`);
    if (site === "ruins" && !readHeld().held) holdItem(`weapon:${combat.rt.player.weapon}`);
  }, [wheelItems, site]);
  // Keyed on the pick, not the item: the wheel rebuilds its items whenever its contents change (the server's weapons
  // arriving), and a stale item fired at the hand while the hand moved the wheel, back and forth forever.
  const pick = held?.kind === "weapon" ? held.key : null;
  useEffect(() => {
    if (!pick || !setWeapon(combat.rt, pick)) return;
    publishCombat();
    onPick(pick);
  }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps -- onPick is a fire-and-forget post
  // The hand as it is now (a pick in this same commit may have moved it), not as it was at render.
  useEffect(() => { const w = combat.rt.player.weapon; if (site === "ruins" && readHeld().held !== `weapon:${w}`) holdItem(`weapon:${w}`); }, [site, runtimeWeapon]);
}
