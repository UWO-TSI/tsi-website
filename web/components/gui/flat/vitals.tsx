"use client";

/**
 * The player's vitals and level, top left (specs/design-bible.md UI 8, 8b; David's r3 review: "eventually there might be
 * a shield or mana bar for different classes", "all the bars should change color as it depleats, so perifiral visiion
 * you cna tell how youre doing and have tallies for every like 20", "exp bar should exists somewhere seperate, maybe a
 * circular bar around a number somewhere and hover shows specific xp amount"; r6: the vitals "needs to be reimagined").
 * - `Vitals`: the level ring and the `VitalBar` rows as one piece, in a `look` (r7 pitch, David picks one):
 *   capsule (the ring at the head of a thick rimmed bar), hearts (a heart per 20 points on a white pill) or dial (health
 *   as an arc round the ring, on one white medallion). A class's shield or mana is one more row (its kind is here).
 * - `VitalBar`: icon and track; the fill slides from its full colour through amber to its low colour as it empties, so
 *   it reads from the corner of the eye; a thin notch every 20 points of `max`. `critical` (r4: "more red and critical
 *   and flashes"): the well flashes red and the icon beats like a heart (both still under reduced motion: a red well).
 * - `XpRing`: the level number in a round ring that fills with the XP into the level; hover, focus or a tap shows the
 *   exact XP (the kit's HoverTip).
 * - `StaminaArc` (r6: "stamina could be rewored to not be a bar under health but rather incorporated to be beside the
 *   character and fades in a ) shaped bar beside the character when stamina is low but doesnt show when it is above
 *   25%"): a ")" beside the character; the host writes `--vital`, where it stands (`--x`, `--y`, `--h`, fractions of
 *   its layer) and `data-show`.
 * Colours: the theme's --ui-* tokens. Shown on /lab/gui.
 */
import type { CSSProperties, ReactNode, Ref } from "react";
import { Droplet, Heart, Shield } from "lucide-react";
import { HoverTip } from "./pieces";
import v from "./vitals.module.css";

export type VitalKind = "health" | "shield" | "mana";
export type VitalsLook = "capsule" | "hearts" | "dial";
export const VITALS_LOOKS: readonly VitalsLook[] = ["capsule", "hearts", "dial"];
const ICON = { health: Heart, shield: Shield, mana: Droplet } as const;
/** One notch every this many points. */
export const TALLY = 20;

/** One vital, `value` 0 to 1 of `max` points; the fill eases (a little spring). `critical`: nearly gone
 * (lib/game/lowHealth.ts CRITICAL), it flashes. */
export function VitalBar({ kind, value, max = 100, label, critical }: { kind: VitalKind; value: number; max?: number; label: string; critical?: boolean }) {
  const Icon = ICON[kind];
  return <div className={v.bar} data-kind={kind} data-critical={critical || undefined}
    style={{ "--vital": Math.max(0, Math.min(1, value)), "--tally": TALLY / Math.max(TALLY, max), "--n": Math.max(1, Math.round(max / TALLY)) } as CSSProperties}
    role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
    <Icon className={v.icon} size={14} strokeWidth={2.75} aria-hidden />
    <span className={v.track} aria-hidden><i /></span>
  </div>;
}

/** The vitals: the level `ring` and the rows, in one `look`. */
export function Vitals({ look = "capsule", ring, children, hidden }: { look?: VitalsLook; ring?: ReactNode; children: ReactNode; hidden?: boolean }) {
  return <div className={v.hud} data-look={look} data-hidden={hidden || undefined}>
    {ring}
    <div className={v.card} data-testid="hud-vitals">{children}</div>
  </div>;
}

/** Stamina beside the character: a ")" that fills from the bottom. Hidden unless the host sets `data-show`. */
export function StaminaArc({ ref, hidden }: { ref?: Ref<HTMLDivElement>; hidden?: boolean }) {
  return <div ref={ref} className={v.arc} data-hidden={hidden || undefined} data-testid="hud-stamina" role="meter" aria-label="Stamina" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}>
    <svg viewBox="0 0 30 100" aria-hidden>
      <path className={v.arcRim} d={ARC} /><path className={v.arcWell} d={ARC} /><path className={v.arcFill} d={ARC} pathLength={1} />
    </svg>
  </div>;
}
/** The ")" from the bottom up, bulging right. */
const ARC = "M5 95 A62 62 0 0 0 5 5";

/**
 * The level in a ring of XP: `fill` 0 to 1 of the way to the next level (`snap` sets it without the ease, as it rolls
 * over on a level up); `into` of `needed` XP for the tip (`needed` 0: the top level).
 */
export function XpRing({ level, fill, snap, into, needed }: { level: number; fill: number; snap?: boolean; into: number; needed: number }) {
  const tip = <span className={v.tip}>
    <b>Level {level}</b>
    {needed ? <><span>{Math.round(into).toLocaleString()} / {needed.toLocaleString()} XP</span><small>{Math.max(0, Math.round(needed - into)).toLocaleString()} XP to level {level + 1}</small></> : <span>The top level</span>}
  </span>;
  return <HoverTip tip={tip}>
    <button type="button" className={v.ring} onClick={e => e.currentTarget.focus()} data-snap={snap || undefined} data-testid="hud-xp"
      style={{ "--xp": Math.max(0, Math.min(1, fill)) } as CSSProperties} aria-label={needed ? `Level ${level}, ${Math.round(into)} of ${needed} XP` : `Level ${level}, the top level`}>
      <svg viewBox="0 0 48 48" aria-hidden><circle className={v.ringWell} cx="24" cy="24" r="20" /><circle className={v.ringFill} cx="24" cy="24" r="20" pathLength={1} /></svg>
      <span key={level} className={v.level}>{level}</span>
    </button>
  </HoverTip>;
}
