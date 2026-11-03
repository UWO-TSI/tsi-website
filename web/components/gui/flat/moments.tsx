"use client";

/**
 * The flat kit's big moments (specs/design-bible.md, UI rule 4: "big moments ... pop, spring and fly to their slot"),
 * first used by the first ten minutes (lane tutorial-v2, David's v2 review), shown on /lab/gui:
 *   Spotlight    one flat panel in the middle over a light scrim, for a step that wants your whole attention;
 *                `light`: a small white card with no scrim (the keyboard tour)
 *   KeyBoard     a small drawn QWERTY keyboard on a light well: a key lit to press or hold (its fill runs as it's
 *                held), keys you've done, keys down now
 *   SlotPop      a part of the screen arriving in its place: it springs in and its place rings once
 *   FlyIn        an icon pops up in the middle over a slightly darker screen with its name, then flies to its slot
 *                on screen (a selector), which rings once
 *   QuestCheck   a quest done: a white disc pops in, a check draws itself, a ring and a few sparks; "Quest complete"
 *                and its title under it (the reward itself is RewardCard's)
 *   PrintedCard  a printed card (paper: rule 2): a band, a picture, label and value rows, a stamp coming down;
 *                `printing` slides it out of a slot; `tilt`: it leans toward the pointer with a soft sheen
 *   CardOverlay  a thing as the overlay (the v3 review: "the card itself is the overlay"): no panel, the thing large in
 *                the middle over a light scrim, one button under it
 *   PaperField   a field written on paper: a write-in line, for a card being filled in
 *   flyCoins     a sale's coins: they burst from what was sold and fly, one after another, to the wallet, which ticks
 *                up and swells a little as each lands, glowing a deeper yellow the more comes in, with sparkles
 * Colours: the theme's --ui-* tokens only. Plain props; nothing here knows the game.
 */
import { useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { iconUrl } from "@/lib/icons/keys";
import m from "./moments.module.css";

/** A step that wants your whole attention: a flat panel in the middle over a light scrim. Holds the world's keys. */
export function Spotlight({ open, label, eyebrow, title, lead, text, story, light, steps, children, footer, aside, testId, dataset }: {
  open: boolean; label: string; eyebrow?: ReactNode; title?: ReactNode;
  /** Under the title: what to do now, in a word or two (it changes with a little rise); then a quiet line about it. */
  lead?: ReactNode; text?: ReactNode;
  /** A page of story: the text larger, in ink, the panel a little wider (the lore). */
  story?: boolean;
  /** Light (David's v4 review on the keyboard tour: "more lightweight"): a small white card, no scrim behind it. */
  light?: boolean;
  /** A dot per step, `at` the one showing, the ones before it done. */
  steps?: { count: number; at: number };
  children?: ReactNode; footer?: ReactNode; testId?: string;
  /** Shown beside the card on its right (the keyboard tour's KeyPeek). */
  aside?: ReactNode;
  /** More data attributes for the evidence scripts (a step's id). */
  dataset?: Record<`data-${string}`, string | undefined>;
}) {
  const ref = useWorldDialog<HTMLElement>(open, noop, [], true);
  if (!open) return null;
  return <div className={`${m.layer} gui`} data-gui-flat="">
    {!light && <div className={m.scrim} aria-hidden="true" />}
    <section ref={ref} role="dialog" aria-modal aria-label={label} tabIndex={-1} data-gui-overlay className={m.spotlight} data-story={story || undefined} data-light={light || undefined} data-testid={testId} {...dataset}>
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
      {aside && <div className={m.aside}>{aside}</div>}
    </section>
  </div>;
}
const noop = () => {};

/**
 * A part of the screen arriving in its place (`to`: selectors, the first on screen): it springs in from small and its
 * place rings once. Mount it as the part is shown; a new React `key` plays it again.
 */
export function SlotPop({ to }: { to: readonly string[] }) {
  const [ring, setRing] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const where = useRef(to);
  useEffect(() => {
    // Two frames: the part mounts in the same commit as this, and lays out in the next.
    let raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => {
      const el = where.current.map(sel => document.querySelector<HTMLElement>(sel)).find(e => e && e.getBoundingClientRect().width > 0);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRing({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 });
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.animate([{ scale: "0.3", opacity: 0 }, { scale: "1.12", opacity: 1, offset: 0.62 }, { scale: "1" }], { duration: 560, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
      }
    }); });
    return () => cancelAnimationFrame(raf);
  }, []);
  return ring && <div className={`${m.fly} gui`} aria-hidden="true">
    <i className={m.flyRing} style={{ left: ring.x, top: ring.y, width: ring.w, height: ring.h }} />
  </div>;
}

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
 * (a selector; the first that's on screen; none: the top right) and the slot rings once, `data-landed` set on it (an
 * empty slot fills as it clicks in). `onDone` after it lands.
 * `onBeat` hears each beat (for sounds). A new React `key` plays it again.
 */
