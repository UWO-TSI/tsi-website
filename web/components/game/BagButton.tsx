"use client";

/**
 * The HUD's Bag button (I) and the pickup's fly-in (specs/game-ui.md §7): a picked-up item's icon flies into the
 * button, which bounces; it shakes when a pickup didn't fit; its count is what's new until you look.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Backpack } from "lucide-react";
import { Counter } from "@/components/gui";
import { iconUrl } from "@/lib/icons/keys";
import { AudioManager } from "@/lib/game/audio";
import { loadBag, useBag } from "@/lib/game/bagStore";
import s from "./BagHud.module.css";

type Flight = { id: number; icon: string; x: number; y: number; dx: number; dy: number };
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/**
 * The Bag button (I). In the clean HUD it shows only for a moment: a pickup's icon flies into it and it bounces, or
 * it shakes when a pickup didn't fit. Its count is what's new since you last looked. It stays in the page while
 * hidden, so a flight always knows where to land.
 */
export function BagButton({ full, keyLabel, onOpen }: { full: boolean; keyLabel: string; onOpen: () => void }) {
  const { fresh } = useBag();
  const ref = useRef<HTMLButtonElement>(null);
  const [flash, setFlash] = useState(false);
  const [bump, setBump] = useState<"bounce" | "shake" | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  useEffect(() => {
    void loadBag(); // the pickups' room check needs the bag from the start
    let seq = 0, hide = 0;
    const show = () => { setFlash(true); window.clearTimeout(hide); hide = window.setTimeout(() => setFlash(false), 2600); };
    const got = (e: Event) => {
      const key = (e as CustomEvent<{ key?: string }>).detail?.key;
      show();
      const r = ref.current?.getBoundingClientRect();
      if (!key || !r || reduced()) { setBump("bounce"); return; }
      const x = window.innerWidth / 2, y = window.innerHeight * 0.55;
      setFlights(f => [...f, { id: ++seq, icon: iconUrl(key), x, y, dx: r.left + r.width / 2 - x, dy: r.top + r.height / 2 - y }]);
    };
    const refused = () => { show(); setBump("shake"); AudioManager.playSFX("exit", { rate: 0.85, gain: 0.3 }); };
    window.addEventListener("tsi:bag-got", got);
    window.addEventListener("tsi:bag-full", refused);
    return () => { window.removeEventListener("tsi:bag-got", got); window.removeEventListener("tsi:bag-full", refused); window.clearTimeout(hide); };
  }, []);
  const landed = (id: number) => {
    setFlights(f => f.filter(x => x.id !== id));
    setBump("bounce");
    AudioManager.playSFX("blip1", { rate: 1.5, gain: 0.28 });
  };
  const shown = full || flash;
  return <>
    <button ref={ref} type="button" className={s.bagButton} data-shown={shown || undefined} data-bump={bump ?? undefined} tabIndex={shown ? undefined : -1} aria-hidden={!shown || undefined}
      onAnimationEnd={e => { if (e.target === e.currentTarget) setBump(null); }} onClick={onOpen} aria-label={`Open your bag${fresh.length ? `, ${fresh.length} new` : ""}`}>
      <kbd>{keyLabel}</kbd><Backpack size={17} aria-hidden /> Bag<Counter n={fresh.length} className={s.badge} />
    </button>
    {flights.map(f => <span key={f.id} className={s.flight} style={{ left: f.x, top: f.y, "--dx": `${f.dx}px`, "--dy": `${f.dy}px` } as CSSProperties} aria-hidden
      onAnimationEnd={e => { if (e.target === e.currentTarget) landed(f.id); }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span className={s.flightArc}><img src={f.icon} alt="" width={44} height={44} /></span>
    </span>)}
  </>;
}
