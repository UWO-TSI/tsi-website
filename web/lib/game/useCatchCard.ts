/**
 * The catch card's beats (the fishing overlays' shared rules; specs/polish/fishing.md deliverable 5): `delay` ms after
 * the catch leaves the water the card arrives; a first catch keeps its silhouette a beat (longer for the rarer:
 * REVEAL.develop), then develops with a chime (`onDevelop` draws the overlay's own celebration); it stays REVEAL.hold
 * and goes. Continue (a click, E, Space, Enter) shows a developing card now or closes a developed one; Esc closes.
 * Reduced motion develops at once.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioManager } from "./audio";
import { REVEAL, type FishDef } from "./fishing";

export function useCatchCard({ fish, isNew, delay, suspense, onDevelop, onDone }: {
  fish: FishDef; isNew: boolean; delay: number;
  /** A first catch's beat before it develops (ms), in place of REVEAL's (the member card's suspense). */
  suspense?: number;
  onDevelop?: () => void; onDone: () => void;
}) {
  const cfg = REVEAL[fish.rarity];
  const [developed, setDeveloped] = useState(!isNew);
  const timers = useRef<number[]>([]);
  const done = useRef(false);
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    timers.current.forEach(t => window.clearTimeout(t));
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const develop = useCallback(() => {
    if (done.current) return;
    setDeveloped(true);
    AudioManager.playSFX("confirm");
    onDevelop?.();
    timers.current.push(window.setTimeout(finish, cfg.hold));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A repeat develops as it arrives; a first catch keeps its silhouette a beat.
    timers.current.push(window.setTimeout(develop, delay + (isNew && !calm ? suspense ?? cfg.develop : 120)));
    const list = timers.current;
    return () => list.forEach(t => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Continue: a developing card shows now, a developed one goes. */
  const next = useCallback(() => {
    if (done.current) return;
    if (developed) finish();
    else { timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; develop(); }
  }, [developed, develop, finish]);
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as Element | null)?.closest("button")) return;
      e.preventDefault(); e.stopPropagation(); next();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); return; }
      if (["e", "E", " ", "Enter"].includes(e.key)) {
        // Native buttons own Space and Enter; a key held from the reel never skips the card.
        if ((e.key === " " || e.key === "Enter") && (document.activeElement as Element | null)?.closest("button")) return;
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) next();
      }
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("pointerdown", onPointer, true); window.removeEventListener("keydown", onKey, true); };
  }, [next, finish]);
  return { developed, next, finish };
}
