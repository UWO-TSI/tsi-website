"use client";

/**
 * Another player, on the same rig and clips as you (specs/multiplayer.md §5.4): their look from the card, the tool
 * wheel's item in the hand (PlayerAvatar's `heldView`), the weapon in hand or across the back (`WeaponView`), and the
 * leaf glider, which shows only while `motion.leaf` is open. The driver (RemoteAvatars) writes the anchor and the
 * motion every frame; React renders this only when their card or slow state changes.
 *
 * Never PlayerAvatar, InteriorPlayer or useWorldClips here: those listen to the window's events (tsi:sit, tsi:emote,
 * tsi:fish-*), which are yours (spec §10).
 *
 * v1: a click or tap on them opens their card (PlayerCard.tsx: add friend, wave, join, mute, block, report), through
 * one invisible capsule each (never the skinned body: the pointer would raycast every bone-deformed triangle). Under
 * mouse-look the click comes from the aim dot (useOrbitInput), which names them by the capsule's `pick`.
 */
import { Suspense, memo, useCallback, useMemo, type RefObject } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { openCard } from "./cards";
import Character, { type CharacterMotion, type HeldView, type WeaponView } from "../character/Character";
import { heldView } from "../PlayerAvatar";
import { RESIDENT_STEPS, useStepDust, type StepWorld } from "../movement/moveFx";
import { DEFAULT_LOOK, parseLook, type CharacterLook } from "@/lib/game/character/look";
import { WEAPONS } from "@/lib/game/combat/data";
import { parseHeld } from "@/lib/net/protocol";
import type { RemotePlayer } from "@/lib/net/types";
import type { RemoteRig } from "./drive";
import { FX_BENCH, useFxBench } from "@/lib/game/perf/fxBench";
import { benchBack, benchHeld } from "./benchFx";

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

/** Their footsteps' dust, silent and lighter than yours, like the residents' (the village and the café only). */
function RemoteDust({ rig, ground }: { rig: RemoteRig; ground?: StepWorld }) {
  useStepDust(rig.dust as RefObject<CharacterMotion>, rig.anchor, ground, RESIDENT_STEPS);
  return null;
}

/** The hit capsule every remote shares: about their height, drawn by nothing (an invisible material is never rendered). */
const HIT_GEO = new THREE.CylinderGeometry(0.42, 0.42, 1.5, 8), HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
/** A click on someone drawn opens their card (module scope). */
function cardFor(rig: RemoteRig, e: ThreeEvent<MouseEvent>) {
  if (rig.anchor.current?.visible !== true) return;
  e.stopPropagation();
  e.nativeEvent.preventDefault();
  const p = rig.entry.player;
  openCard({ uid: p.uid, name: p.name, sid: p.sid, member: p.member });
}
function pointerOver(rig: RemoteRig, on: boolean, e: ThreeEvent<PointerEvent>) {
  if (on && rig.anchor.current?.visible !== true) return;
  e.stopPropagation();
  document.body.style.cursor = on ? "pointer" : "auto";
}

/** The anchor is the driver's to move (module scope: the react compiler forbids writing through props). */
function attachAnchor(rig: RemoteRig, group: THREE.Group | null) { rig.anchor.current = group; }

export const RemoteAvatar = memo(function RemoteAvatar({ rig, player, walkSpeed, dust, ground }: {
  rig: RemoteRig; player: RemotePlayer; walkSpeed: number;
  /** Step dust here (the village and the café), thrown on `ground` (none: a plain floor's). */
  dust: boolean; ground?: StepWorld;
}) {
  const anchor = useCallback((g: THREE.Group | null) => attachAnchor(rig, g), [rig]);
  const look = useMemo(() => remoteLook(player.look), [player.look]);
  // Development (the effect bench): forced or switched-off items stand in for theirs.
  const fx = useFxBench();
  const heldKey = FX_BENCH ? benchHeld(fx, rig.sid, player.held) : player.held, back = player.armed ? (FX_BENCH ? benchBack(fx, player.weapon) : player.weapon) : "";
  const held = useMemo(() => remoteHeld(heldKey), [heldKey]);
  const weapon = useMemo(() => remoteWeapon(heldKey, back), [heldKey, back]);
  // Character's parent is the anchor: its contact shadow sits there, at the floor. Hidden until the driver places it.
  return <group ref={anchor} visible={false}>
    <Suspense fallback={null}>
      <Character look={look} motion={rig.live as RefObject<CharacterMotion>} walkSpeed={walkSpeed} weapon={weapon} held={held} leaf={!FX_BENCH || !fx.off.has("leaf")} remote keepFace />
    </Suspense>
    {dust && <RemoteDust rig={rig} ground={ground} />}
    <mesh geometry={HIT_GEO} material={HIT_MAT} position={[0, 0.75, 0]} userData={{ pick: player.name }} onClick={e => cardFor(rig, e)}
      onPointerOver={e => pointerOver(rig, true, e)} onPointerOut={e => pointerOver(rig, false, e)} />
  </group>;
});
