"use client";

/**
 * The wallet (specs/design-bible.md UI 8b, David's v4 review: "there isnt a slot for the coins and gems"): coins and
 * gems, the one home for both, a small flat pill in its slot top right under the time. Each currency is a cell marked
 * `data-hud-slot` ("coins", "gems"): every coin and gem animation flies there (the kit's FlyIn).
 *   at        "in": sliding in (a change at rest, or a fly-in on its way), "out": sliding away; unset: it rests (the UI view)
 *   landing   a fly-in is heading for that cell: its icon waits out of its place until the FlyIn marks the cell
 *             `data-landed`, then clicks in and its count ticks up
 * Counts ease to a new value, never jump. Colours: the theme's --ui-* tokens. Shown on /lab/gui.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CurrencyIcon } from "@/components/economy/Amount";
import { COINS, GEMS } from "@/lib/economy";
import w from "./wallet.module.css";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The shown number eases to `value` (straight to the DOM, no re-render per frame); the first value just appears. */
export function CountUp({ value }: { value: number }) {
  const span = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = span.current, from = shown.current;
    if (!el) return;
    const show = (n: number) => { shown.current = n; el.textContent = n.toLocaleString(); };
    if (from === null || from === value || reduced()) { show(value); return; }
    const start = performance.now(), ms = Math.min(1200, 500 + Math.abs(value - from) * 4);
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      show(Math.round(from + (value - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={span} />;
}

type Currency = "coins" | "gems";

/** One currency's cell. Landing: from 0 until the FlyIn marks it landed, then up to its count. */
function Cell({ currency, value, landing }: { currency: Currency; value: number; landing: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!landing || !el) return;
    const seen = new MutationObserver(() => { if (el.hasAttribute("data-landed")) setLanded(true); });
    seen.observe(el, { attributes: true, attributeFilter: ["data-landed"] });
    return () => { seen.disconnect(); el.removeAttribute("data-landed"); setLanded(false); };
  }, [landing]);
  const name = currency === "gems" ? GEMS.name : COINS.name;
  return <span ref={ref} className={w.cell} data-hud-slot={currency} data-landing={landing || undefined} title={name}>
    <i className={w.icon} aria-hidden="true"><CurrencyIcon currency={currency} size={20} /></i>
    <b aria-hidden="true"><CountUp value={landing && !landed ? 0 : value} /></b>
  </span>;
}

export function WalletSlot({ coins, gems, at, landing = null, onOpen, title }: {
  coins: number; gems: number; at?: "in" | "out"; landing?: Currency | null;
  /** The wallet opens the wallet sheet; its key on the tooltip (`title`). */
  onOpen?: () => void; title?: string;
}) {
  const label = `${coins.toLocaleString()} ${COINS.name}, ${gems.toLocaleString()} ${GEMS.name}`;
  const cells = <>
    <Cell currency="coins" value={coins} landing={landing === "coins"} />
    <Cell currency="gems" value={gems} landing={landing === "gems"} />
  </>;
  return onOpen
    ? <button type="button" className={w.wallet} data-at={at} data-hud-wallet="" onClick={onOpen} aria-label={`${label}. Open your wallet`} title={title}>{cells}</button>
    : <span className={w.wallet} data-at={at} data-hud-wallet="" aria-label={label}>{cells}</span>;
}