export function FlyIn({ icon, name, text, to, onBeat, onDone, testId }: {
  icon: ReactNode; name: ReactNode; text?: ReactNode; to: readonly string[];
  onBeat?: (beat: Flight["phase"]) => void; onDone: () => void; testId?: string;
}) {
  const [f, setF] = useState<Flight>({ phase: "pop", dx: 0, dy: 0, k: 1, ring: null });
  const slot = useRef<HTMLElement | null>(null);
  const cb = useRef({ onDone, onBeat, to });
  useEffect(() => { cb.current = { onDone, onBeat, to }; }, [onDone, onBeat, to]);
  useEffect(() => {
    cb.current.onBeat?.("pop");
    const ts = [
      window.setTimeout(() => {
        const el = cb.current.to.map(sel => document.querySelector<HTMLElement>(sel)).find(e => e && e.getBoundingClientRect().width > 0), r = el?.getBoundingClientRect();
        slot.current = el ?? null;
        const cx = window.innerWidth / 2, cy = window.innerHeight * 0.42;
        const tx = r ? r.left + r.width / 2 : window.innerWidth - 80, ty = r ? r.top + r.height / 2 : 60;
        setF({ phase: "fly", dx: tx - cx, dy: ty - cy, k: Math.max(0.28, Math.min(0.6, (r ? Math.min(r.width, r.height) : 40) / 96)),
          ring: r ? { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 } : null });
        cb.current.onBeat?.("fly");
      }, FLY_MS.pop),
      window.setTimeout(() => { setF(x => ({ ...x, phase: "land" })); slot.current?.setAttribute("data-landed", ""); cb.current.onBeat?.("land"); }, FLY_MS.pop + FLY_MS.fly),
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

/** Where a sale's coins land: the open sheet's purse, else the HUD's wallet. */
export const COIN_SLOTS = ['[data-purse="coins"]', '[data-hud-slot="coins"]'] as const;
/** How many coins fly for `amount`: more for more, 3 to 12, never more coins than money. */
export const coinCount = (amount: number) => Math.min(Math.max(0, Math.floor(amount)), Math.max(3, Math.min(12, Math.round(2 + Math.sqrt(Math.max(0, amount)) / 1.6))));
/** `amount` over `n` coins: whole numbers that add up to it, the bigger shares last. */
export function coinShares(amount: number, n: number): number[] {
  const base = Math.floor(amount / n), extra = amount - base * n;
  return Array.from({ length: n }, (_, i) => base + (i >= n - extra ? 1 : 0));
}
/** How deep the wallet's yellow glows with `amount` in (0 the light yellow, 1 the deep). */
export const coinHeat = (amount: number) => Math.max(0.1, Math.min(1, Math.log10(Math.max(1, amount)) / 3.2));

const COIN = { pop: 170, fly: 560, gap: 75 } as const;
const glowing = new Map<HTMLElement, { flights: number; css: string }>();
let layer: HTMLDivElement | null = null;
/**
 * A sale's coins (David, 2026-11-02: "coins fly from the fish you sold to the wallet ... mult coin fly staggered to the
 * wallet, wallet coin num count up, glows yellow based on how much coin is added. add sparkles, yellow gets darker if
 * more coins, the nnumberinflates as cions enter"). From `from` (the sold thing's box) coinCount(amount) coins pop up
 * and fly one after another to the first slot of `to` on screen; as each lands `onLand` hears its share (the caller ticks
 * its number and plays the coin), the slot swells a little more each time, glows a deeper yellow for what has come in so
 * far, and throws a few sparkles. `onDone` after the last. With no slot on screen, or under reduced motion, it all lands
 * at once. Transform and opacity only (the Web Animations API, so a slowed clock slows it whole).
 */
export function flyCoins({ from, amount, to = COIN_SLOTS, onLand, onDone }: {
  from: DOMRect; amount: number; to?: readonly string[]; onLand?: (share: number, i: number, n: number) => void; onDone?: () => void;
}) {
  const n = coinCount(amount), shares = coinShares(amount, n);
  const slot = to.map(sel => document.querySelector<HTMLElement>(sel)).find(e => e && e.getBoundingClientRect().width > 0);
  if (!slot || !n || typeof document.body.animate !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (n) onLand?.(amount, n - 1, n);
    onDone?.();
    return;
  }
  if (!layer?.isConnected) {
    layer = Object.assign(document.createElement("div"), { className: `${m.coins} gui` });
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  const box = layer, r = slot.getBoundingClientRect(), tx = r.left + Math.min(r.width / 2, 14), ty = r.top + r.height / 2;
  const glow = glowing.get(slot) ?? { flights: 0, css: slot.style.cssText };
  glow.flights++;
  glowing.set(slot, glow);
  let landed = 0;
  shares.forEach((share, i) => {
    const coin = document.createElement("img");
    coin.src = iconUrl("coin");
    coin.alt = "";
    coin.className = m.coin;
    const x = from.left + from.width / 2 + (Math.random() - 0.5) * from.width * 0.5, y = from.top + from.height * 0.42 + (Math.random() - 0.5) * from.height * 0.3;
    coin.style.left = `${x}px`;
    coin.style.top = `${y}px`;
    box.appendChild(coin);
    const dx = tx - x, dy = ty - y, burst = { x: (Math.random() - 0.5) * 90, y: -40 - Math.random() * 50 }, bend = (Math.random() - 0.5) * 140;
    const at = (k: number) => `translate(${burst.x + (dx - burst.x) * k + bend * k * (1 - k)}px, ${burst.y + (dy - burst.y) * k * k - 60 * k * (1 - k)}px)`;
    const flight = coin.animate([
      { transform: "translate(0, 0) scale(0.3) rotate(0deg)", opacity: 0 },
      { transform: `translate(${burst.x}px, ${burst.y}px) scale(1.15) rotate(${burst.x}deg)`, opacity: 1, offset: COIN.pop / (COIN.pop + COIN.fly), easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
      { transform: `${at(0.5)} scale(0.95) rotate(${burst.x * 3}deg)`, opacity: 1, offset: (COIN.pop + COIN.fly * 0.5) / (COIN.pop + COIN.fly) },
      { transform: `${at(1)} scale(0.55) rotate(${burst.x * 5}deg)`, opacity: 1 },
    ], { duration: COIN.pop + COIN.fly, delay: i * COIN.gap, easing: "linear", fill: "backwards" });
    flight.onfinish = () => {
      coin.remove();
      landed += share;
      onLand?.(share, i, n);
      land(slot, coinHeat(landed), i / Math.max(1, n - 1), box, tx, ty);
      if (i === n - 1) {
        slot.animate([{ filter: "brightness(1.15)" }, { filter: "brightness(1)" }], { duration: 900, easing: "ease-out" }).onfinish = () => {
          if (--glow.flights > 0) return;
          // The glow fades out (its transition), then the slot has its own look back.
          slot.style.backgroundColor = "transparent";
          slot.style.boxShadow = "none";
          window.setTimeout(() => { if (glow.flights) return; slot.style.cssText = glow.css; glowing.delete(slot); }, 300);
        };
        onDone?.();
      }
    };
  });
}
/** One coin into the slot: it swells (more with each, `k` 0 to 1), glows in the yellow for `heat`, and sparkles. */
function land(slot: HTMLElement, heat: number, k: number, box: HTMLElement, x: number, y: number) {
  const tone = `color-mix(in oklab, var(--ui-gold-deep) ${Math.round(heat * 100)}%, var(--ui-gold-light))`;
  slot.style.borderRadius = "999px";
  slot.style.transition = "background-color 0.25s ease, box-shadow 0.25s ease";
  slot.style.backgroundColor = `color-mix(in srgb, ${tone} ${Math.round(28 + 30 * heat)}%, transparent)`;
  slot.style.boxShadow = `0 0 0 5px color-mix(in srgb, ${tone} 70%, transparent), 0 0 ${Math.round(8 + 22 * heat)}px ${Math.round(2 + 6 * heat)}px color-mix(in srgb, ${tone} 75%, transparent)`;
  slot.animate([{ transform: "scale(1)" }, { transform: `scale(${(1.1 + 0.16 * k).toFixed(3)})`, offset: 0.3 }, { transform: "scale(1)" }],
    { duration: 300, easing: "cubic-bezier(0.3, 1.5, 0.5, 1)" });
  for (let s = 0; s < 3; s++) {
    const spark = document.createElement("i"), a = Math.random() * Math.PI * 2, d = 22 + Math.random() * 22;
    spark.className = m.coinSpark;
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    box.appendChild(spark);
    spark.animate([
      { transform: "translate(-50%, -50%) scale(0) rotate(0deg)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1) rotate(45deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.3}px), calc(-50% + ${Math.sin(a) * d * 1.3}px)) scale(0) rotate(90deg)`, opacity: 0 },
    ], { duration: 520, easing: "ease-out" }).onfinish = () => spark.remove();
  }
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
 * on the left, `rows` (label, value; the first one large). `printing`: it feeds down out of the printer's slot above
 * it, a light blinking. `stamp` set: a stamper comes down on it, the card gives under it, the mark is left and a gleam
 * runs across the new card.
 */
export function PrintedCard({ band, kind, picture, rows, stamp, printing, large, tilt, testId }: {
  band: ReactNode; kind?: ReactNode; picture: ReactNode; rows: readonly (readonly [ReactNode, ReactNode])[];
  stamp?: { top: ReactNode; word: ReactNode } | null; printing?: boolean;
  /** Held up as the overlay (CardOverlay): larger. */
  large?: boolean;
  /** It leans toward the pointer in 3D, a sheen where the light catches it (off while printing, and under reduced motion). */
  tilt?: boolean; testId?: string;
}) {
  const lean = (e: PointerEvent<HTMLElement>) => {
    const el = e.currentTarget, r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${((0.5 - y) * 16).toFixed(2)}deg`); el.style.setProperty("--ry", `${((x - 0.5) * 20).toFixed(2)}deg`);
    el.style.setProperty("--sx", `${(x * 100).toFixed(1)}%`); el.style.setProperty("--sy", `${(y * 100).toFixed(1)}%`);
    el.dataset.lean = "";
  };
  const rest = (e: PointerEvent<HTMLElement>) => { const el = e.currentTarget; el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); delete el.dataset.lean; };
  const leaning = tilt && !printing;
  return <div className={m.printed} data-printing={printing || undefined} data-large={large || undefined}>
    <div className={m.slot} aria-hidden="true"><i /></div>
    <div className={m.paperWrap}>
    <article className={m.paper} data-testid={testId} data-tilt={leaning || undefined} data-stamped={stamp ? "" : undefined}
      onPointerMove={leaning ? lean : undefined} onPointerLeave={leaning ? rest : undefined}>
      {leaning && <i className={m.sheen} aria-hidden="true" />}
      <header className={m.band}><span>{band}</span>{kind && <small>{kind}</small>}</header>
      <div className={m.paperBody}>
        <div className={m.picture} aria-hidden="true">{picture}</div>
        <dl className={m.rows}>{rows.map(([k, v], i) => <div key={i} data-lead={i === 0 || undefined}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </div>
      {stamp && <span className={m.stamp} aria-hidden="true"><b>{stamp.top}</b><small>{stamp.word}</small></span>}
    </article>
    {/* The stamper: down onto the card (the mark lands as it hits), then up and away. */}
    {stamp && <i className={m.stamper} aria-hidden="true"><b /></i>}
    </div>
  </div>;
}

/** A thing as the overlay: no panel, `children` (a card) large in the middle over a light scrim, `action` (one button) under it. Holds the world's keys. */
export function CardOverlay({ open, label, children, action, testId, dataset }: {
  open: boolean; label: string; children: ReactNode; action?: ReactNode; testId?: string; dataset?: Record<`data-${string}`, string | undefined>;
}) {
  const ref = useWorldDialog<HTMLElement>(open, noop, [], true);
  if (!open) return null;
  return <div className={`${m.layer} gui`} data-gui-flat="">
    <div className={m.scrim} aria-hidden="true" />
    <section ref={ref} role="dialog" aria-modal aria-label={label} tabIndex={-1} data-gui-overlay className={m.held} data-testid={testId} {...dataset}>
      {children}
      {action && <div className={m.heldAction}>{action}</div>}
    </section>
  </div>;
}

/** A field written on paper (a card being filled in): a write-in line in the paper's ink. */
export function PaperField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={m.paperField} />;
}
