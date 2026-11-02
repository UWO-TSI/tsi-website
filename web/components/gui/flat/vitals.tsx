"use client";

/**
 * The player's vitals and level, top left (specs/design-bible.md UI 8, 8b; David's r3 review: "stamina should be with
 * health and eventually there might be a shield or mana bar for different classes", "all the bars should change color
 * as it depleats, so perifiral visiion you cna tell how youre doing and have tallies for every like 20", "exp bar should
 * exists somewhere seperate, maybe a circular bar around a number somewhere and hover shows specific xp amount").
 * - `Vitals`: a stack of `VitalBar` rows (health, stamina; a class's shield or mana is one more row), on one soft white
 *   card, or `bare` straight over the world (r4: "idk if they should have a huge white pill": both, for David to pick).
 * - `VitalBar`: icon and track; the fill slides from its full colour through amber to its low colour as it empties, so
 *   it reads from the corner of the eye; a thin notch every 20 points of `max`. `critical` (r4: "more red and critical
 *   and flashes"): the well flashes red and the icon beats like a heart (both still under reduced motion: a red well).
 * - `XpRing`: the level number in a round ring that fills with the XP into the level; hover, focus or a tap shows the
 *   exact XP (the kit's HoverTip).
 * Colours: the theme's --ui-* tokens. Shown on /lab/gui.
 */
import type { CSSProperties, ReactNode, Ref } from "react";
import { Heart, Zap } from "lucide-react";
import { HoverTip } from "./pieces";
import v from "./vitals.module.css";

export type VitalKind = "health" | "stamina";
const ICON = { health: Heart, stamina: Zap } as const;
/** One notch every this many points. */
export const TALLY = 20;

/**
 * One vital, `value` 0 to 1 of `max` points. The fill eases (a little spring); `live` drops the ease for a value written
 * every frame to the element's `--vital`. `low`: run out (a shake, once). `quiet`: full and idle, it rests dimmer.
 * `critical`: nearly gone (lib/game/lowHealth.ts CRITICAL), it flashes.
 */
export function VitalBar({ kind, value, max = 100, label, live, low, quiet, critical, ref }: {
  kind: VitalKind; value: number; max?: number; label: string; live?: boolean; low?: boolean; quiet?: boolean; critical?: boolean; ref?: Ref<HTMLDivElement>;
}) {
  const Icon = ICON[kind];
  return <div ref={ref} className={v.bar} data-kind={kind} data-live={live || undefined} data-low={low || undefined} data-quiet={quiet || undefined} data-critical={critical || undefined}
    style={{ "--vital": Math.max(0, Math.min(1, value)), "--tally": TALLY / Math.max(TALLY, max) } as CSSProperties}
    role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
    <Icon className={v.icon} size={14} strokeWidth={2.75} aria-hidden />
    <span className={v.track} aria-hidden><i /></span>
  </div>;
}

/** The vitals: the rows stacked, on one soft white card or `bare` over the world. */
export function Vitals({ children, hidden, bare }: { children: ReactNode; hidden?: boolean; bare?: boolean }) {
  return <div className={v.card} data-hidden={hidden || undefined} data-bare={bare || undefined} data-testid="hud-vitals">{children}</div>;
}

/**
 * The level in a ring of XP: `fill` 0 to 1 of the way to the next level (`snap` sets it without the ease, as it rolls
 * over on a level up); `into` of `needed` XP for the tip (`needed` 0: the top level).
 */
export function XpRing({ level, fill, snap, into, needed, hidden }: { level: number; fill: number; snap?: boolean; into: number; needed: number; hidden?: boolean }) {
  const tip = <span className={v.tip}>
    <b>Level {level}</b>
    {needed ? <><span>{Math.round(into).toLocaleString()} / {needed.toLocaleString()} XP</span><small>{Math.max(0, Math.round(needed - into)).toLocaleString()} XP to level {level + 1}</small></> : <span>The top level</span>}
  </span>;
  return <HoverTip tip={tip}>
    <button type="button" className={v.ring} onClick={e => e.currentTarget.focus()} data-hidden={hidden || undefined} data-snap={snap || undefined} data-testid="hud-xp"
      style={{ "--xp": Math.max(0, Math.min(1, fill)) } as CSSProperties} aria-label={needed ? `Level ${level}, ${Math.round(into)} of ${needed} XP` : `Level ${level}, the top level`}>
      <svg viewBox="0 0 48 48" aria-hidden><circle className={v.ringWell} cx="24" cy="24" r="20" /><circle className={v.ringFill} cx="24" cy="24" r="20" pathLength={1} /></svg>
      <span key={level} className={v.level}>{level}</span>
    </button>
  </HoverTip>;
}
