"use client";

/**
 * The player's vitals and level, top left (specs/design-bible.md UI 8, 8b; David's r3 review: "eventually there might be
 * a shield or mana bar for different classes"), on the flat kit's vitals:
 * - the level ring: the HUD's total as levels (lib/combat/progression.ts levelProgress), the XP into the level round the
 *   number; hover or a tap shows the exact XP. A gain fills it; a level up fills it to the end, says so (LEVEL_FILLED:
 *   the level-up moment plays then), and rolls it over to what's left;
 * - health (the combat runtime's hp of maxHp, full on the island) with the ring, in the kit's look (r7 pitch: capsule,
 *   hearts or dial; `?vitals=` picks one in dev until David chooses). At CRITICAL or under (lib/game/lowHealth.ts) it
 *   flashes and its heart beats; the world's side is PostFX's. A class's shield or mana would be one more row;
 * - stamina (the movement sim's, lib/game/movement/sim.ts) beside the character, not in the card (r6: "fades in a )
 *   shaped bar beside the character when stamina is low but doesnt show when it is above 25%"): the kit's StaminaArc,
 *   placed after each frame is drawn (the camera final, as LabelLayer does) from where the avatar is (hudLive).
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { addAfterEffect } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import { StaminaArc, VITALS_LOOKS, VitalBar, Vitals, XpRing, type VitalsLook } from "@/components/gui/flat";
import { CHARACTER_HEIGHT } from "@/components/game/character/Character";
import { levelProgress } from "@/lib/combat/progression";
import { combat, useCombatValue } from "@/lib/game/combat/runtime";
import { hudLive, useHud } from "@/lib/game/hudStore";
import { CRITICAL } from "@/lib/game/lowHealth";

/** Fired as the XP ring reaches its end on a level up (detail: { level }). */
export const LEVEL_FILLED = "tsi:level-filled";
/** How long the ring takes to fill to its end before the level turns over. */
const FILL_MS = 650;
/** Stamina shows at or under this (r6: "doesnt show when it is above 25%"), and the arc is that last quarter: full as
 * it fades in, empty when you're winded. The arc: its height as a share of the character's, and how far right of the
 * body's middle it stands (in body heights). */
const STAMINA_SHOW = 0.25, ARC_SIZE = 0.74, ARC_GAP = 0.34;

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
    const v = new Vector3();
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
      const { x, y, z } = hudLive.at;
      v.set(x, y + CHARACTER_HEIGHT * 0.45, z).project(cam);
      const mx = v.x, my = v.y;
      v.set(x, y + CHARACTER_HEIGHT * 0.95, z).project(cam);
      const body = v.y - my; // the body's height, as a share of the screen's (NDC spans 2; this is half a body of it)
      arc.style.setProperty("--x", String((mx + 1) / 2 + (body * ARC_GAP) / ((cam as PerspectiveCamera).aspect || 1)));
      arc.style.setProperty("--y", String((1 - my) / 2));
      arc.style.setProperty("--h", String(body * ARC_SIZE));
    });
  }, [el]);
}

/** The look in play: the pick, or `?vitals=` in dev while David chooses. */
const lookOf = (): VitalsLook => {
  const q = process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("vitals") : null;
  return VITALS_LOOKS.find(l => l === q) ?? "capsule";
};

export default function HudBars({ hidden, className }: { hidden?: boolean; className?: string }) {
  const hud = useHud();
  const hp = useCombatValue(() => combat.rt.player.hp), maxHp = useCombatValue(() => combat.rt.player.maxHp);
  const xp = useXpBar(hud.xp);
  const arcEl = useRef<HTMLDivElement>(null);
  useStaminaArc(arcEl);
  const [look] = useState(lookOf);
  const health = maxHp > 0 ? hp / maxHp : 1;
  return <>
    <div className={className}>
      <Vitals look={look} hidden={hidden} ring={xp && <XpRing level={xp.level} fill={xp.fill} snap={xp.snap} into={xp.into} needed={xp.needed} />}>
        <VitalBar kind="health" value={health} max={maxHp} critical={health <= CRITICAL} label={`Health ${Math.round(hp)} of ${Math.round(maxHp)}`} />
      </Vitals>
    </div>
    <StaminaArc ref={arcEl} hidden={hidden} />
  </>;
}
