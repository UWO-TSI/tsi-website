"use client";

/**
 * The flat kit's big moments (specs/design-bible.md, UI rule 4: "big moments ... pop, spring and fly to their slot"),
 * first used by the first ten minutes (lane tutorial-v2, David's v2 review), shown on /lab/gui:
 *   Spotlight    one flat panel in the middle over a light scrim, for a step that wants your whole attention
 *   KeyBoard     a drawn QWERTY keyboard: a key lit to press or hold (its fill runs as it's held), keys you've done,
 *                keys down now
 *   FlyIn        an icon pops up in the middle over a slightly darker screen with its name, then flies to its slot
 *                on screen (a selector), which rings once
 *   QuestCheck   a quest done: a white disc pops in, a check draws itself, a ring and a few sparks; "Quest complete"
 *                and its title under it (the reward itself is RewardCard's)
 *   PrintedCard  a printed card (paper: rule 2): a band, a picture, label and value rows, a stamp coming down;
 *                `printing` slides it out of a slot
 * Colours: the theme's --ui-* tokens only. Plain props; nothing here knows the game.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import m from "./moments.module.css";

/** A step that wants your whole attention: a flat panel in the middle over a light scrim. Holds the world's keys. */
export function Spotlight({ open, label, eyebrow, title, lead, text, story, steps, children, footer, testId, dataset }: {
  open: boolean; label: string; eyebrow?: ReactNode; title?: ReactNode;
  /** Under the title: what to do now, in a word or two (it changes with a little rise); then a quiet line about it. */
  lead?: ReactNode; text?: ReactNode;
  /** A page of story: the text larger, in ink, the panel a little wider (the lore). */
  story?: boolean;
  /** A dot per step, `at` the one showing, the ones before it done. */
  steps?: { count: number; at: number };
  children?: ReactNode; footer?: ReactNode; testId?: string;
  /** More data attributes for the evidence scripts (a step's id). */
  dataset?: Record<`data-${string}`, string | undefined>;
}) {
  const ref = useWorldDialog<HTMLElement>(open, noop, [], true);
  if (!open) return null;
  return <div className={`${m.layer} gui`} data-gui-flat="">
    <div className={m.scrim} aria-hidden="true" />
    <section ref={ref} role="dialog" aria-modal aria-label={label} tabIndex={-1} data-gui-overlay className={m.spotlight} data-story={story || undefined} data-testid={testId} {...dataset}>
      {(eyebrow || title || lead || text) && <header className={m.head}>
        {eyebrow && <p className={m.eyebrow}>{eyebrow}</p>}
        {title && <h2 className={m.title}>{title}</h2>}
        {lead && <p key={String(title)} className={m.lead} aria-live="polite">{lead}</p>}
        {text && <p key={story ? String(title) : undefined} className={m.text}>{text}</p>}
      </header>}
      {children}
      {(footer || steps) && <footer className={m.foot}>
        {steps && <span className={m.dots} aria-hidden="true">{Array.from({ length: steps.count }, (_, i) => <i key={i} data-on={i === steps.at || undefined} data-done={i < steps.at || undefined} />)}</span>}
        {footer}
      </footer>}
    </section>
  </div>;
}
const noop = () => {};

