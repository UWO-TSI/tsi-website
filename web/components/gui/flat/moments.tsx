"use client";

/**
 * The flat kit's big moments (specs/design-bible.md, UI rule 4: "big moments ... pop, spring and fly to their slot"),
 * first used by the first ten minutes (lane tutorial-v2, David's v2 review), shown on /lab/gui:
 *   Spotlight    one flat panel in the middle over a light scrim, for a step that wants your whole attention;
 *                `light`: a small white card with no scrim (the keyboard tour)
 *   KeyBoard     a small drawn QWERTY keyboard on a light well: a key lit to press or hold (its fill runs as it's
 *                held), keys you've done, keys down now
 *   SlotPop      a part of the screen arriving in its place: it springs in and its place rings once
 *   FlyHome      parts of the screen arriving from above a card: they pop up over it, show off a beat, then fly to
 *                where they sit and their places ring (the keyboard tour's HUD and minimap)
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
 *   Awakening    a thing changing into its better self, as a Pokémon evolves (David 2026-11-04): large in the middle
 *                over a deep scrim, a glow gathers on it in its old rung's colour, it pulses between its two forms
 *                faster and faster as the scrim closes in, everything holds its breath, the hit lands in impact frames,
 *                the glow flares into the new rung's colour, it shows its new form alone, then steps aside for a card
 * Colours: the theme's --ui-* tokens only. Plain props; nothing here knows the game.
 */
import { useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { iconUrl } from "@/lib/icons/keys";
import m from "./moments.module.css";

/** A step that wants your whole attention: a flat panel in the middle over a light scrim. Holds the world's keys. */
export function Spotlight({ open, label, eyebrow, title, lead, text, story, light, steps, children, footer, aside, asideAt, testId, dataset }: {
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
  /** Shown beside the card on its right (the keyboard tour's KeyPeek), or above it (`asideAt` "top"). */
  aside?: ReactNode; asideAt?: "right" | "top";
  /** More data attributes for the evidence scripts (a step's id). */
  dataset?: Record<`data-${string}`, string | undefined>;
}) {
  const ref = useWorldDialog<HTMLElement>(open, noop, [], true);
  if (!open) return null;
  return <div className={`${m.layer} gui`}>
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
      {aside && <div className={m.aside} data-at={asideAt}>{aside}</div>}
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

type Box = { x: number; y: number; w: number; h: number };
/** FlyHome's beats (ms): popping up above the card, showing off there, flying to its place. */
export const FLY_HOME_MS = { pop: 380, show: 1000, fly: 760 } as const;
/**
 * Parts of the screen arriving from above a card (round 9, David on the keyboard tour's HUD and minimap: "you press it
 * it shows off above the keyboard and it flies to where it usually sits"). Every element `to` matches (selectors; the
 * parts already laid out where they sit) pops up in a row above `from` (the card's selector), a little larger, shows off
 * for a beat, then flies to its own place and stays; its place rings once as it lands. Reduced motion: they fade in
 * where they sit. Mount it in the commit that shows the parts; a new React `key` plays it again.
 */
export function FlyHome({ to, from }: { to: readonly string[]; from: string }) {
  const [rings, setRings] = useState<Box[]>([]);
  const where = useRef({ to, from });
  useEffect(() => {
    const anims: Animation[] = [];
    let land = 0;
    // Two frames: the parts show in the same commit as this, and lay out in the next.
    let raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => {
      const els = where.current.to.flatMap(sel => [...document.querySelectorAll<HTMLElement>(sel)]).filter(e => e.getBoundingClientRect().width > 0);
      if (!els.length) return;
      const rs = els.map(e => e.getBoundingClientRect());
      const ring = () => setRings(rs.map(r => ({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 })));
      const card = document.querySelector(where.current.from)?.getBoundingClientRect();
      if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        els.forEach(e => anims.push(e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: "ease-out" })));
        ring();
        return;
      }
      // The row above the card: side by side, centred on it, as large as fits (a little larger than they sit).
      const GAP = 20, sum = rs.reduce((n, r) => n + r.width, 0);
      const k = Math.min(1.25, (window.innerWidth - 32 - GAP * (rs.length - 1)) / sum);
      const tall = Math.max(...rs.map(r => r.height)) * k, y = Math.max(16 + tall / 2, card.top - 24 - tall / 2);
      let x = card.left + card.width / 2 - (sum * k + GAP * (rs.length - 1)) / 2;
      const { pop, show, fly } = FLY_HOME_MS, total = pop + show + fly;
      rs.forEach((r, i) => {
        const w = r.width * k, at = `${x + w / 2 - (r.left + r.width / 2)}px ${y - (r.top + r.height / 2)}px`;
        x += w + GAP;
        anims.push(els[i].animate([
          { translate: at, scale: String(k * 0.4), opacity: 0, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
          { translate: at, scale: String(k), opacity: 1, offset: pop / total, easing: "ease-in-out" },
          { translate: at, scale: String(k * 1.05), offset: (pop + show / 2) / total, easing: "ease-in-out" },
          { translate: at, scale: String(k), offset: (pop + show) / total, easing: "cubic-bezier(0.5, 0, 0.25, 1.12)" },
          { translate: "0px 0px", scale: "1", opacity: 1 },
        ], { duration: total }));
      });
      land = window.setTimeout(ring, total);
    }); });
    return () => { cancelAnimationFrame(raf); window.clearTimeout(land); anims.forEach(a => a.cancel()); };
  }, []);
  return rings.length > 0 && <div className={`${m.fly} gui`} aria-hidden="true">
    {rings.map((r, i) => <i key={i} className={m.flyRing} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />)}
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
  return <div className={`${m.layer} gui`}>
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

