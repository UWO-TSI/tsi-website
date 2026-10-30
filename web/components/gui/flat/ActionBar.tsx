import type { ReactNode } from "react";
import { Keycap } from "@/components/gui";
import f from "./flat.module.css";

/**
 * An action bar (the volleyball match's moves, David 2026-10-30: "should have a character action icon to show what it
 * does"): one white card per move with a pictogram of the move, its key and its name. A slot that would connect now
 * glows (`ready`); a press flashes it (`flash` changes, `ok` false for a whiff); an action not open now is quiet
 * (`off`). Several bars can sit in one `ActionBar` stack and swap without moving (`active` names the one shown): the
 * ground's moves and the air's, crossfading in place.
 */
export interface ActionSlot { id: string; label: string; keycap: string; icon: ReactNode; ready?: boolean; off?: boolean }

export function ActionBar({ rows, active, flash }: {
  rows: Record<string, ActionSlot[]>; active: string;
  /** The last press: which slot, a counter that changes with each press, and whether it connected. */
  flash?: { id: string; n: number; ok: boolean } | null;
}) {
  return <div className={f.actionStack}>
    {Object.entries(rows).map(([name, slots]) => (
      <div key={name} className={f.actionBar} data-active={name === active || undefined} aria-hidden={name !== active} role="group" aria-label={`${name} moves`}>
        {slots.map(s => {
          const hit = flash && name === active && flash.id === s.id;
          return <div key={hit ? `${s.id}-${flash!.n}` : s.id} className={f.actionSlot} data-ready={s.ready || undefined} data-off={s.off || undefined}
            data-flash={hit ? (flash!.ok ? "ok" : "miss") : undefined}>
            <span className={f.actionIcon}>{s.icon}</span>
            <Keycap className={f.actionKey}>{s.keycap}</Keycap>
            <b>{s.label}</b>
          </div>;
        })}
      </div>
    ))}
  </div>;
}

/** A pictogram figure: a head and a body line, drawn in currentColor. */
const Fig = ({ d, head }: { d: string; head: [number, number] }) => <><circle cx={head[0]} cy={head[1]} r={2.4} /><path d={d} /></>;
const Ball = ({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} data-ball="" />;

/** The moves' pictograms (24 × 24, stroked in currentColor; the ball filled). */
const ICONS: Record<string, ReactNode> = {
  bump: <><Fig head={[10, 7]} d="M10 9.5v6M10 15.5l-3 5M10 15.5l3 5M10 11l6 3M10 11l5.5 4" /><Ball x={18} y={9} /></>,
  set: <><Fig head={[11, 10]} d="M11 12.5v5M11 17.5l-3 4M11 17.5l3 4M11 13l-2.5-6M11 13l2.5-6" /><Ball x={11} y={3.4} /></>,
  jumpset: <><Fig head={[11, 9]} d="M11 11.5v5M11 16.5l-4 2M11 16.5l2 4M11 12l-2.5-6M11 12l2.5-6" /><Ball x={11} y={2.8} /><path d="M5 22h4M14 22h4" /></>,
  spike: <><Fig head={[9, 9]} d="M9 11.5v5M9 16.5l-3 3M9 16.5l3 2M9 12.5l-4 1M9 12l5-6" /><Ball x={17} y={4} /><path d="M19 8l2 3M16 9l1 3" /></>,
  block: <><Fig head={[10, 8]} d="M10 10.5v5M10 15.5l-2.5 5M10 15.5l2.5 5M10 11l-1.5-8M10 11l1.5-8" /><path d="M16 3v19M16 6h6M16 11h6M19 3v8" /></>,
  dive: <><Fig head={[16, 15]} d="M13.5 16l-7 2M6.5 18l-3.5 3M6.5 18l-4 0M14 16.5l5 2" /><Ball x={21} y={20} r={2.2} /><path d="M2 23h20" /></>,
  slide: <><Fig head={[17, 16]} d="M14.5 17l-7 2.5M7.5 19.5l-4 2M14.5 17.5l5 2" /><Ball x={22} y={20.5} r={1.8} /><path d="M2 23h20M1 15h4M2 12h3" /></>,
  call: <><Fig head={[8, 9]} d="M8 11.5v5M8 16.5l-2.5 5M8 16.5l2.5 5M8 12.5l3-3" /><path d="M13 4h8v6h-4l-2 2v-2h-2z" /><path d="M17 5.5v2M17 8.8v.2" /></>,
  jump: <><Fig head={[10, 7]} d="M10 9.5v5M10 14.5l-3 3M10 14.5l3 3M10 11l-3 2M10 11l3 2" /><path d="M6 22h8M18 16V5M15 8l3-3 3 3" /></>,
  dash: <><Fig head={[14, 7]} d="M14 9.5v5M14 14.5l-4 5M14 14.5l3 5M14 11l-4 2M14 11l4-1" /><path d="M2 10h6M3 14h5M2 18h5" /></>,
  charge: <><Ball x={12} y={7} r={4} /><path d="M6 21v-3M10 21v-5M14 21v-7M18 21v-9" /></>,
  serve: <><Fig head={[9, 10]} d="M9 12.5v5M9 17.5l-3 4M9 17.5l3 4M9 13l-3 2M9 13l5-7" /><Ball x={16} y={4} /><path d="M19 7l3 1" /></>,
  spin: <><Ball x={11} y={12} r={6} /><circle cx={14} cy={10} r={1.4} /><path d="M18 4c3 3 3 9 0 13M18 17l-1-3M18 17l3-1" /></>,
};

/** A move's pictogram (bump, set, jumpset, spike, block, dive, slide, call, jump, dash, charge, serve, spin). */
export function ActionIcon({ move, size = 28 }: { move: string; size?: number }) {
  return <svg className={f.pictogram} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{ICONS[move] ?? null}</svg>;
}