/** The keyboard as drawn: the rows of a US QWERTY board, each key its `KeyboardEvent.key` (lower case) and its width. */
export type BoardKey = { key: string; label: string; w?: number };
export const KEYBOARD: readonly (readonly BoardKey[])[] = [
  [{ key: "escape", label: "Esc", w: 1.25 }, ..."1234567890".split("").map(c => ({ key: c, label: c })), { key: "-", label: "-" }, { key: "=", label: "=" }, { key: "backspace", label: "Delete", w: 1.75 }],
  [{ key: "tab", label: "Tab", w: 1.5 }, ..."qwertyuiop".split("").map(c => ({ key: c, label: c.toUpperCase() })), { key: "[", label: "[" }, { key: "]", label: "]" }, { key: "\\", label: "\\", w: 1.5 }],
  [{ key: "capslock", label: "Caps", w: 1.75 }, ..."asdfghjkl".split("").map(c => ({ key: c, label: c.toUpperCase() })), { key: ";", label: ";" }, { key: "'", label: "'" }, { key: "enter", label: "Enter", w: 2.25 }],
  [{ key: "shift", label: "Shift", w: 2.25 }, ..."zxcvbnm".split("").map(c => ({ key: c, label: c.toUpperCase() })), { key: ",", label: "," }, { key: ".", label: "." }, { key: "/", label: "/" }, { key: "shift-r", label: "Shift", w: 2.75 }],
  [{ key: "control", label: "Ctrl", w: 1.5 }, { key: "alt", label: "Alt", w: 1.25 }, { key: "meta", label: "Cmd", w: 1.5 }, { key: " ", label: "", w: 6.25 }, { key: "meta-r", label: "Cmd", w: 1.5 }, { key: "alt-r", label: "Alt", w: 1.25 }, { key: "arrowleft", label: "←" }, { key: "arrowright", label: "→" }],
];
/** A key's name as the board shows it ("Tab", "Enter", "G"). */
export const boardLabel = (k: string) => KEYBOARD.flat().find(b => b.key === k)?.label || (k === " " ? "Space" : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));

/**
 * The keyboard. `lit`: the key to press now (`hold`: to hold, its fill at `fill`, 0 to 1); `won`: it's just been done
 * (it springs); `done`: keys already learned; `down`: keys held down right now (they sink).
 */
export function KeyBoard({ lit, hold, fill = 0, won, done = [], down }: {
  lit?: string | null; hold?: boolean; fill?: number; won?: boolean; done?: readonly string[]; down?: ReadonlySet<string>;
}) {
  return <div className={m.board} aria-hidden="true">
    {KEYBOARD.map((row, r) => <div key={r} className={m.row}>
      {row.map(b => {
        const on = b.key === lit, base = b.key.replace(/-r$/, "");
        return <span key={b.key} className={m.key} style={{ "--w": b.w ?? 1 } as CSSProperties}
          data-lit={on && !won ? (hold ? "hold" : "press") : undefined} data-won={on && won || undefined}
          data-done={!on && done.includes(b.key) || undefined} data-down={down?.has(base) || undefined}>
          {on && hold && !won && <i className={m.fill} style={{ transform: `scaleX(${fill})` }} />}
          <b>{b.label}</b>
        </span>;
      })}
    </div>)}
  </div>;
}

/** The FlyIn's beats (ms): up in the middle, then off to its slot, then the ring where it lands. */
export const FLY_MS = { pop: 1500, fly: 750, land: 650 } as const;
type Flight = { phase: "pop" | "fly" | "land"; dx: number; dy: number; k: number; ring: { x: number; y: number; w: number; h: number } | null };

/**
 * An icon pops up in the middle (a slightly darker screen behind it, its name and a line under it), then flies to `to`
 * (a selector; the first that's on screen; none: the top right) and the slot rings once. `onDone` after it lands.
 * `onBeat` hears each beat (for sounds). A new React `key` plays it again.
 */