/** An Awakening's beats (ms), in order; the reveal stays until it's closed. */
export const AWAKEN_MS = { frame: 900, glow: 1300, pulse: 2800, hush: 500, burst: 700, show: 1900 } as const;
export type AwakenPhase = keyof typeof AWAKEN_MS | "reveal";
const AWAKEN_ORDER = Object.keys(AWAKEN_MS) as (keyof typeof AWAKEN_MS)[];
/** How much bigger than its stage the thing's box is: room for its glow and its motion, so neither meets an edge. */
export const AWAKEN_ROOM = 1.6;
/** Painted frames each impact frame holds (three of them as the burst lands). */
const IMPACT_FRAMES = 5;
/** When the card has landed after the reveal (ms): what changed moves only then, one thing at a time. */
export const AWAKEN_CARD_MS = 900;

/**
 * A thing changing into its better self (a rod's awakening; David 2026-11-04: "like how when pokemon evlolve"). It plays
 * on mount (a new React `key` plays it again): `frame` it comes in large over a deep scrim with `lead` above it, `glow`
 * a glow gathers on it (on the thing itself, no light behind it: David 2026-11-05) in the colour of the rung it had
 * (`from`), `pulse` it swells between its old form and its new one faster and faster, flashing up on each beat, as the
 * scrim deepens and the stage pushes in, `hush` everything holds its breath (dim, still, the lead gone: a strike from
 * outside gathers here), `burst` the hit lands in impact frames (David 2026-11-06: "more flash and almost impact flash
 * frames": the screen in the new rung's colour with the thing cut out dark, then dark with the thing lit, then the
 * colour again), the stage shakes, the glow flares and turns the new rung's colour (`rarity`), `show` the new form
 * plays its own motion alone in the middle, then `reveal` it
 * steps aside, a faint edge of its rung's colour on it, and a card comes in beside it (under it on a phone): `eyebrow`,
 * `name`, the rung's pill (`rarityLabel`), `text`, `children` (what changed; move them after `AWAKEN_CARD_MS`) and
 * `action`. `thing(after, phase)` draws it: its old form until the burst (`after` false), its new one on the pulse's up
 * beats and after; its box is `AWAKEN_ROOM` times its stage. `onPhase` hears each beat and each pulse (for sounds and
 * what changes with them). `ready` false holds it on the scrim and the lead until the thing can be drawn (a model still
 * loading). Escape closes it, at any beat. Under reduced motion it opens on the reveal.
 */
