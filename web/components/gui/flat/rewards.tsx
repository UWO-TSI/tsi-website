"use client";

/**
 * The flat kit's reward pieces (specs/design-bible.md, UI): `HeartMeter` (a friendship in half hearts), `RewardTrack`
 * (a run of days, each one's reward shown ahead), `PrizeWheel` (a wheel of prizes that spins to the one already won),
 * `GoalMeter` (a thick bar filling to its value, with marks along it) and `CountUp` (a number that counts to its value).
 * Plain props, --ui-* tokens only; nothing here knows about residents or the welcome week. Shown in /lab/gui.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check } from "lucide-react";
import r from "./rewards.module.css";

const HEART = "M12 21.2s-6.9-4.4-9.5-8.3C.6 9.9 1.5 6.2 4.6 4.9c2.3-1 4.8-.1 6.2 1.9L12 8.3l1.2-1.5c1.4-2 3.9-2.9 6.2-1.9 3.1 1.3 4 5 2.1 8C18.9 16.8 12 21.2 12 21.2z";

/** One heart: empty, half (the left half) or full. */
function HeartGlyph({ fill, size }: { fill: 0 | 1 | 2; size: number }) {
  const clip = useId();
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <clipPath id={clip}><path d={HEART} /></clipPath>
    <path d={HEART} className={r.heartEmpty} />
    <rect clipPath={`url(#${clip})`} x="0" y="0" width={fill * 12} height="24" className={r.heartFill} />
  </svg>;
}

/**
 * A friendship in half hearts: `halves` of `max` hearts (two halves each). When it changes, the heart that moved springs
 * (up) or sinks and shakes (down).
 */
export function HeartMeter({ halves, max = 5, size = 18, label }: { halves: number; max?: number; size?: number; label?: string }) {
  const n = Math.max(0, Math.min(max * 2, Math.round(halves)));
  const [seen, setSeen] = useState(n);
  const [moved, setMoved] = useState<{ at: number; dir: "up" | "down"; k: number } | null>(null);
  if (seen !== n) {
    setSeen(n);
    setMoved({ at: Math.floor((Math.max(seen, n) - 1) / 2), dir: n > seen ? "up" : "down", k: (moved?.k ?? 0) + 1 });
  }
  return <span className={r.hearts} role="img" aria-label={label ?? `${n / 2} of ${max} hearts`}>
    {Array.from({ length: max }, (_, i) => {
      const fill = Math.max(0, Math.min(2, n - i * 2)) as 0 | 1 | 2;
      return <span key={moved?.at === i ? `${i}-${moved.k}` : i} className={r.heart} data-moved={moved?.at === i ? moved.dir : undefined}>
        <HeartGlyph fill={fill} size={size} />
      </span>;
    })}
  </span>;
}

export type TrackStep = {
  key: string;
  /** Its name over the picture ("Day 3"). */
  label: ReactNode;
  /** What it brings: the real icon, big. */
  picture: ReactNode;
  /** How much, under the picture ("×300"). */
  amount?: ReactNode;
  /** Taken (a check), today's (lifted, outlined), or still to come. */
  state: "done" | "today" | "ahead";
  /** The track's last and biggest: a wider tile. */
  big?: boolean;
  /** Its rarity's thin edge (design bible, UI 7), and its picture gives a small shake now and then. */
  rarity?: string;
};

/** A run of rewards (the welcome week): every step's reward shown ahead, the taken ones checked, today's lifted. */
export function RewardTrack({ steps, label }: { steps: readonly TrackStep[]; label: string }) {
  const at = steps.findIndex(s => s.state === "today");
  const done = steps.filter(s => s.state === "done").length;
  const reached = at >= 0 ? at : done;
  return <ol className={r.track} aria-label={label} style={{ "--reached": steps.length > 1 ? reached / (steps.length - 1) : 0 } as CSSProperties}>
    {steps.map((s, i) => <li key={s.key} className={r.step} data-state={s.state} data-big={s.big || undefined} data-rarity={s.rarity}
      style={{ "--i": i, ...(s.rarity ? { "--edge": `var(--ui-rarity-${s.rarity}, var(--gui-rarity-${s.rarity}))` } : {}) } as CSSProperties}>
      <span className={r.stepLabel}>{s.label}</span>
      <span className={r.stepPicture}>{s.picture}</span>
      {s.amount != null && <span className={r.stepAmount}>{s.amount}</span>}
      {s.state === "done" && <span className={r.stepCheck} aria-label="taken"><Check size={12} strokeWidth={3.2} /></span>}
    </li>)}
  </ol>;
}