export function FlyIn({ icon, name, text, to, onBeat, onDone, testId }: {
  icon: ReactNode; name: ReactNode; text?: ReactNode; to: readonly string[];
  onBeat?: (beat: Flight["phase"]) => void; onDone: () => void; testId?: string;
}) {
  const [f, setF] = useState<Flight>({ phase: "pop", dx: 0, dy: 0, k: 1, ring: null });
  const cb = useRef({ onDone, onBeat, to });
  useEffect(() => { cb.current = { onDone, onBeat, to }; }, [onDone, onBeat, to]);
  useEffect(() => {
    cb.current.onBeat?.("pop");
    const ts = [
      window.setTimeout(() => {
        const el = cb.current.to.map(sel => document.querySelector(sel)).find(e => e && e.getBoundingClientRect().width > 0), r = el?.getBoundingClientRect();
        const cx = window.innerWidth / 2, cy = window.innerHeight * 0.42;
        const tx = r ? r.left + r.width / 2 : window.innerWidth - 80, ty = r ? r.top + r.height / 2 : 60;
        setF({ phase: "fly", dx: tx - cx, dy: ty - cy, k: Math.max(0.28, Math.min(0.6, (r ? Math.min(r.width, r.height) : 40) / 96)),
          ring: r ? { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 } : null });
        cb.current.onBeat?.("fly");
      }, FLY_MS.pop),
      window.setTimeout(() => { setF(x => ({ ...x, phase: "land" })); cb.current.onBeat?.("land"); }, FLY_MS.pop + FLY_MS.fly),
      window.setTimeout(() => cb.current.onDone(), FLY_MS.pop + FLY_MS.fly + FLY_MS.land),
    ];
    return () => ts.forEach(t => window.clearTimeout(t));
  }, []);
  return <div className={`${m.fly} gui`} data-phase={f.phase} data-testid={testId} aria-live="polite">
    <div className={m.flyDim} aria-hidden="true" />
    <div className={m.flyIcon} style={{ "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, "--k": f.k } as CSSProperties} aria-hidden="true"><span>{icon}</span></div>
    <p className={m.flyName}><b>{name}</b>{text && <span>{text}</span>}</p>
    {f.phase === "land" && f.ring && <i className={m.flyRing} style={{ left: f.ring.x, top: f.ring.y, width: f.ring.w, height: f.ring.h }} aria-hidden="true" />}
  </div>;
}

/** How long a QuestCheck plays before it's gone (ms): its caller unmounts it then. */
export const QUEST_CHECK_MS = 2100;
/** A quest done: a white disc pops in high in the middle, a check draws itself, a ring and sparks; the eyebrow and the title under it. */
export function QuestCheck({ eyebrow, title, testId }: { eyebrow: ReactNode; title: ReactNode; testId?: string }) {
  return <div className={`${m.pop} gui`} role="status" aria-live="polite" data-testid={testId} style={{ "--pop-ms": `${QUEST_CHECK_MS}ms` } as CSSProperties}>
    <div className={m.disc} aria-hidden="true">
      <span className={m.ring} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <i key={i} className={m.spark} style={{ "--a": `${i * 45 + 22}deg` } as CSSProperties} />)}
      <svg className={m.check} viewBox="0 0 64 64"><path d="M17 33.5 L28 44 L48 21" /></svg>
    </div>
    <p className={m.popEyebrow}>{eyebrow}</p>
    <p className={m.popTitle}>{title}</p>
  </div>;
}

/**
 * A printed card (paper: a thing that's paper in the world). `band` across the top with `kind` at its end, `picture`
 * on the left, `rows` (label, value; the first one large), a `stamp` coming down when set. `printing`: it slides down
 * out of a slot above it (the slot drawn too).
 */
export function PrintedCard({ band, kind, picture, rows, stamp, printing, testId }: {
  band: ReactNode; kind?: ReactNode; picture: ReactNode; rows: readonly (readonly [ReactNode, ReactNode])[];
  stamp?: { top: ReactNode; word: ReactNode } | null; printing?: boolean; testId?: string;
}) {
  return <div className={m.printed} data-printing={printing || undefined}>
    <div className={m.slot} aria-hidden="true"><i /></div>
    <article className={m.paper} data-testid={testId}>
      <header className={m.band}><span>{band}</span>{kind && <small>{kind}</small>}</header>
      <div className={m.paperBody}>
        <div className={m.picture} aria-hidden="true">{picture}</div>
        <dl className={m.rows}>{rows.map(([k, v], i) => <div key={i} data-lead={i === 0 || undefined}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </div>
      {stamp && <span className={m.stamp} aria-hidden="true"><b>{stamp.top}</b><small>{stamp.word}</small></span>}
    </article>
  </div>;
}
