import type { ReactNode, Ref } from "react";
import { Keycap } from "@/components/gui";
import f from "./flat.module.css";

/**
 * An action bar (the volleyball match's moves; round 3, David: "the ui for the action bar needs heavy work ... the icon
 * isnt intuitive, and its not responsive for when you jump"). One white card per move: a bold silhouette of the move,
 * its name, and its key (a mouse with its button lit for a click, a keycap otherwise). A slot that would connect now
 * lifts and rings gold (`ready`); a press pops it (`flash`, `ok` false shakes it for a whiff); an action not open now
 * is quiet (`off`).
 *
 * Several rows share one place (`rows`, `active` names the one shown): the sand's moves and the air's. The swap is a
 * quick flip with no fade-through, and a caller can make it the same frame by setting `data-active` on the rows itself
 * (`stackRef`, each row's `data-row`), ahead of React. A row named `air` wears a sky edge, so the switch reads at a glance.
 */
export interface ActionSlot { id: string; label: string; keycap: string; icon: ReactNode; mouse?: "left" | "right"; ready?: boolean; off?: boolean }

export function ActionBar({ rows, active, flash, stackRef }: {
  rows: Record<string, ActionSlot[]>; active: string;
  /** The last press: which slot, a counter that changes with each press, and whether it connected. */
  flash?: { id: string; n: number; ok: boolean } | null;
  stackRef?: Ref<HTMLDivElement>;
}) {
  return <div className={f.actionStack} ref={stackRef}>
    {Object.entries(rows).map(([name, slots]) => (
      <div key={name} className={f.actionBar} data-row={name} data-active={name === active || undefined} aria-hidden={name !== active} role="group" aria-label={`${name} moves`}>
        {slots.map(s => {
          const hit = flash && name === active && flash.id === s.id;
          return <div key={hit ? `${s.id}-${flash!.n}` : s.id} className={f.actionSlot} data-ready={s.ready || undefined} data-off={s.off || undefined}
            data-flash={hit ? (flash!.ok ? "ok" : "miss") : undefined}>
            <span className={f.actionIcon}>{s.icon}</span>
            <b>{s.label}</b>
            {s.mouse ? <MouseKey button={s.mouse} label={s.keycap} /> : <Keycap className={f.actionKey}>{s.keycap}</Keycap>}
          </div>;
        })}
      </div>
    ))}
  </div>;
}

/** A mouse with the button to press lit (left or right click). */
export function MouseKey({ button, label }: { button: "left" | "right"; label: string }) {
  return <svg className={f.mouseKey} viewBox="0 0 16 22" width={16} height={22} role="img" aria-label={label}>
    <rect x={1} y={1} width={14} height={20} rx={7} className={f.mouseBody} />
    <path d={button === "left" ? "M8 1.6A6.4 6.4 0 0 0 1.6 8V9.4H8z" : "M8 1.6A6.4 6.4 0 0 1 14.4 8V9.4H8z"} className={f.mouseLit} />
    <path d="M8 1.6V9.4M1.6 9.4H14.4" className={f.mouseLine} />
  </svg>;
}

/** A filled figure: the head and the limbs as one thick stroke (24 × 24, facing right). */
const Fig = ({ d, head }: { d: string; head: [number, number] }) => <><circle cx={head[0]} cy={head[1]} r={2.5} data-fill="" /><path d={d} /></>;
const Ball = ({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} data-ball="" />;
/** Marks: the sand under a grounded move, the air gap under a jump, speed lines. */
const Sand = () => <path d="M2 22.6h20" data-mark="" />;
const Lift = () => <path d="M4 23h4M11 23h4" data-mark="" />;

/** The moves' pictograms: what the body does, the ball where it meets it. */
const ICONS: Record<string, ReactNode> = {
  // Knees bent, both arms straight out as one platform, the ball coming onto the forearms.
  bump: <><Fig head={[8, 6]} d="M8.5 8.5L9.5 13.5M9.5 13.5L7 17L8 21M9.5 13.5L12 17L11.5 21M9 9.5L15.5 13" /><Ball x={17.6} y={10.6} /><Sand /></>,
  // Upright, both hands over the forehead, the ball just above them.
  set: <><Fig head={[11, 9.5]} d="M11 12V17M11 17L9 21.4M11 17L13 21.4M11 12.6L8.4 9.6L9.4 6.4M11 12.6L13.6 9.6L12.6 6.4" /><Ball x={11} y={3.4} r={2.4} /><Sand /></>,
  // Off the sand, the hitting arm whipping over the top of the ball, the ball driven down.
  spike: <><Fig head={[8, 8]} d="M8 10.5L7.4 15.4M7.4 15.4L5 18.4L6.6 20.6M7.4 15.4L10 18L8.6 20.8M8.6 11.2L12.2 7.6L14.4 5.2M8 11.4L5 9.4" /><Ball x={17.4} y={6} /><path d="M19.6 10.2L21.4 13M16.6 10.8L17.4 13.6" data-mark="" /><Lift /></>,
  // Off the sand, both arms straight up at the net's tape, the ball stopped against the hands.
  block: <><Fig head={[9, 8.6]} d="M9 11.1V15.8M9 15.8L7.4 20.2M9 15.8L10.6 20.2M9 11.6L9.8 4.2M9 11.6L12 4.6" /><path d="M15 4V21M15 6H22M15 10H22M15 14H22M18.5 6V14" data-mark="" /><Ball x={13} y={2.6} r={2} /><Lift /></>,
  // Off the sand, hands over the forehead, the ball above them.
  jumpset: <><Fig head={[11, 9]} d="M11 11.5V15.8M11 15.8L8.6 18L10 20.6M11 15.8L13.4 18L12 20.6M11 12L8.4 9L9.4 5.8M11 12L13.6 9L12.6 5.8" /><Ball x={11} y={2.9} r={2.4} /><Lift /></>,
  // Flat out along the sand, one arm reaching under the ball.
  dive: <><Fig head={[14.4, 14.2]} d="M12.4 15.6L5 17.4M5 17.4L1.6 15.4M5 17.4L2 18.6M13.6 16.2L19 18.8" /><Ball x={20.6} y={17.4} r={2.2} /><path d="M2 22.6h20M3 12.4h3M2 9.6h2.4" data-mark="" /></>,
  // The serve: the hand coming through the ball, the ball away.
  serve: <><Fig head={[9, 10]} d="M9 12.5V17.5M9 17.5L6.6 21.4M9 17.5L11.4 21.4M9 13L6 15M9 13L13.4 6.6" /><Ball x={16} y={4.4} /><path d="M19 7.4L22 8.4" data-mark="" /><Sand /></>,
  // Hold to serve: the ball over bars rising.
  charge: <><Ball x={12} y={6.4} r={4} /><path d="M6 21v-3M10 21v-5M14 21v-7M18 21v-9" /></>,
  // The curve: the ball, the dot where you'll hit it, and the bend.
  spin: <><Ball x={11} y={12} r={6} /><circle cx={14} cy={10} r={1.4} data-fill="" /><path d="M18.4 4c3 3 3 9 0 13M18.4 17l-1-3M18.4 17l3-1" /></>,
};

/** A move's pictogram (bump, set, spike, block, jumpset, dive, serve, charge, spin). */
export function ActionIcon({ move, size = 36 }: { move: string; size?: number }) {
  return <svg className={f.pictogram} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">{ICONS[move] ?? null}</svg>;
}