export function Awakening({ label, thing, from, rarity, rarityLabel, lead, eyebrow, name, text, children, action, onPhase, onClose, ready = true, testId }: {
  label: string; thing: (after: boolean, phase: AwakenPhase) => ReactNode; from: string; rarity: string; rarityLabel: ReactNode; lead: ReactNode;
  eyebrow: ReactNode; name: ReactNode; text?: ReactNode; children?: ReactNode; action?: ReactNode;
  onPhase?: (phase: AwakenPhase | "beat") => void; onClose: () => void; ready?: boolean; testId?: string;
}) {
  const [phase, setPhase] = useState<AwakenPhase>("frame"), [after, setAfter] = useState(false), [impact, setImpact] = useState(0);
  const ref = useWorldDialog<HTMLElement>(true, onClose, [], true);
  const cb = useRef(onPhase);
  useEffect(() => { cb.current = onPhase; }, [onPhase]);
  useEffect(() => {
    if (!ready) return;
    const ts: number[] = [], go = (p: AwakenPhase) => { setPhase(p); if (p === "hush") setAfter(false); if (p === "burst" || p === "reveal") setAfter(true); cb.current?.(p); };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { const t = window.setTimeout(() => go("reveal"), 0); return () => window.clearTimeout(t); }
    let at = 0;
    for (const p of AWAKEN_ORDER) { const t = at; ts.push(window.setTimeout(() => go(p), t)); at += AWAKEN_MS[p]; }
    ts.push(window.setTimeout(() => go("reveal"), at));
    // The pulse: old, new, old, new, each beat quicker than the last.
    const start = AWAKEN_MS.frame + AWAKEN_MS.glow;
    for (let t = 0, gap = 420, up = true; t + gap < AWAKEN_MS.pulse; t += gap, gap = Math.max(70, gap * 0.8), up = !up) {
      const next = up;
      ts.push(window.setTimeout(() => { setAfter(next); cb.current?.("beat"); }, start + t + gap));
    }
    return () => ts.forEach(t => window.clearTimeout(t));
  }, [ready]);
  // The impact frames as the hit lands: three, each held for IMPACT_FRAMES painted frames and 80 ms (on a slow device,
  // at least one frame and 160 ms), so every one is seen; they end with the burst whatever happens.
  useEffect(() => {
    if (phase !== "burst") return;
    let raf = 0, step = 1, frames = 0, since = performance.now();
    const tick = (now: number) => {
      frames++;
      if ((frames >= IMPACT_FRAMES && now - since >= 80) || now - since >= 160) { step++; frames = 0; since = now; }
      setImpact(step > 3 ? 0 : step);
      if (step <= 3) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setImpact(0); };
  }, [phase]);
  return <div className={`${m.layer} gui`} data-gui-flat="">
    <div className={m.awScrim} aria-hidden="true" />
    <section ref={ref} role="dialog" aria-modal aria-label={label} tabIndex={-1} data-gui-overlay className={m.awaken} data-phase={phase} data-ready={ready || undefined} data-after={after || undefined}
      data-impact={impact || undefined}
      style={{ "--edge": `var(--ui-rarity-${rarity})`, "--from": `var(--ui-rarity-${from})`, "--room": AWAKEN_ROOM } as CSSProperties} data-testid={testId}>
      <div className={m.awDeep} aria-hidden="true" />
      <div className={m.awImpact} aria-hidden="true" />
      <p className={m.awLead} aria-live="polite">{phase === "reveal" ? null : lead}</p>
      <div className={m.awStage}>
        <div className={m.awThing}>{thing(after, phase)}</div>
      </div>
      <div className={m.awImpactTint} aria-hidden="true" />
      {phase === "reveal" && <div className={m.awCard}>
        <p className={m.eyebrow}>{eyebrow}</p>
        <h2 className={m.title}>{name}</h2>
        <span className={m.awPill}>{rarityLabel}</span>
        {text && <p className={m.text}>{text}</p>}
        {children}
        {action}
      </div>}
    </section>
    <div className={m.awFlash} data-phase={phase} data-impact={impact || undefined} aria-hidden="true" />
  </div>;
}
