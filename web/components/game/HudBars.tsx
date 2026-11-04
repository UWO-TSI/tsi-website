"use client";

/**
 * The player's vitals and level, top left (specs/design-bible.md UI 8, 8b; David's r3 review: "stamina should be with
 * health and eventually there might be a shield or mana bar for different classes"), on the flat kit's vitals:
 * - the level ring: the HUD's total as levels (lib/combat/progression.ts levelProgress), the XP into the level round the
 *   number; hover or a tap shows the exact XP. A gain fills it; a level up fills it to the end, says so (LEVEL_FILLED:
 *   the level-up moment plays then), and rolls it over to what's left;
 * - the vitals' stack beside it: health (the combat runtime's hp of maxHp, full on the island) and stamina (the movement
 *   sim's, lib/game/movement/sim.ts, written by the avatar each frame to hudLive), both always there; stamina rests dimmer
 *   1.5 s after it's full again, and shakes once as it runs out. A class's shield or mana would be one more row.
 *   Health at CRITICAL or under (lib/game/lowHealth.ts) flashes and its heart beats; the world's side is PostFX's.
 * On the white card (r5: "keep the full card, but keep in mind for shield or mana": a class's bar is one more row).
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { VitalBar, Vitals, XpRing } from "@/components/gui/flat";
import { levelProgress } from "@/lib/combat/progression";
import { combat, useCombatValue } from "@/lib/game/combat/runtime";
import { hudLive, useHud } from "@/lib/game/hudStore";
import { CRITICAL } from "@/lib/game/lowHealth";

/** Fired as the XP ring reaches its end on a level up (detail: { level }). */
export const LEVEL_FILLED = "tsi:level-filled";
/** How long the ring takes to fill to its end before the level turns over; how long a full stamina bar stays bright. */
const FILL_MS = 650, STAMINA_REST_MS = 1500;

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

/** Stamina's bar: written to its element every frame (no render); quiet while it's been full a moment. */
function useStamina(el: RefObject<HTMLDivElement | null>) {
  const [quiet, setQuiet] = useState(true), [low, setLow] = useState(false);
  useEffect(() => {
    let frame = 0, fullSince = 0, rest = true, winded = false;
    const tick = (now: number) => {
      el.current?.style.setProperty("--vital", String(hudLive.stamina));
      if (hudLive.stamina < 1) fullSince = 0; else if (!fullSince) fullSince = now;
      const want = !!fullSince && now - fullSince >= STAMINA_REST_MS;
      if (want !== rest) setQuiet(rest = want);
      if (hudLive.winded !== winded) setLow(winded = hudLive.winded);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [el]);
  return { quiet, low };
}

export default function HudBars({ hidden, className }: { hidden?: boolean; className?: string }) {
  const hud = useHud();
  const hp = useCombatValue(() => combat.rt.player.hp), maxHp = useCombatValue(() => combat.rt.player.maxHp);
  const xp = useXpBar(hud.xp);
  const staminaEl = useRef<HTMLDivElement>(null);
  const stamina = useStamina(staminaEl);
  const health = maxHp > 0 ? hp / maxHp : 1;
  return <div className={className}>
    {xp && <XpRing level={xp.level} fill={xp.fill} snap={xp.snap} into={xp.into} needed={xp.needed} hidden={hidden} />}
    <Vitals hidden={hidden}>
      <VitalBar kind="health" value={health} max={maxHp} critical={health <= CRITICAL} label={`Health ${Math.round(hp)} of ${Math.round(maxHp)}`} />
      <VitalBar ref={staminaEl} kind="stamina" value={1} live quiet={stamina.quiet} low={stamina.low} label={stamina.low ? "Stamina run out" : "Stamina"} />
    </Vitals>
  </div>;
}