export type WheelPrize = { key: string; picture: ReactNode; label: string; rarity?: string | null };
/** Turns before it settles. */
const TURNS = 5;
export const WHEEL_SPIN_MS = 4200;

/**
 * A wheel of prizes under a pointer. With `land` set (the index of the prize already won), it spins a few turns and
 * eases to a stop with that prize under the pointer, which then pops; `onLanded` once it has. Reduced motion: a short turn.
 */
export function PrizeWheel({ prizes, land, onLanded, size = 280, label }: { prizes: readonly WheelPrize[]; land: number | null; onLanded?: () => void; size?: number; label?: string }) {
  const seg = 360 / Math.max(1, prizes.length);
  const [turn, setTurn] = useState(0);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (land === null) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setTurn(TURNS * 360 + (360 - (land + 0.5) * seg))));
    return () => cancelAnimationFrame(raf);
  }, [land, seg]);
  const wedge = (i: number) => {
    const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180;
    return `M50 50 L${50 + 50 * Math.cos(a0)} ${50 + 50 * Math.sin(a0)} A50 50 0 ${seg > 180 ? 1 : 0} 1 ${50 + 50 * Math.cos(a1)} ${50 + 50 * Math.sin(a1)} Z`;
  };
  const won = landed && land !== null ? prizes[land] : null;
  return <div className={r.wheelWrap} style={{ width: size, height: size }} role="img" aria-label={won ? `${label ?? "The wheel"}: ${won.label}` : label ?? "The wheel"} data-landed={landed || undefined}>
    <div className={r.wheel} data-spinning={turn > 0 || undefined} style={{ transform: `rotate(${turn}deg)`, "--spin": `${WHEEL_SPIN_MS}ms` } as CSSProperties}
      onTransitionEnd={e => { if (e.target === e.currentTarget && land !== null && !landed) { setLanded(true); onLanded?.(); } }}>
      <svg viewBox="0 0 100 100" className={r.wheelFace} aria-hidden="true">
        {prizes.map((p, i) => <path key={p.key} d={wedge(i)} className={i % 2 ? r.wedgeB : r.wedgeA} />)}
      </svg>
      {prizes.map((p, i) => {
        const a = (i + 0.5) * seg;
        return <span key={p.key} className={r.prize} data-won={(landed && i === land) || undefined} data-rarity={p.rarity ?? undefined}
          style={{ "--a": `${a}deg`, "--r": `${size * 0.33}px`, "--edge": p.rarity ? `var(--ui-rarity-${p.rarity}, var(--ui-line-strong))` : "var(--ui-line)" } as CSSProperties}>
          {p.picture}
        </span>;
      })}
      <span className={r.hub} aria-hidden="true" />
    </div>
    <span className={r.pointer} aria-hidden="true" />
  </div>;
}

/** A number that counts up (or down) to `n` when it shows and whenever it changes, never jumping (UI 9). */
export function CountUp({ n, ms = 700 }: { n: number; ms?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = still ? 1 : Math.min(1, (t - t0) / ms), v = Math.round(a + (n - a) * (1 - (1 - k) ** 3));
      setShown(v); from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  return <span className={r.count}>{shown.toLocaleString()}</span>;
}

/**
 * A thick bar filling to `value` (0 to 1) as it shows, with `marks` (pictures) at even steps along it, each lit once
 * the fill passes it.
 */
export function GoalMeter({ value, marks = [], label }: { value: number; marks?: readonly ReactNode[]; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  return <div className={r.meter} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
    <span className={r.meterFill} style={{ "--v": v } as CSSProperties} />
    {marks.map((m, i) => {
      const at = (i + 1) / marks.length;
      return <span key={i} className={r.mark} data-lit={v >= at || undefined} style={{ "--at": at, "--i": i } as CSSProperties}>{m}</span>;
    })}
  </div>;
}
