"use client";

/**
 * The player's bars, top left (David 2026-10-28: "the user shoud have a health, stamina, and exp bar, and everything
 * should be when exp is filled"; specs/design-bible.md UI 8), on the flat kit's StatBar:
 * - health: the combat runtime's hp of maxHp (full on the island), always on;
 * - XP: the HUD's total as levels (lib/combat/progression.ts levelProgress), always on; the level badge beside it in the
 *   UI view (`full`, Esc 1; bible UI 8b). A gain fills it; a level up fills
 *   it to the end, says so (LEVEL_FILLED: the level-up card plays then), and rolls it over to what's left;
 * - stamina: the movement sim's (lib/game/movement/sim.ts), written by the avatar each frame (hudLive), on its own pill
 *   while it's used and gone 1.5 s after it's full again; run out, it turns warm and shakes once.
 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { StatBar, StatBars } from "@/components/gui/flat";
import { levelProgress } from "@/lib/combat/progression";
import { combat, useCombatValue } from "@/lib/game/combat/runtime";
import { hudLive, useHud } from "@/lib/game/hudStore";

/** Fired as the XP bar reaches its end on a level up (detail: { level }). */
export const LEVEL_FILLED = "tsi:level-filled";
/** How long the bar takes to fill to its end before the level turns over; how long a full stamina bar stays. */
const FILL_MS = 650, STAMINA_OUT_MS = 1500;

interface XpView { level: number; fill: number; snap: boolean }
const fillOf = (xp: number) => { const p = levelProgress(xp); return { level: p.level, fill: p.needed ? p.into / p.needed : 1 }; };

/** The XP bar as it shows: follows the total, filling to the end and rolling over on a level up. */
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
      show({ level: was.level, fill: 1, snap: false });
      timers.push(window.setTimeout(() => window.dispatchEvent(new CustomEvent(LEVEL_FILLED, { detail: { level: next.level } })), FILL_MS));
      show({ level: next.level, fill: 0, snap: true }, FILL_MS + 120);
      show({ ...next, snap: false }, FILL_MS + 180);
    }
    return () => timers.forEach(t => window.clearTimeout(t));
  }, [xp]);
  // Not read yet (or signed out): level 1, empty; the first total read snaps in, never a level up.
  return xp === null ? { level: 1, fill: 0, snap: true } : view;
}

/** Stamina's pill: written to its element every frame (no render), shown while it's below full. */
function useStamina(el: RefObject<HTMLDivElement | null>) {
  const [shown, setShown] = useState(false), [low, setLow] = useState(false);
  useEffect(() => {
    let frame = 0, fullSince = 0, on = false, winded = false;
    const tick = (now: number) => {
      el.current?.style.setProperty("--v", String(hudLive.stamina));
      const full = hudLive.stamina >= 1;
      if (!full) fullSince = 0; else if (!fullSince) fullSince = now;
      const want = !full || now - fullSince < STAMINA_OUT_MS;
      if (want !== on) setShown(on = want);
      if (hudLive.winded !== winded) setLow(winded = hudLive.winded);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [el]);
  return { shown, low };
}

export default function HudBars({ hidden, full, className }: { hidden?: boolean; full?: boolean; className?: string }) {
  const hud = useHud();
  const hp = useCombatValue(() => combat.rt.player.hp), maxHp = useCombatValue(() => combat.rt.player.maxHp);
  const xp = useXpBar(hud.xp);
  const staminaEl = useRef<HTMLDivElement>(null);
  const stamina = useStamina(staminaEl);
  const health = maxHp > 0 ? hp / maxHp : 1;
  return <div className={className}>
    <StatBars hidden={hidden}>
      <StatBar kind="health" value={health} label={`Health ${Math.round(hp)} of ${Math.round(maxHp)}`} />
      {xp && <StatBar kind="xp" value={xp.fill} snap={xp.snap} badge={full ? `Lv ${xp.level}` : null} label={`Level ${xp.level}, ${Math.round(xp.fill * 100)}% of the way to the next`} />}
    </StatBars>
    <StatBar ref={staminaEl} kind="stamina" value={1} live alone shown={stamina.shown && !hidden} low={stamina.low} label={stamina.low ? "Stamina run out" : "Stamina"} />
  </div>;
}
