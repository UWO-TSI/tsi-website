"use client";

/**
 * Another player, on the same rig and clips as you (specs/multiplayer.md §5.4): their look from the card, the tool
 * wheel's item in the hand (PlayerAvatar's `heldView`), the weapon in hand or across the back (`WeaponView`), and the
 * leaf glider, which shows only while `motion.leaf` is open. The driver (RemoteAvatars) writes the anchor and the
 * motion every frame; React renders this only when their card or slow state changes.
 *
 * Never PlayerAvatar, InteriorPlayer or useWorldClips here: those listen to the window's events (tsi:sit, tsi:emote,
 * tsi:fish-*), which are yours (spec §10).
 */
import { Suspense, memo, useCallback, useMemo, type RefObject } from "react";
import type * as THREE from "three";
import Character, { type CharacterMotion, type HeldView, type WeaponView } from "../character/Character";
import { heldView } from "../PlayerAvatar";
import { DEFAULT_LOOK, parseLook, type CharacterLook } from "@/lib/game/character/look";
import { WEAPONS } from "@/lib/game/combat/data";
import { parseHeld } from "@/lib/net/protocol";
import type { RemotePlayer } from "@/lib/net/types";
import type { RemoteRig } from "./drive";

/** The card's look JSON ("" the default look; anything unreadable falls back to it too). */
export function remoteLook(json: string): CharacterLook {
  if (!json) return DEFAULT_LOOK;
  try { return parseLook(JSON.parse(json)); } catch { return DEFAULT_LOOK; }
}
/** What `held` draws in the hand (a tool, the furled leaf, a snack); weapons are `remoteWeapon`'s. */
export function remoteHeld(held: string): HeldView | null {
  const h = parseHeld(held);
  return h && h.kind !== "weapon" ? heldView({ id: held, kind: h.kind, key: h.key, name: "", icon: "" }) : null;
}
/** A weapon held from the wheel goes in the hand; otherwise the armed player's weapon rides on the back (row 140). */
export function remoteWeapon(held: string, back: string): WeaponView | null {
  const h = parseHeld(held), inHand = h?.kind === "weapon" ? h.key : null, w = WEAPONS[inHand ?? back];
  return w?.model ? { kind: w.kind, model: w.model, modelScale: w.modelScale, inHand: !!inHand, grip: w.grip, pulse: w.pulse } : null;
}

/** The anchor is the driver's to move (module scope: the react compiler forbids writing through props). */
function attachAnchor(rig: RemoteRig, group: THREE.Group | null) { rig.anchor.current = group; }

export const RemoteAvatar = memo(function RemoteAvatar({ rig, player, walkSpeed }: { rig: RemoteRig; player: RemotePlayer; walkSpeed: number }) {
  const anchor = useCallback((g: THREE.Group | null) => attachAnchor(rig, g), [rig]);
  const look = useMemo(() => remoteLook(player.look), [player.look]);
  const held = useMemo(() => remoteHeld(player.held), [player.held]);
  const weapon = useMemo(() => remoteWeapon(player.held, player.armed ? player.weapon : ""), [player.held, player.armed, player.weapon]);
  // Character's parent is the anchor: its contact shadow sits there, at the floor. Hidden until the driver places it.
  return <group ref={anchor} visible={false}>
    <Suspense fallback={null}>
      <Character look={look} motion={rig.live as RefObject<CharacterMotion>} walkSpeed={walkSpeed} weapon={weapon} held={held} leaf />
    </Suspense>
  </group>;
});
