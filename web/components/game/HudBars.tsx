"use client";

/**
 * The player's vitals and level, top left (specs/design-bible.md UI 8, 8b; David's r3 review: "eventually there might be
 * a shield or mana bar for different classes"), on the flat kit's vitals:
 * - the level ring: the HUD's total as levels (lib/combat/progression.ts levelProgress), the XP into the level round the
 *   number; hover or a tap shows the exact XP. A gain fills it; a level up fills it to the end, says so (LEVEL_FILLED:
 *   the level-up moment plays then), and rolls it over to what's left;
 * - health (the combat runtime's hp of maxHp, full on the island) with the ring, in the kit's Capsule look (David
 *   11-05). At CRITICAL or under (lib/game/lowHealth.ts) it flashes; the world's side is PostFX's. A class's shield
 *   would extend the health bar (VitalBar `shield`), its mana one more bar;
 * - stamina (the movement sim's, lib/game/movement/sim.ts) beside the character, not in the card (r6: "fades in a )
 *   shaped bar beside the character when stamina is low but doesnt show when it is above 25%"): the kit's StaminaArc,
 *   placed after each frame is drawn (the camera final, as LabelLayer does) from where the avatar is (hudLive):
 *   beside the body as it is drawn, through the world's bend, on its right at any turn and tilt, and the same size on
 *   screen at any zoom (r8: "it should be beside the character even when zoomed out, it should always be to the right
 *   of the character and adaptive to camera angels").
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { addAfterEffect } from "@react-three/fiber";
import { Vector3, type Camera } from "three";
import { StaminaArc, VitalBar, Vitals, XpRing } from "@/components/gui/flat";
import { CHARACTER_HEIGHT } from "@/components/game/character/Character";
import { levelProgress } from "@/lib/combat/progression";
import { combat, useCombatValue } from "@/lib/game/combat/runtime";
import { hudLive, useHud } from "@/lib/game/hudStore";
import { CRITICAL } from "@/lib/game/lowHealth";
import { projectCurved, type ScreenPoint } from "./net/projection";

/** Fired as the XP ring reaches its end on a level up (detail: { level }). */
export const LEVEL_FILLED = "tsi:level-filled";
/** How long the ring takes to fill to its end before the level turns over. */
const FILL_MS = 650;
/** Stamina shows at or under this (r6: "doesnt show when it is above 25%"), and the arc is that last quarter: full as
 * it fades in, empty when you're winded. */
const STAMINA_SHOW = 0.25;
/** The arc's middle is level with the body's (MID, character heights up) and its left end half the body's width
 * (HALF, character heights, past the hair) to its right; its size and the gap after that are the kit's, in pixels. */
const MID = 0.45, HALF = 0.32;
const right = new Vector3(), mid: ScreenPoint = { x: 0, y: 0, depth: 0 };

/** Where the arc's left middle goes, as shares of the canvas: level with the body's middle and past its right side on
 * screen (along the camera's right, so at any turn and tilt), both through the world's bend as the body is drawn
 * (round 8 projected flat, which put the arc over the head once zoomed out). False when the body is behind the camera. */
export function arcPlace(at: { x: number; y: number; z: number }, cam: Camera, out: ScreenPoint): boolean {
  const y = at.y + CHARACTER_HEIGHT * MID, r = CHARACTER_HEIGHT * HALF;
  right.setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(r);
  if (!projectCurved(at.x, y, at.z, cam, 1, 1, mid) || !projectCurved(at.x + right.x, y + right.y, at.z + right.z, cam, 1, 1, out)) return false;
  out.y = mid.y;
  return true;
}

interface XpView { level: number; fill: number; snap: boolean; into: number; needed: number }
const fillOf = (xp: number) => { const p = levelProgress(xp); return { level: p.level, fill: p.needed ? p.into / p.needed : 1, into: p.into, needed: p.needed }; };

/** The XP ring as it shows: follows the total, filling to the end and rolling over on a level up. */
function useXpBar(xp: number | null): XpView | null {
  const [view, setView] = useState<XpView | null>(null);
  const shown = useRef<XpView | null>(null);
  useEffect(() => {
    if (xp === null) return;
    const next = fillOf(xp), was = shown.current, timers: number[] = [];
    const show = (v: XpView, ms = 0) => timers.push(window.setTimeout(() => { shown.current = v; setView(v); }, ms));
    if (!was || next.level < was.level) show({ ...next, snap: true });
    else if (next.level === was.level) show({ ...next, snap: false });
    else {
      // A level up: to the end, the level turns over (the card plays), then the new level's share fills from empty.
      show({ ...was, fill: 1, into: was.needed, snap: false });
      timers.push(window.setTimeout(() => window.dispatchEvent(new CustomEvent(LEVEL_FILLED, { detail: { level: next.level } })), FILL_MS));
      show({ ...next, fill: 0, into: 0, snap: true }, FILL_MS + 120);
      show({ ...next, snap: false }, FILL_MS + 180);
    }
    return () => timers.forEach(t => window.clearTimeout(t));
  }, [xp]);
  // Not read yet (or signed out): level 1, empty; the first total read snaps in, never a level up.
  return xp === null ? { level: 1, fill: 0, snap: true, into: 0, needed: levelProgress(0).needed } : view;
}

/** The stamina arc: shown at a quarter or under, placed beside the character after each frame is drawn. */
function useStaminaArc(el: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const at: ScreenPoint = { x: 0, y: 0, depth: 0 };
    let shown = false, winded = false, hidAt = -1e9, now = 0;
    return addAfterEffect(t => {
      const arc = el.current, cam = hudLive.camera;
      if (!arc || !cam) return;
      now = t;
      const st = hudLive.stamina, show = st <= STAMINA_SHOW;
      if (show !== shown) { shown = show; arc.toggleAttribute("data-show", show); if (!show) hidAt = now; }
      if (hudLive.winded !== winded) arc.toggleAttribute("data-low", (winded = hudLive.winded));
      if (!show && now - hidAt > 500) return; // faded out: nothing to place
      arc.style.setProperty("--vital", Math.min(1, st / STAMINA_SHOW).toFixed(3)); // the arc is the last quarter, full as it shows
      arc.setAttribute("aria-valuenow", String(Math.round(st * 100)));
      if (!arcPlace(hudLive.at, cam, at)) return;
      arc.style.setProperty("--x", at.x.toFixed(4));
      arc.style.setProperty("--y", at.y.toFixed(4));
    });
  }, [el]);
}

export default function HudBars({ hidden, className }: { hidden?: boolean; className?: string }) {
  const hud = useHud();
  const hp = useCombatValue(() => combat.rt.player.hp), maxHp = useCombatValue(() => combat.rt.player.maxHp);
  const xp = useXpBar(hud.xp);
  const arcEl = useRef<HTMLDivElement>(null);
  useStaminaArc(arcEl);
  const health = maxHp > 0 ? hp / maxHp : 1;
  return <>
    <div className={className}>
      <Vitals hidden={hidden} ring={xp && <XpRing level={xp.level} fill={xp.fill} snap={xp.snap} into={xp.into} needed={xp.needed} />}>
        <VitalBar kind="health" value={health} max={maxHp} critical={health <= CRITICAL} label={`Health ${Math.round(hp)} of ${Math.round(maxHp)}`} />
      </Vitals>
    </div>
    <StaminaArc ref={arcEl} hidden={hidden} />
  </>;
}
