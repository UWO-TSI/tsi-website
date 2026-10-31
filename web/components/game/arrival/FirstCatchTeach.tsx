"use client";

/**
 * The first catch's teaching (t-catch; David's playtest: "this tutorial should show up when the fish bar pops up and
 * should be less words"), the tutorial's own and not any fishing overlay's: while the walk's catch is the task, the
 * reel assist's floor is on (lib/game/fishingReel.ts: the fish can't get away), and as the reel's bar pops up a chip
 * over it says "Hold to reel" with the key, until you hold. Driven only by the fishing events, so whichever overlay
 * draws the reel (FishingOverlay, the member island's next one) gets it:
 *   tsi:fish-hooked                                the reel starts: the chip, over the bar (REEL_BAR) once it's laid out
 *   tsi:fish-caught, tsi:fish-escaped, tsi:fish-end the reel's over: the chip goes
 *   a press (pointer down, Space) once it has been up a moment: you're holding, the chip goes
 */
import { useEffect, useState } from "react";
import { Hand, MousePointerClick } from "lucide-react";
import { Keycap } from "@/components/gui";
import { reelAssist } from "@/lib/game/fishingReel";
import { REEL_TEACH } from "@/lib/game/arrival/lines";
import s from "./Arrival.module.css";

/** The line never drains below this on the first catch. */
const FLOOR = 0.08;
/** Where the reel's bar is on screen (the overlay's reel panel). */
const REEL_BAR = '[aria-label="Fishing reel"]';
/** A press only counts once the chip has been up this long (the hook's own click isn't it). */
const READ_MS = 600;

export default function FirstCatchTeach({ touch }: { touch: boolean }) {
  /** Its bottom edge (px from the screen's foot, over the bar), "foot" with no bar found, or null when it's down. */
  const [at, setAt] = useState<number | "foot" | null>(null);
  useEffect(() => {
    reelAssist.floor = FLOOR;
    let since = 0, raf = 0;
    const hide = () => { since = 0; setAt(null); };
    const hooked = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => {
        const r = document.querySelector(REEL_BAR)?.getBoundingClientRect();
        since = performance.now();
        setAt(r && r.width ? window.innerHeight - r.top + 12 : "foot");
      }); });
    };
    const press = (e: Event) => {
      if (!since || performance.now() - since < READ_MS) return;
      if (e.type === "pointerdown" || (e as KeyboardEvent).key === " ") hide();
    };
    const ends = ["tsi:fish-caught", "tsi:fish-escaped", "tsi:fish-end"];
    window.addEventListener("tsi:fish-hooked", hooked);
    ends.forEach(n => window.addEventListener(n, hide));
    window.addEventListener("pointerdown", press, true);
    window.addEventListener("keydown", press, true);
    return () => {
      reelAssist.floor = 0;
      cancelAnimationFrame(raf);
      window.removeEventListener("tsi:fish-hooked", hooked);
      ends.forEach(n => window.removeEventListener(n, hide));
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("keydown", press, true);
    };
  }, []);
  if (at === null) return null;
  return <div className={s.teach} role="status" data-testid="reel-teach" style={typeof at === "number" ? { bottom: at } : undefined}>
    {touch ? <Hand size={20} aria-hidden /> : <><Keycap className={s.teachCap}>Space</Keycap><MousePointerClick size={20} aria-hidden /></>}
    <span>{REEL_TEACH}</span>
  </div>;
}
